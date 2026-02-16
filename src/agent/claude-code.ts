/**
 * Claude Code CLI Integration — Persistent Process Model
 *
 * Maintains a single long-lived Claude Code process that communicates via
 * bidirectional stdio pipes (proc.stdin / proc.stdout). The process stays
 * alive across messages using --input-format stream-json, so Claude retains
 * full conversation context without needing --resume.
 *
 * Architecture:
 *   Browser <--SSE--> HTTP Server <--stdio pipes--> Claude Code (persistent)
 *       proc.stdin.write()   → user messages (NDJSON)
 *       proc.stdout (readline) ← assistant responses (NDJSON)
 */

import { spawn, type ChildProcess } from 'child_process';
import { createInterface, type Interface as ReadlineInterface } from 'readline';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClaudeCodeEvent {
  type: 'text' | 'tool_use' | 'tool_result' | 'status' | 'error' | 'done' | 'bac_update' | 'docs_update';
  content?: string;
  tool?: string;
  filePath?: string;
  fileAction?: string;
  summary?: { filesChanged: string[]; duration: number };
  patches?: unknown[];
  bac?: unknown;
  architecture?: unknown;
  completeness?: unknown;
  docs?: string;
}

export interface ConversationEntry {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

let persistentProcess: ChildProcess | null = null;
let sessionId: string | null = null;
let outputReader: ReadlineInterface | null = null;
let cwdPath: string | null = null;
let isProcessing = false;

const conversationHistory: ConversationEntry[] = [];

// Buffer for stdout lines that arrive between turns. The readline 'line'
// listener pushes here; sendMessage drains it.
let lineBuffer: string[] = [];
let lineResolve: ((line: string) => void) | null = null;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function onStdoutLine(line: string): void {
  if (lineResolve) {
    const resolve = lineResolve;
    lineResolve = null;
    resolve(line);
  } else {
    lineBuffer.push(line);
  }
}

/** Returns the next line from stdout, waiting if necessary. */
function nextLine(): Promise<string> {
  if (lineBuffer.length > 0) {
    return Promise.resolve(lineBuffer.shift()!);
  }
  return new Promise<string>((resolve) => {
    lineResolve = resolve;
  });
}

/** Returns the next line, or rejects after `ms` milliseconds. */
function nextLineWithTimeout(ms: number): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      // Remove pending resolve so it doesn't fire later
      lineResolve = null;
      reject(new Error(`Timed out waiting for Claude response after ${ms / 1000}s`));
    }, ms);

    nextLine().then((line) => {
      clearTimeout(timer);
      resolve(line);
    });
  });
}

// ---------------------------------------------------------------------------
// Process lifecycle
// ---------------------------------------------------------------------------

function ensureProcess(cwd: string): void {
  if (persistentProcess && persistentProcess.exitCode === null) {
    return; // already alive
  }

  // Clean up stale state
  cleanup();

  const args = [
    '-p',
    '--input-format', 'stream-json',
    '--output-format', 'stream-json',
    '--verbose',
  ];

  const proc = spawn('claude', args, {
    cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env },
  });

  persistentProcess = proc;
  cwdPath = cwd;

  // Line-based reader on stdout
  const rl = createInterface({ input: proc.stdout! });
  outputReader = rl;

  rl.on('line', onStdoutLine);

  // Detect unexpected death
  proc.on('exit', (code) => {
    if (persistentProcess === proc) {
      persistentProcess = null;
      outputReader = null;
      isProcessing = false;
      // Reject any pending line read
      if (lineResolve) {
        const resolve = lineResolve;
        lineResolve = null;
        // We can't reject a resolve, so push a synthetic error line
        lineBuffer.push(JSON.stringify({
          type: '__process_exit',
          code,
        }));
        resolve(lineBuffer.shift()!);
      }
    }
  });

  // Kill child when the server exits
  const onParentExit = () => {
    if (proc.exitCode === null) {
      proc.kill('SIGTERM');
    }
  };
  process.on('exit', onParentExit);
  proc.on('exit', () => {
    process.removeListener('exit', onParentExit);
  });

  // Drain stderr to prevent back-pressure blocking
  proc.stderr?.resume();
}

function cleanup(): void {
  if (outputReader) {
    outputReader.removeAllListeners();
    outputReader.close();
    outputReader = null;
  }
  if (persistentProcess && persistentProcess.exitCode === null) {
    persistentProcess.kill('SIGTERM');
  }
  persistentProcess = null;
  sessionId = null;
  lineBuffer = [];
  lineResolve = null;
  isProcessing = false;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Send a message to the persistent Claude Code process and yield events
 * as they stream back. Spawns the process on first call.
 */
export async function* sendMessage(
  instruction: string,
  cwd: string,
  options?: { systemContext?: string }
): AsyncGenerator<ClaudeCodeEvent> {
  if (isProcessing) {
    yield { type: 'error', content: 'A message is already being processed. Wait or cancel first.' };
    return;
  }

  isProcessing = true;

  const filesChanged = new Set<string>();
  const startTime = Date.now();
  let fullAssistantText = '';

  try {
    ensureProcess(cwd);

    // Prepend BAC/system context if provided
    const fullInstruction = options?.systemContext
      ? `${options.systemContext}\n\n---\n\n${instruction}`
      : instruction;

    // Record user message in history
    conversationHistory.push({
      role: 'user',
      content: fullInstruction,
      timestamp: Date.now(),
    });

    // Write NDJSON message to Claude's stdin
    const stdinMessage = JSON.stringify({
      type: 'user',
      message: { role: 'user', content: fullInstruction },
      session_id: sessionId || 'default',
      parent_tool_use_id: null,
    });

    if (!persistentProcess?.stdin?.writable) {
      yield { type: 'error', content: 'Claude process stdin is not writable' };
      isProcessing = false;
      return;
    }

    persistentProcess.stdin.write(stdinMessage + '\n');

    // Read response events until we get a 'result' event (turn complete)
    const MESSAGE_TIMEOUT = 120_000; // 2 minutes per line
    let turnComplete = false;

    while (!turnComplete) {
      let line: string;
      try {
        line = await nextLineWithTimeout(MESSAGE_TIMEOUT);
      } catch {
        yield { type: 'error', content: 'Timed out waiting for Claude response. The process may be hung.' };
        // Kill and allow respawn on next message
        cleanup();
        break;
      }

      if (!line.trim()) continue;

      let event: Record<string, unknown>;
      try {
        event = JSON.parse(line);
      } catch {
        continue; // skip non-JSON lines
      }

      const eventType = event.type as string;

      // Detect synthetic process exit event
      if (eventType === '__process_exit') {
        yield { type: 'error', content: `Claude process exited unexpectedly (code ${event.code})` };
        break;
      }

      if (eventType === 'system') {
        const sid = event.session_id as string | undefined;
        if (sid) {
          sessionId = sid;
        }
        continue;
      }

      if (eventType === 'assistant') {
        const message = event.message as Record<string, unknown> | undefined;
        if (!message) continue;
        const content = message.content as Array<Record<string, unknown>> | undefined;
        if (!Array.isArray(content)) continue;

        for (const block of content) {
          if (block.type === 'text') {
            const text = block.text as string;
            fullAssistantText += text;
            yield { type: 'text', content: text };
          } else if (block.type === 'tool_use') {
            const toolName = block.name as string;
            const input = block.input as Record<string, unknown> | undefined;
            const filePath = input?.file_path as string | undefined;

            if (filePath && (toolName === 'Edit' || toolName === 'Write')) {
              filesChanged.add(filePath);
            }

            yield {
              type: 'tool_use',
              tool: toolName,
              filePath,
              fileAction: toolName === 'Edit' ? 'edit' : toolName === 'Write' ? 'create' : undefined,
            };
          }
        }
        continue;
      }

      if (eventType === 'user') {
        // tool_result messages
        const toolResult = event.tool_use_result as Record<string, unknown> | undefined;
        if (toolResult?.filePath) {
          filesChanged.add(toolResult.filePath as string);
        }
        continue;
      }

      if (eventType === 'result') {
        turnComplete = true;

        // Record assistant response in history
        if (fullAssistantText) {
          conversationHistory.push({
            role: 'assistant',
            content: fullAssistantText,
            timestamp: Date.now(),
          });
        }

        const duration = Date.now() - startTime;
        yield {
          type: 'done',
          summary: {
            filesChanged: [...filesChanged],
            duration,
          },
        };
      }
    }
  } catch (err) {
    yield { type: 'error', content: `Error: ${(err as Error).message}` };
  } finally {
    isProcessing = false;
  }
}

/**
 * Cancel the current in-flight request. Since we can't cancel a single
 * turn in stream-json mode, this kills the process. It will respawn
 * automatically on the next sendMessage call.
 */
export function cancelCurrentRequest(): boolean {
  if (!persistentProcess) return false;
  cleanup();
  return true;
}

/** Get the full conversation history. */
export function getConversationHistory(): ConversationEntry[] {
  return [...conversationHistory];
}

/** Clear conversation history, kill the persistent process, and reset all state. */
export function clearConversation(): void {
  cleanup();
  conversationHistory.length = 0;
}

/** Reset session (clears everything). */
export function resetSession(): void {
  clearConversation();
}

/** Get the current session ID. */
export function getSessionId(): string | null {
  return sessionId;
}

/** Check if the persistent process is alive. */
export function isAlive(): boolean {
  return persistentProcess !== null && persistentProcess.exitCode === null;
}

// Legacy exports for backward compatibility during migration
export const executeClaudeCode = sendMessage;
export const cancelClaudeCode = cancelCurrentRequest;
