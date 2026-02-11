// AI Usage tracking routes
import { Router } from 'express';
import { getDatabase } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';
import { getCurrentMonthUsage, getUsageHistory } from '../../llm/tracker.js';
const router = Router();
// All usage routes require authentication
router.use(requireAuth);
// Get current month's usage summary
router.get('/current-month', async (req, res) => {
    try {
        const summary = await getCurrentMonthUsage(req.userId);
        res.json({
            period: {
                start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
                end: new Date().toISOString(),
            },
            tokens: {
                input: summary.totalInputTokens,
                output: summary.totalOutputTokens,
                total: summary.totalInputTokens + summary.totalOutputTokens,
            },
            cost: {
                totalCents: summary.totalCostCents,
                premiumCents: summary.premiumCostCents,
                standardCents: summary.standardCostCents,
                totalDollars: (summary.totalCostCents / 100).toFixed(2),
            },
            breakdown: {
                byModel: summary.byModel,
                byProject: summary.byProject,
            },
        });
    }
    catch (error) {
        console.error('Get current month usage error:', error);
        res.status(500).json({ error: 'Failed to get usage data' });
    }
});
// Get usage history for past months
router.get('/history', async (req, res) => {
    try {
        const months = Math.min(parseInt(req.query.months) || 6, 12);
        const history = await getUsageHistory(req.userId, months);
        res.json({
            history: history.map(h => ({
                month: h.month,
                tokens: {
                    input: h.inputTokens,
                    output: h.outputTokens,
                    total: h.inputTokens + h.outputTokens,
                },
                costCents: h.costCents,
                costDollars: (h.costCents / 100).toFixed(2),
            })),
        });
    }
    catch (error) {
        console.error('Get usage history error:', error);
        res.status(500).json({ error: 'Failed to get usage history' });
    }
});
// Get detailed breakdown by model or project
router.get('/breakdown', async (req, res) => {
    try {
        const db = getDatabase();
        const type = req.query.type || 'model';
        // Get start and end dates for the requested period
        const months = Math.min(parseInt(req.query.months) || 1, 12);
        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
        const endDate = now;
        const summary = await db.getAIUsageSummary(req.userId, startDate, endDate);
        if (type === 'project') {
            // Get project names for the IDs
            const projectIds = Object.keys(summary.byProject).filter(id => id !== 'no-project');
            const projectNames = { 'no-project': 'No Project' };
            for (const projectId of projectIds) {
                const project = await db.getProjectById(projectId);
                if (project) {
                    projectNames[projectId] = project.name;
                }
            }
            res.json({
                type: 'project',
                period: { start: startDate.toISOString(), end: endDate.toISOString() },
                breakdown: Object.entries(summary.byProject).map(([id, data]) => ({
                    id,
                    name: projectNames[id] || id,
                    inputTokens: data.inputTokens,
                    outputTokens: data.outputTokens,
                    costCents: data.costCents,
                    costDollars: (data.costCents / 100).toFixed(2),
                })).sort((a, b) => b.costCents - a.costCents),
            });
        }
        else {
            res.json({
                type: 'model',
                period: { start: startDate.toISOString(), end: endDate.toISOString() },
                breakdown: Object.entries(summary.byModel).map(([model, data]) => ({
                    model,
                    inputTokens: data.inputTokens,
                    outputTokens: data.outputTokens,
                    costCents: data.costCents,
                    costDollars: (data.costCents / 100).toFixed(2),
                })).sort((a, b) => b.costCents - a.costCents),
            });
        }
    }
    catch (error) {
        console.error('Get usage breakdown error:', error);
        res.status(500).json({ error: 'Failed to get usage breakdown' });
    }
});
// Get recent usage records
router.get('/recent', async (req, res) => {
    try {
        const db = getDatabase();
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const records = await db.getAIUsageByUserId(req.userId);
        res.json({
            records: records.slice(0, limit).map(r => ({
                id: r.id,
                model: r.model,
                provider: r.provider,
                inputTokens: r.inputTokens,
                outputTokens: r.outputTokens,
                isPremium: r.isPremium,
                costCents: r.costCents,
                projectId: r.projectId,
                createdAt: r.createdAt.toISOString(),
            })),
        });
    }
    catch (error) {
        console.error('Get recent usage error:', error);
        res.status(500).json({ error: 'Failed to get recent usage' });
    }
});
export default router;
//# sourceMappingURL=usage.js.map