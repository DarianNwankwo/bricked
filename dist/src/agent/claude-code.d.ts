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
export interface ClaudeCodeEvent {
    type: 'text' | 'tool_use' | 'tool_result' | 'status' | 'error' | 'done' | 'bac_update' | 'docs_update';
    content?: string;
    tool?: string;
    filePath?: string;
    fileAction?: string;
    summary?: {
        filesChanged: string[];
        duration: number;
    };
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
/**
 * Send a message to the persistent Claude Code process and yield events
 * as they stream back. Spawns the process on first call.
 */
export declare function sendMessage(instruction: string, cwd: string, options?: {
    systemContext?: string;
}): AsyncGenerator<ClaudeCodeEvent>;
/**
 * Cancel the current in-flight request. Since we can't cancel a single
 * turn in stream-json mode, this kills the process. It will respawn
 * automatically on the next sendMessage call.
 */
export declare function cancelCurrentRequest(): boolean;
/** Get the full conversation history. */
export declare function getConversationHistory(): ConversationEntry[];
/** Clear conversation history, kill the persistent process, and reset all state. */
export declare function clearConversation(): void;
/** Reset session (clears everything). */
export declare function resetSession(): void;
/** Get the current session ID. */
export declare function getSessionId(): string | null;
/** Check if the persistent process is alive. */
export declare function isAlive(): boolean;
export declare const executeClaudeCode: typeof sendMessage;
export declare const cancelClaudeCode: typeof cancelCurrentRequest;
//# sourceMappingURL=claude-code.d.ts.map