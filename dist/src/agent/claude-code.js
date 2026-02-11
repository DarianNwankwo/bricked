/**
 * Claude Code CLI Integration
 *
 * Wraps the Claude Code CLI as a child process, streaming structured events
 * back to the browser via SSE. Used by the Canvas chat panel in Dev mode.
 *
 * Sessions persist across messages — the first invocation creates a session,
 * subsequent invocations resume it with --resume so Claude Code has full
 * conversation context.
 */
import { spawn } from 'child_process';
import { createInterface } from 'readline';
let activeProcess = null;
let currentSessionId = null;
export async function* executeClaudeCode(instruction, cwd) {
    if (activeProcess) {
        yield { type: 'error', content: 'A Claude Code process is already running. Cancel it first.' };
        return;
    }
    const filesChanged = new Set();
    const startTime = Date.now();
    // Build args: resume existing session or start fresh
    const args = ['-p', instruction, '--output-format', 'stream-json', '--verbose'];
    if (currentSessionId) {
        args.push('--resume', currentSessionId);
    }
    const proc = spawn('claude', args, {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env },
    });
    activeProcess = proc;
    const rl = createInterface({ input: proc.stdout });
    try {
        for await (const line of rl) {
            if (!line.trim())
                continue;
            let event;
            try {
                event = JSON.parse(line);
            }
            catch {
                continue; // skip non-JSON lines
            }
            const eventType = event.type;
            if (eventType === 'system') {
                // Capture session ID for future --resume calls
                const sessionId = event.session_id;
                if (sessionId) {
                    currentSessionId = sessionId;
                }
                continue;
            }
            if (eventType === 'assistant') {
                const message = event.message;
                if (!message)
                    continue;
                const content = message.content;
                if (!Array.isArray(content))
                    continue;
                for (const block of content) {
                    if (block.type === 'text') {
                        yield { type: 'text', content: block.text };
                    }
                    else if (block.type === 'tool_use') {
                        const toolName = block.name;
                        const input = block.input;
                        const filePath = input?.file_path;
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
                // tool_result messages — extract file info from tool_use_result
                const toolResult = event.tool_use_result;
                if (toolResult?.filePath) {
                    filesChanged.add(toolResult.filePath);
                }
                continue;
            }
            if (eventType === 'result') {
                const duration = Date.now() - startTime;
                yield {
                    type: 'done',
                    summary: {
                        filesChanged: [...filesChanged],
                        duration,
                    },
                };
                continue;
            }
        }
    }
    catch (err) {
        // Stream closed or process error
        if (activeProcess === proc) {
            yield { type: 'error', content: `Stream error: ${err.message}` };
        }
    }
    // Wait for process exit
    const exitCode = await new Promise((resolve) => {
        if (proc.exitCode !== null) {
            resolve(proc.exitCode);
        }
        else {
            proc.on('exit', (code) => resolve(code));
        }
    });
    if (activeProcess === proc) {
        activeProcess = null;
    }
    if (exitCode !== null && exitCode !== 0) {
        yield { type: 'error', content: `Claude Code exited with code ${exitCode}` };
    }
}
export function cancelClaudeCode() {
    if (!activeProcess)
        return false;
    activeProcess.kill('SIGTERM');
    activeProcess = null;
    return true;
}
export function resetSession() {
    currentSessionId = null;
}
export function getSessionId() {
    return currentSessionId;
}
//# sourceMappingURL=claude-code.js.map