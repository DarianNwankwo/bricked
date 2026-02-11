import { type LLMConfig } from './config.js';
export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}
export interface ChatResponse {
    content: string;
}
export interface ChatOptions {
    maxTokens?: number;
}
export declare function chat(systemPrompt: string, messages: ChatMessage[], config?: LLMConfig, options?: ChatOptions): Promise<ChatResponse>;
export declare function chatStream(systemPrompt: string, messages: ChatMessage[], config?: LLMConfig, options?: ChatOptions): AsyncGenerator<string, void, unknown>;
export declare function getConfiguredModel(): string;
export declare function getConfiguredProvider(): string;
//# sourceMappingURL=client.d.ts.map