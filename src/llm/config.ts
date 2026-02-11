export interface LLMConfig {
  provider: 'openrouter' | 'anthropic' | 'openai';
  model: string;
  apiKey: string;
  baseUrl?: string;
}

export const DEFAULT_MODELS: Record<string, string> = {
  openrouter: 'anthropic/claude-sonnet-4',
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4o',
};

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

export function getLLMConfig(): LLMConfig {
  // Check for OpenRouter first (preferred)
  if (process.env.OPENROUTER_API_KEY) {
    return {
      provider: 'openrouter',
      apiKey: process.env.OPENROUTER_API_KEY,
      model: process.env.BRICK_MODEL || DEFAULT_MODELS.openrouter,
      baseUrl: OPENROUTER_BASE_URL,
    };
  }

  // Fall back to Anthropic
  if (process.env.ANTHROPIC_API_KEY) {
    return {
      provider: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.BRICK_MODEL || DEFAULT_MODELS.anthropic,
    };
  }

  // Fall back to OpenAI
  if (process.env.OPENAI_API_KEY) {
    return {
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.BRICK_MODEL || DEFAULT_MODELS.openai,
    };
  }

  throw new Error(
    'No API key found. Set one of: OPENROUTER_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY'
  );
}

export const POPULAR_MODELS = [
  // Claude models
  { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', provider: 'Anthropic' },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
  { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku (fast)', provider: 'Anthropic' },

  // OpenAI models
  { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini (fast)', provider: 'OpenAI' },
  { id: 'openai/o1-preview', name: 'o1 Preview', provider: 'OpenAI' },

  // Google models
  { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash', provider: 'Google' },
  { id: 'google/gemini-pro-1.5', name: 'Gemini Pro 1.5', provider: 'Google' },

  // Meta models
  { id: 'meta-llama/llama-3.1-405b-instruct', name: 'Llama 3.1 405B', provider: 'Meta' },
  { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B', provider: 'Meta' },

  // Mistral models
  { id: 'mistralai/mistral-large', name: 'Mistral Large', provider: 'Mistral' },
  { id: 'mistralai/mixtral-8x22b-instruct', name: 'Mixtral 8x22B', provider: 'Mistral' },

  // DeepSeek
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3', provider: 'DeepSeek' },
  { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', provider: 'DeepSeek' },
];
