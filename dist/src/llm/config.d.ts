export interface LLMConfig {
    provider: 'openrouter' | 'anthropic' | 'openai';
    model: string;
    apiKey: string;
    baseUrl?: string;
}
export declare const DEFAULT_MODELS: Record<string, string>;
export declare const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
export declare function getLLMConfig(): LLMConfig;
export declare const POPULAR_MODELS: {
    id: string;
    name: string;
    provider: string;
}[];
//# sourceMappingURL=config.d.ts.map