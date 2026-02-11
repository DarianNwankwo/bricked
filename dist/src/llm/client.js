import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { getLLMConfig } from './config.js';
let openaiClient = null;
let anthropicClient = null;
let currentConfig = null;
function getOpenAIClient(config) {
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
function getAnthropicClient(config) {
    if (!anthropicClient || currentConfig?.apiKey !== config.apiKey) {
        anthropicClient = new Anthropic({
            apiKey: config.apiKey,
        });
        currentConfig = config;
    }
    return anthropicClient;
}
export async function chat(systemPrompt, messages, config, options) {
    const llmConfig = config || getLLMConfig();
    const maxTokens = options?.maxTokens || 1024;
    if (llmConfig.provider === 'anthropic') {
        return chatWithAnthropic(systemPrompt, messages, llmConfig, maxTokens);
    }
    else {
        return chatWithOpenAI(systemPrompt, messages, llmConfig, maxTokens);
    }
}
export async function* chatStream(systemPrompt, messages, config, options) {
    const llmConfig = config || getLLMConfig();
    const maxTokens = options?.maxTokens || 1024;
    if (llmConfig.provider === 'anthropic') {
        yield* streamWithAnthropic(systemPrompt, messages, llmConfig, maxTokens);
    }
    else {
        yield* streamWithOpenAI(systemPrompt, messages, llmConfig, maxTokens);
    }
}
async function* streamWithOpenAI(systemPrompt, messages, config, maxTokens = 1024) {
    const client = getOpenAIClient(config);
    const stream = await client.chat.completions.create({
        model: config.model,
        messages: [
            { role: 'system', content: systemPrompt },
            ...messages.map(m => ({
                role: m.role,
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
async function* streamWithAnthropic(systemPrompt, messages, config, maxTokens = 1024) {
    const client = getAnthropicClient(config);
    const stream = await client.messages.stream({
        model: config.model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: messages.map(m => ({
            role: m.role,
            content: m.content,
        })),
    });
    for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            yield event.delta.text;
        }
    }
}
async function chatWithOpenAI(systemPrompt, messages, config, maxTokens = 1024) {
    const client = getOpenAIClient(config);
    const response = await client.chat.completions.create({
        model: config.model,
        messages: [
            { role: 'system', content: systemPrompt },
            ...messages.map(m => ({
                role: m.role,
                content: m.content,
            })),
        ],
        max_tokens: maxTokens,
    });
    const content = response.choices[0]?.message?.content || '';
    return { content };
}
async function chatWithAnthropic(systemPrompt, messages, config, maxTokens = 1024) {
    const client = getAnthropicClient(config);
    const response = await client.messages.create({
        model: config.model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: messages.map(m => ({
            role: m.role,
            content: m.content,
        })),
    });
    const textContent = response.content.find(block => block.type === 'text');
    const content = textContent?.type === 'text' ? textContent.text : '';
    return { content };
}
export function getConfiguredModel() {
    try {
        const config = getLLMConfig();
        return config.model;
    }
    catch {
        return 'Not configured';
    }
}
export function getConfiguredProvider() {
    try {
        const config = getLLMConfig();
        return config.provider;
    }
    catch {
        return 'None';
    }
}
//# sourceMappingURL=client.js.map