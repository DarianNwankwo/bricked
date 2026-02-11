// Project invite routes
import { Router } from 'express';
import { getDatabase } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';
const router = Router();
// Get invite details (public - no auth required)
router.get('/:token', async (req, res) => {
    try {
        const db = getDatabase();
        const invite = await db.getProjectInvite(req.params.token);
        if (!invite) {
            return res.status(404).json({ error: 'Invite not found' });
        }
        if (invite.acceptedAt) {
            return res.status(400).json({ error: 'Invite has already been accepted' });
        }
        if (new Date() > invite.expiresAt) {
            return res.status(400).json({ error: 'Invite has expired' });
        }
        // Get project details
        const project = await db.getProjectById(invite.projectId);
        res.json({
            invite: {
                email: invite.email,
                role: invite.role,
                expiresAt: invite.expiresAt,
                project: project ? {
                    id: project.id,
                    name: project.name,
                } : null,
            },
        });
    }
    catch (error) {
        console.error('Get invite error:', error);
        res.status(500).json({ error: 'Failed to get invite' });
    }
});
// Accept an invite (requires auth)
router.post('/:token/accept', requireAuth, async (req, res) => {
    try {
        const db = getDatabase();
        const invite = await db.getProjectInvite(req.params.token);
        if (!invite) {
            return res.status(404).json({ error: 'Invite not found' });
        }
        if (invite.acceptedAt) {
            return res.status(400).json({ error: 'Invite has already been accepted' });
        }
        if (new Date() > invite.expiresAt) {
            return res.status(400).json({ error: 'Invite has expired' });
        }
        // Check if user is already a member
        const existingMember = await db.getProjectMember(invite.projectId, req.userId);
        if (existingMember) {
            return res.status(400).json({ error: 'You are already a member of this project' });
        }
        // Accept the invite
        const member = await db.acceptProjectInvite(req.params.token, req.userId);
        if (!member) {
            return res.status(400).json({ error: 'Failed to accept invite' });
        }
        // Get project details
        const project = await db.getProjectById(invite.projectId);
        res.json({
            member: {
                id: member.id,
                projectId: member.projectId,
                role: member.role,
            },
            project: project ? {
                id: project.id,
                name: project.name,
                slug: project.slug,
            } : null,
        });
    }
    catch (error) {
        console.error('Accept invite error:', error);
        res.status(500).json({ error: 'Failed to accept invite' });
    }
});
export default router;
//# sourceMappingURL=invites.js.map