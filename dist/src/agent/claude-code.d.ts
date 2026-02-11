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
export interface ClaudeCodeEvent {
    type: 'text' | 'tool_use' | 'tool_result' | 'status' | 'error' | 'done';
    content?: string;
    tool?: string;
    filePath?: string;
    fileAction?: string;
    summary?: {
        filesChanged: string[];
        duration: number;
    };
}
export declare function executeClaudeCode(instruction: string, cwd: string): AsyncGenerator<ClaudeCodeEvent>;
export declare function cancelClaudeCode(): boolean;
export declare function resetSession(): void;
export declare function getSessionId(): string | null;
//# sourceMappingURL=claude-code.d.ts.map