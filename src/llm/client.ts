import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { getLLMConfig, type LLMConfig } from './config.js';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatResponse {
  content: string;
}

let openaiClient: OpenAI | null = null;
let anthropicClient: Anthropic | null = null;
let currentConfig: LLMConfig | null = null;

function getOpenAIClient(config: LLMConfig): OpenAI {
  if (!openaiClient || currentConfig?.apiKey !== config.apiKey || currentConfig?.baseUrl !== config.baseUrl) {
    openaiClient = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      defaultHeaders: config.provider === 'openrouter' ? {
        'HTTP-Referer': 'https://github.com/anthropics/brick',
        'X-Title': 'Brick CLI',
      } : undefined,
    });
    currentConfig = config;
  }
  return openaiClient;
}

function getAnthropicClient(config: LLMConfig): Anthropic {
  if (!anthropicClient || currentConfig?.apiKey !== config.apiKey) {
    anthropicClient = new Anthropic({
      apiKey: config.apiKey,
    });
    currentConfig = config;
  }
  return anthropicClient;
}

export interface ChatOptions {
  maxTokens?: number;
}

export async function chat(
  systemPrompt: string,
  messages: ChatMessage[],
  config?: LLMConfig,
  options?: ChatOptions
): Promise<ChatResponse> {
  const llmConfig = config || getLLMConfig();
  const maxTokens = options?.maxTokens || 1024;

  if (llmConfig.provider === 'anthropic') {
    return chatWithAnthropic(systemPrompt, messages, llmConfig, maxTokens);
  } else {
    return chatWithOpenAI(systemPrompt, messages, llmConfig, maxTokens);
  }
}

export async function* chatStream(
  systemPrompt: string,
  messages: ChatMessage[],
  config?: LLMConfig,
  options?: ChatOptions
): AsyncGenerator<string, void, unknown> {
  const llmConfig = config || getLLMConfig();
  const maxTokens = options?.maxTokens || 1024;

  if (llmConfig.provider === 'anthropic') {
    yield* streamWithAnthropic(systemPrompt, messages, llmConfig, maxTokens);
  } else {
    yield* streamWithOpenAI(systemPrompt, messages, llmConfig, maxTokens);
  }
}

async function* streamWithOpenAI(
  systemPrompt: string,
  messages: ChatMessage[],
  config: LLMConfig,
  maxTokens = 1024
): AsyncGenerator<string, void, unknown> {
  const client = getOpenAIClient(config);

  const stream = await client.chat.completions.create({
    model: config.model,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ],
    max_tokens: maxTokens,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield content;
    }
  }
}

async function* streamWithAnthropic(
  systemPrompt: string,
  messages: ChatMessage[],
  config: LLMConfig,
  maxTokens = 1024
): AsyncGenerator<string, void, unknown> {
  const client = getAnthropicClient(config);

  const stream = await client.messages.stream({
    model: config.model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      yield event.delta.text;
    }
  }
}

async function chatWithOpenAI(
  systemPrompt: string,
  messages: ChatMessage[],
  config: LLMConfig,
  maxTokens = 1024
): Promise<ChatResponse> {
  const client = getOpenAIClient(config);

  const response = await client.chat.completions.create({
    model: config.model,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ],
    max_tokens: maxTokens,
  });

  const content = response.choices[0]?.message?.content || '';
  return { content };
}

async function chatWithAnthropic(
  systemPrompt: string,
  messages: ChatMessage[],
  config: LLMConfig,
  maxTokens = 1024
): Promise<ChatResponse> {
  const client = getAnthropicClient(config);

  const response = await client.messages.create({
    model: config.model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  });

  const textContent = response.content.find(block => block.type === 'text');
  const content = textContent?.type === 'text' ? textContent.text : '';
  return { content };
}

export function getConfiguredModel(): string {
  try {
    const config = getLLMConfig();
    return config.model;
  } catch {
    return 'Not configured';
  }
}

export function getConfiguredProvider(): string {
  try {
    const config = getLLMConfig();
    return config.provider;
  } catch {
    return 'None';
  }
}
