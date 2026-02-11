/**
 * Coaching API Routes
 *
 * REST API endpoints for coaching operations:
 * - /api/coaching/clients - Client management
 * - /api/coaching/sessions - Session scheduling
 * - /api/coaching/transactions - Payment tracking
 * - /api/coaching/notes - Session notes
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { clientService, sessionService, transactionService, noteService, } from '../services/coaching.js';
const router = Router();
// All coaching routes require authentication
router.use(requireAuth);
// =============================================================================
// Client Routes
// =============================================================================
// List clients
router.get('/clients', async (req, res) => {
    try {
        const { status } = req.query;
        const clients = await clientService.getByUserId(req.userId, status);
        res.json({ clients });
    }
    catch (error) {
        console.error('Error listing clients:', error);
        res.status(500).json({ error: 'Failed to list clients' });
    }
});
// Get client stats
router.get('/clients/stats', async (req, res) => {
    try {
        const stats = await clientService.getStats(req.userId);
        res.json(stats);
    }
    catch (error) {
        console.error('Error getting client stats:', error);
        res.status(500).json({ error: 'Failed to get client stats' });
    }
});
// Get single client
router.get('/clients/:id', async (req, res) => {
    try {
        const client = await clientService.getById(req.params.id);
        if (!client || client.userId !== req.userId) {
            return res.status(404).json({ error: 'Client not found' });
        }
        res.json({ client });
    }
    catch (error) {
        console.error('Error getting client:', error);
        res.status(500).json({ error: 'Failed to get client' });
    }
});
// Create client
router.post('/clients', async (req, res) => {
    try {
        const { firstName, lastName, email, phone, timezone, status, metadata } = req.body;
        if (!firstName || !lastName || !email) {
            return res.status(400).json({ error: 'First name, last name, and email are required' });
        }
        const client = await clientService.create(req.userId, {
            firstName,
            lastName,
            email,
            phone,
            timezone,
            status,
            metadata,
        });
        res.status(201).json({ client });
    }
    catch (error) {
        console.error('Error creating client:', error);
        if (error instanceof Error && error.message.includes('already exists')) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Failed to create client' });
    }
});
// Update client
router.patch('/clients/:id', async (req, res) => {
    try {
        const client = await clientService.getById(req.params.id);
        if (!client || client.userId !== req.userId) {
            return res.status(404).json({ error: 'Client not found' });
        }
        const updated = await clientService.update(req.params.id, req.body);
        res.json({ client: updated });
    }
    catch (error) {
        console.error('Error updating client:', error);
        if (error instanceof Error && error.message.includes('already exists')) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Failed to update client' });
    }
});
// Delete client
router.delete('/clients/:id', async (req, res) => {
    try {
        const client = await clientService.getById(req.params.id);
        if (!client || client.userId !== req.userId) {
            return res.status(404).json({ error: 'Client not found' });
        }
        await clientService.delete(req.params.id);
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error deleting client:', error);
        res.status(500).json({ error: 'Failed to delete client' });
    }
});
// =============================================================================
// Session Routes
// =============================================================================
// List sessions
router.get('/sessions', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const sessions = await sessionService.getByUserId(req.userId, startDate ? new Date(startDate) : undefined, endDate ? new Date(endDate) : undefined);
        res.json({ sessions });
    }
    catch (error) {
        console.error('Error listing sessions:', error);
        res.status(500).json({ error: 'Failed to list sessions' });
    }
});
// Get upcoming sessions
router.get('/sessions/upcoming', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const sessions = await sessionService.getUpcoming(req.userId, limit);
        res.json({ sessions });
    }
    catch (error) {
        console.error('Error getting upcoming sessions:', error);
        res.status(500).json({ error: 'Failed to get upcoming sessions' });
    }
});
// Get session stats
router.get('/sessions/stats', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const stats = await sessionService.getStats(req.userId, startDate ? new Date(startDate) : undefined, endDate ? new Date(endDate) : undefined);
        res.json(stats);
    }
    catch (error) {
        console.error('Error getting session stats:', error);
        res.status(500).json({ error: 'Failed to get session stats' });
    }
});
// Get sessions by client
router.get('/sessions/client/:clientId', async (req, res) => {
    try {
        const client = await clientService.getById(req.params.clientId);
        if (!client || client.userId !== req.userId) {
            return res.status(404).json({ error: 'Client not found' });
        }
        const sessions = await sessionService.getByClientId(req.params.clientId);
        res.json({ sessions });
    }
    catch (error) {
        console.error('Error getting client sessions:', error);
        res.status(500).json({ error: 'Failed to get client sessions' });
    }
});
// Get single session
router.get('/sessions/:id', async (req, res) => {
    try {
        const session = await sessionService.getById(req.params.id);
        if (!session || session.userId !== req.userId) {
            return res.status(404).json({ error: 'Session not found' });
        }
        res.json({ session });
    }
    catch (error) {
        console.error('Error getting session:', error);
        res.status(500).json({ error: 'Failed to get session' });
    }
});
// Create session
router.post('/sessions', async (req, res) => {
    try {
        const { clientId, title, description, scheduledAt, duration, sessionType, meetingUrl } = req.body;
        if (!clientId || !title || !scheduledAt || !duration) {
            return res.status(400).json({ error: 'Client ID, title, scheduled date, and duration are required' });
        }
        const session = await sessionService.create(req.userId, {
            clientId,
            title,
            description,
            scheduledAt: new Date(scheduledAt),
            duration: parseInt(duration),
            sessionType: sessionType || 'regular',
            meetingUrl,
        });
        res.status(201).json({ session });
    }
    catch (error) {
        console.error('Error creating session:', error);
        if (error instanceof Error && error.message === 'Client not found') {
            return res.status(404).json({ error: error.message });
        }
        res.status(500).json({ error: 'Failed to create session' });
    }
});
// Update session
router.patch('/sessions/:id', async (req, res) => {
    try {
        const session = await sessionService.getById(req.params.id);
        if (!session || session.userId !== req.userId) {
            return res.status(404).json({ error: 'Session not found' });
        }
        const updates = { ...req.body };
        if (updates.scheduledAt) {
            updates.scheduledAt = new Date(updates.scheduledAt);
        }
        const updated = await sessionService.update(req.params.id, updates);
        res.json({ session: updated });
    }
    catch (error) {
        console.error('Error updating session:', error);
        res.status(500).json({ error: 'Failed to update session' });
    }
});
// Mark session completed
router.post('/sessions/:id/complete', async (req, res) => {
    try {
        const session = await sessionService.getById(req.params.id);
        if (!session || session.userId !== req.userId) {
            return res.status(404).json({ error: 'Session not found' });
        }
        const { notes } = req.body;
        const updated = await sessionService.markCompleted(req.params.id, notes);
        res.json({ session: updated });
    }
    catch (error) {
        console.error('Error completing session:', error);
        res.status(500).json({ error: 'Failed to complete session' });
    }
});
// Mark session cancelled
router.post('/sessions/:id/cancel', async (req, res) => {
    try {
        const session = await sessionService.getById(req.params.id);
        if (!session || session.userId !== req.userId) {
            return res.status(404).json({ error: 'Session not found' });
        }
        const updated = await sessionService.markCancelled(req.params.id);
        res.json({ session: updated });
    }
    catch (error) {
        console.error('Error cancelling session:', error);
        res.status(500).json({ error: 'Failed to cancel session' });
    }
});
// Mark session no-show
router.post('/sessions/:id/no-show', async (req, res) => {
    try {
        const session = await sessionService.getById(req.params.id);
        if (!session || session.userId !== req.userId) {
            return res.status(404).json({ error: 'Session not found' });
        }
        const updated = await sessionService.markNoShow(req.params.id);
        res.json({ session: updated });
    }
    catch (error) {
        console.error('Error marking no-show:', error);
        res.status(500).json({ error: 'Failed to mark no-show' });
    }
});
// Delete session
router.delete('/sessions/:id', async (req, res) => {
    try {
        const session = await sessionService.getById(req.params.id);
        if (!session || session.userId !== req.userId) {
            return res.status(404).json({ error: 'Session not found' });
        }
        await sessionService.delete(req.params.id);
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error deleting session:', error);
        res.status(500).json({ error: 'Failed to delete session' });
    }
});
// =============================================================================
// Transaction Routes
// =============================================================================
// List transactions
router.get('/transactions', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const transactions = await transactionService.getByUserId(req.userId, startDate ? new Date(startDate) : undefined, endDate ? new Date(endDate) : undefined);
        res.json({ transactions });
    }
    catch (error) {
        console.error('Error listing transactions:', error);
        res.status(500).json({ error: 'Failed to list transactions' });
    }
});
// Get revenue stats
router.get('/transactions/stats', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const stats = await transactionService.getRevenueStats(req.userId, startDate ? new Date(startDate) : undefined, endDate ? new Date(endDate) : undefined);
        res.json(stats);
    }
    catch (error) {
        console.error('Error getting revenue stats:', error);
        res.status(500).json({ error: 'Failed to get revenue stats' });
    }
});
// Get transactions by client
router.get('/transactions/client/:clientId', async (req, res) => {
    try {
        const client = await clientService.getById(req.params.clientId);
        if (!client || client.userId !== req.userId) {
            return res.status(404).json({ error: 'Client not found' });
        }
        const transactions = await transactionService.getByClientId(req.params.clientId);
        res.json({ transactions });
    }
    catch (error) {
        console.error('Error getting client transactions:', error);
        res.status(500).json({ error: 'Failed to get client transactions' });
    }
});
// Get single transaction
router.get('/transactions/:id', async (req, res) => {
    try {
        const transaction = await transactionService.getById(req.params.id);
        if (!transaction || transaction.userId !== req.userId) {
            return res.status(404).json({ error: 'Transaction not found' });
        }
        res.json({ transaction });
    }
    catch (error) {
        console.error('Error getting transaction:', error);
        res.status(500).json({ error: 'Failed to get transaction' });
    }
});
// Create transaction
router.post('/transactions', async (req, res) => {
    try {
        const { clientId, type, amount, currency, description, packageDetails } = req.body;
        if (!clientId || !type || amount === undefined || !description) {
            return res.status(400).json({ error: 'Client ID, type, amount, and description are required' });
        }
        const transaction = await transactionService.create(req.userId, {
            clientId,
            type,
            amount: parseInt(amount),
            currency,
            description,
            packageDetails,
        });
        res.status(201).json({ transaction });
    }
    catch (error) {
        console.error('Error creating transaction:', error);
        if (error instanceof Error && error.message === 'Client not found') {
            return res.status(404).json({ error: error.message });
        }
        res.status(500).json({ error: 'Failed to create transaction' });
    }
});
// Mark transaction completed
router.post('/transactions/:id/complete', async (req, res) => {
    try {
        const transaction = await transactionService.getById(req.params.id);
        if (!transaction || transaction.userId !== req.userId) {
            return res.status(404).json({ error: 'Transaction not found' });
        }
        const { stripePaymentId } = req.body;
        const updated = await transactionService.markCompleted(req.params.id, stripePaymentId);
        res.json({ transaction: updated });
    }
    catch (error) {
        console.error('Error completing transaction:', error);
        res.status(500).json({ error: 'Failed to complete transaction' });
    }
});
// =============================================================================
// Note Routes
// =============================================================================
// List notes
router.get('/notes', async (req, res) => {
    try {
        const notes = await noteService.getByUserId(req.userId);
        res.json({ notes });
    }
    catch (error) {
        console.error('Error listing notes:', error);
        res.status(500).json({ error: 'Failed to list notes' });
    }
});
// Get notes by client
router.get('/notes/client/:clientId', async (req, res) => {
    try {
        const client = await clientService.getById(req.params.clientId);
        if (!client || client.userId !== req.userId) {
            return res.status(404).json({ error: 'Client not found' });
        }
        const notes = await noteService.getByClientId(req.params.clientId);
        res.json({ notes });
    }
    catch (error) {
        console.error('Error getting client notes:', error);
        res.status(500).json({ error: 'Failed to get client notes' });
    }
});
// Get notes by session
router.get('/notes/session/:sessionId', async (req, res) => {
    try {
        const session = await sessionService.getById(req.params.sessionId);
        if (!session || session.userId !== req.userId) {
            return res.status(404).json({ error: 'Session not found' });
        }
        const notes = await noteService.getBySessionId(req.params.sessionId);
        res.json({ notes });
    }
    catch (error) {
        console.error('Error getting session notes:', error);
        res.status(500).json({ error: 'Failed to get session notes' });
    }
});
// Get single note
router.get('/notes/:id', async (req, res) => {
    try {
        const note = await noteService.getById(req.params.id);
        if (!note || note.userId !== req.userId) {
            return res.status(404).json({ error: 'Note not found' });
        }
        res.json({ note });
    }
    catch (error) {
        console.error('Error getting note:', error);
        res.status(500).json({ error: 'Failed to get note' });
    }
});
// Create note
router.post('/notes', async (req, res) => {
    try {
        const { clientId, sessionId, title, content, tags, isPrivate } = req.body;
        if (!clientId || !title || !content) {
            return res.status(400).json({ error: 'Client ID, title, and content are required' });
        }
        const note = await noteService.create(req.userId, {
            clientId,
            sessionId,
            title,
            content,
            tags,
            isPrivate,
        });
        res.status(201).json({ note });
    }
    catch (error) {
        console.error('Error creating note:', error);
        if (error instanceof Error && (error.message === 'Client not found' || error.message === 'Session not found')) {
            return res.status(404).json({ error: error.message });
        }
        res.status(500).json({ error: 'Failed to create note' });
    }
});
// Update note
router.patch('/notes/:id', async (req, res) => {
    try {
        const note = await noteService.getById(req.params.id);
        if (!note || note.userId !== req.userId) {
            return res.status(404).json({ error: 'Note not found' });
        }
        const updated = await noteService.update(req.params.id, req.body);
        res.json({ note: updated });
    }
    catch (error) {
        console.error('Error updating note:', error);
        res.status(500).json({ error: 'Failed to update note' });
    }
});
// Delete note
router.delete('/notes/:id', async (req, res) => {
    try {
        const note = await noteService.getById(req.params.id);
        if (!note || note.userId !== req.userId) {
            return res.status(404).json({ error: 'Note not found' });
        }
        await noteService.delete(req.params.id);
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error deleting note:', error);
        res.status(500).json({ error: 'Failed to delete note' });
    }
});
// Add session note (convenience endpoint)
router.post('/sessions/:sessionId/notes', async (req, res) => {
    try {
        const session = await sessionService.getById(req.params.sessionId);
        if (!session || session.userId !== req.userId) {
            return res.status(404).json({ error: 'Session not found' });
        }
        const { title, content } = req.body;
        if (!title || !content) {
            return res.status(400).json({ error: 'Title and content are required' });
        }
        const note = await noteService.addSessionNote(req.userId, req.params.sessionId, title, content);
        res.status(201).json({ note });
    }
    catch (error) {
        console.error('Error adding session note:', error);
        res.status(500).json({ error: 'Failed to add session note' });
    }
});
// =============================================================================
// AI Chat - Site Design Iteration
// =============================================================================
// Chat with LLM for site design changes
router.post('/project/:id/chat', async (req, res) => {
    try {
        const { message, history, siteContent } = req.body;
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }
        const { chat } = await import('../../llm/client.js');
        const { SITE_DESIGN_PROMPT } = await import('../../codegen/prompts.js');
        const systemPrompt = SITE_DESIGN_PROMPT + '\n\n## Current Site Content\n```json\n' + JSON.stringify(siteContent, null, 2) + '\n```';
        const messages = [
            ...(history || []).map((m) => ({
                role: m.role,
                content: m.content,
            })),
            { role: 'user', content: message },
        ];
        const response = await chat(systemPrompt, messages, undefined, { maxTokens: 4096 });
        // Try to extract JSON content update from response
        let updatedContent = null;
        const jsonMatch = response.content.match(/```json\s*([\s\S]*?)```/);
        if (jsonMatch) {
            try {
                updatedContent = JSON.parse(jsonMatch[1]);
            }
            catch { /* not valid JSON, that's ok */ }
        }
        // Extract the text response (everything before the JSON block)
        const textResponse = response.content.replace(/```json[\s\S]*?```/, '').trim();
        res.json({ response: textResponse, updatedContent });
    }
    catch (error) {
        console.error('Error in chat:', error);
        res.status(500).json({ error: 'Failed to process chat message' });
    }
});
// Stream chat with LLM for site design changes
router.post('/project/:id/chat/stream', async (req, res) => {
    try {
        const { message, history, siteContent } = req.body;
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }
        const { chatStream } = await import('../../llm/client.js');
        const { SITE_DESIGN_PROMPT } = await import('../../codegen/prompts.js');
        const systemPrompt = SITE_DESIGN_PROMPT + '\n\n## Current Site Content\n```json\n' + JSON.stringify(siteContent, null, 2) + '\n```';
        const messages = [
            ...(history || []).map((m) => ({
                role: m.role,
                content: m.content,
            })),
            { role: 'user', content: message },
        ];
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        });
        const stream = chatStream(systemPrompt, messages, undefined, { maxTokens: 4096 });
        let fullResponse = '';
        for await (const chunk of stream) {
            fullResponse += chunk;
            res.write(`data: ${JSON.stringify({ token: chunk })}\n\n`);
        }
        // After streaming, extract any JSON updates
        let updatedContent = null;
        const jsonMatch = fullResponse.match(/```json\s*([\s\S]*?)```/);
        if (jsonMatch) {
            try {
                updatedContent = JSON.parse(jsonMatch[1]);
            }
            catch { /* not valid JSON */ }
        }
        res.write(`data: ${JSON.stringify({ done: true, updatedContent })}\n\n`);
        res.end();
    }
    catch (error) {
        console.error('Error in chat stream:', error);
        res.status(500).json({ error: 'Failed to process chat stream' });
    }
});
export default router;
//# sourceMappingURL=coaching.js.map