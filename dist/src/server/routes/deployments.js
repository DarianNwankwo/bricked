// Deployment management routes
import { Router } from 'express';
import { db } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';
import { deploymentService } from '../services/deployment.js';
const router = Router();
// All deployment routes require authentication
router.use(requireAuth);
// Deploy to an environment
router.post('/:projectId/:environment', async (req, res) => {
    try {
        const { projectId, environment } = req.params;
        if (!['development', 'staging', 'production'].includes(environment)) {
            return res.status(400).json({ error: 'Invalid environment' });
        }
        const deployment = await deploymentService.startDeployment(projectId, environment, req.userId);
        res.status(202).json({
            deployment: {
                id: deployment.id,
                status: deployment.status,
                startedAt: deployment.startedAt,
            },
            message: 'Deployment started',
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Deployment failed';
        console.error('Deploy error:', error);
        res.status(400).json({ error: message });
    }
});
// Get deployment status
router.get('/:deploymentId', async (req, res) => {
    try {
        const deployment = await deploymentService.getDeploymentStatus(req.params.deploymentId, req.userId);
        if (!deployment) {
            return res.status(404).json({ error: 'Deployment not found' });
        }
        res.json({
            deployment: {
                id: deployment.id,
                status: deployment.status,
                url: deployment.url,
                logs: deployment.logs,
                startedAt: deployment.startedAt,
                completedAt: deployment.completedAt,
                error: deployment.error,
            },
        });
    }
    catch (error) {
        console.error('Get deployment error:', error);
        res.status(500).json({ error: 'Failed to get deployment status' });
    }
});
// Get deployment logs (streaming)
router.get('/:deploymentId/logs', async (req, res) => {
    try {
        const deployment = await deploymentService.getDeploymentStatus(req.params.deploymentId, req.userId);
        if (!deployment) {
            return res.status(404).json({ error: 'Deployment not found' });
        }
        // For SSE streaming
        if (req.headers.accept === 'text/event-stream') {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            let lastLogIndex = 0;
            const sendLogs = async () => {
                const current = await db.getDeploymentById(deployment.id);
                if (!current)
                    return;
                // Send new logs
                for (let i = lastLogIndex; i < current.logs.length; i++) {
                    res.write(`data: ${JSON.stringify({ log: current.logs[i] })}\n\n`);
                }
                lastLogIndex = current.logs.length;
                // Send status update
                res.write(`data: ${JSON.stringify({ status: current.status })}\n\n`);
                // Stop if deployment is complete
                if (['live', 'failed', 'cancelled'].includes(current.status)) {
                    res.write(`data: ${JSON.stringify({ done: true, url: current.url })}\n\n`);
                    res.end();
                    return;
                }
                // Continue polling
                setTimeout(sendLogs, 2000);
            };
            sendLogs();
            req.on('close', () => {
                // Client disconnected
            });
        }
        else {
            // Return logs as JSON
            res.json({ logs: deployment.logs });
        }
    }
    catch (error) {
        console.error('Get logs error:', error);
        res.status(500).json({ error: 'Failed to get logs' });
    }
});
// Stop/delete a deployment
router.delete('/:projectId/:environment', async (req, res) => {
    try {
        const { projectId, environment } = req.params;
        if (!['development', 'staging', 'production'].includes(environment)) {
            return res.status(400).json({ error: 'Invalid environment' });
        }
        await deploymentService.stopDeployment(projectId, environment, req.userId);
        res.json({ success: true, message: 'Deployment stopped' });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to stop deployment';
        console.error('Stop deployment error:', error);
        res.status(400).json({ error: message });
    }
});
// List deployments for a project/environment
router.get('/:projectId/:environment/history', async (req, res) => {
    try {
        const { projectId, environment } = req.params;
        const project = await db.getProjectById(projectId);
        if (!project || project.userId !== req.userId) {
            return res.status(404).json({ error: 'Project not found' });
        }
        const environments = await db.getEnvironmentsByProjectId(projectId);
        const env = environments.find(e => e.name === environment);
        if (!env) {
            return res.status(404).json({ error: 'Environment not found' });
        }
        const deployments = await db.getDeploymentsByEnvironmentId(env.id);
        res.json({
            deployments: deployments.map(d => ({
                id: d.id,
                status: d.status,
                url: d.url,
                startedAt: d.startedAt,
                completedAt: d.completedAt,
                error: d.error,
            })),
        });
    }
    catch (error) {
        console.error('List deployments error:', error);
        res.status(500).json({ error: 'Failed to list deployments' });
    }
});
export default router;
//# sourceMappingURL=deployments.js.map