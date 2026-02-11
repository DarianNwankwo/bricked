// AI Usage Tracker - wraps LLM calls to track token usage and costs
import { getDatabase } from '../server/db/client.js';
// Premium models (higher cost tier)
export const PREMIUM_MODELS = [
    'claude-3-opus',
    'claude-3.5-opus',
    'claude-opus-4',
    'gpt-4o',
    'gpt-4-turbo',
    'o1-preview',
    'o1',
    'gemini-pro-1.5',
];
// Standard models (lower cost tier)
export const STANDARD_MODELS = [
    'claude-3-sonnet',
    'claude-3.5-sonnet',
    'claude-sonnet-4',
    'claude-3-haiku',
    'gpt-4o-mini',
    'gpt-3.5-turbo',
    'gemini-2.0-flash',
    'llama-3.1',
    'mistral',
    'deepseek',
];
// Cost per 1K tokens in cents (approximate)
const MODEL_COSTS = {
    // Claude models
    'claude-opus-4': { input: 1.5, output: 7.5 },
    'claude-3-opus': { input: 1.5, output: 7.5 },
    'claude-3.5-opus': { input: 1.5, output: 7.5 },
    'claude-sonnet-4': { input: 0.3, output: 1.5 },
    'claude-3.5-sonnet': { input: 0.3, output: 1.5 },
    'claude-3-sonnet': { input: 0.3, output: 1.5 },
    'claude-3-haiku': { input: 0.025, output: 0.125 },
    // OpenAI models
    'gpt-4o': { input: 0.5, output: 1.5 },
    'gpt-4o-mini': { input: 0.015, output: 0.06 },
    'gpt-4-turbo': { input: 1.0, output: 3.0 },
    'o1-preview': { input: 1.5, output: 6.0 },
    'o1': { input: 1.5, output: 6.0 },
    // Google models
    'gemini-pro-1.5': { input: 0.35, output: 1.05 },
    'gemini-2.0-flash': { input: 0.075, output: 0.3 },
    // Open source models (via OpenRouter)
    'llama-3.1-405b': { input: 0.3, output: 0.3 },
    'llama-3.1-70b': { input: 0.09, output: 0.09 },
    'mistral-large': { input: 0.3, output: 0.9 },
    'mixtral-8x22b': { input: 0.09, output: 0.09 },
    'deepseek-chat': { input: 0.014, output: 0.028 },
    'deepseek-r1': { input: 0.055, output: 0.22 },
};
// Default cost for unknown models
const DEFAULT_COST = { input: 0.1, output: 0.3 };
function isPremiumModel(model) {
    const modelLower = model.toLowerCase();
    return PREMIUM_MODELS.some(pm => modelLower.includes(pm.toLowerCase()));
}
function getModelCost(model) {
    const modelLower = model.toLowerCase();
    // Try to find matching cost entry
    for (const [key, cost] of Object.entries(MODEL_COSTS)) {
        if (modelLower.includes(key.toLowerCase())) {
            return cost;
        }
    }
    return DEFAULT_COST;
}
function calculateCostCents(model, inputTokens, outputTokens) {
    const costs = getModelCost(model);
    const inputCost = (inputTokens / 1000) * costs.input;
    const outputCost = (outputTokens / 1000) * costs.output;
    return Math.round((inputCost + outputCost) * 100) / 100; // Round to 2 decimal places
}
// Track a single LLM call
export async function trackUsage(options, usage) {
    const db = getDatabase();
    const costCents = calculateCostCents(options.model, usage.inputTokens, usage.outputTokens);
    const isPremium = isPremiumModel(options.model);
    const record = await db.createAIUsageRecord({
        userId: options.userId,
        projectId: options.projectId,
        model: options.model,
        provider: options.provider,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        isPremium,
        costCents,
        createdAt: new Date(),
    });
    return record;
}
// Get usage summary for current month
export async function getCurrentMonthUsage(userId) {
    const db = getDatabase();
    // Get first day of current month
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return db.getAIUsageSummary(userId, startDate, endDate);
}
// Get usage history for past N months
export async function getUsageHistory(userId, months = 6) {
    const db = getDatabase();
    const history = [];
    const now = new Date();
    for (let i = 0; i < months; i++) {
        const startDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const endDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
        const summary = await db.getAIUsageSummary(userId, startDate, endDate);
        history.push({
            month: startDate.toISOString().slice(0, 7), // YYYY-MM format
            inputTokens: summary.totalInputTokens,
            outputTokens: summary.totalOutputTokens,
            costCents: summary.totalCostCents,
        });
    }
    return history.reverse(); // Return oldest first
}
// Estimate tokens from text (approximate: 1 token ≈ 4 characters for English)
export function estimateTokens(text) {
    return Math.ceil(text.length / 4);
}
//# sourceMappingURL=tracker.js.map