// Project management routes
import { Router } from 'express';
import { getDatabase } from '../db/client.js';
import { requireAuth } from '../middleware/auth.js';
import { deploymentService } from '../services/deployment.js';
const router = Router();
// All project routes require authentication
router.use(requireAuth);
// Helper to check if user has access to project
async function checkProjectAccess(projectId, userId, requiredRole = 'viewer') {
    const db = getDatabase();
    const project = await db.getProjectById(projectId);
    if (!project)
        return null;
    // Owner always has access
    if (project.userId === userId) {
        return { project, role: 'owner' };
    }
    // Check if user is a member
    const member = await db.getProjectMember(projectId, userId);
    if (!member)
        return null;
    // Check role hierarchy
    const roleHierarchy = { viewer: 1, editor: 2, owner: 3 };
    if (roleHierarchy[member.role] >= roleHierarchy[requiredRole]) {
        return { project, role: member.role };
    }
    return null;
}
// List user's projects (including shared projects)
router.get('/', async (req, res) => {
    try {
        const db = getDatabase();
        const includeArchived = req.query.archived === 'true';
        // Get owned projects
        const ownedProjects = await db.getProjectsByUserId(req.userId, includeArchived);
        // Get shared projects (where user is a member but not owner)
        const memberProjects = await db.getProjectsForMember(req.userId);
        const sharedProjects = memberProjects.filter(p => p.userId !== req.userId);
        // Combine and dedupe
        const allProjects = [...ownedProjects];
        for (const shared of sharedProjects) {
            if (!allProjects.find(p => p.id === shared.id)) {
                allProjects.push(shared);
            }
        }
        // Get environments for each project
        const projectsWithEnvs = await Promise.all(allProjects.map(async (project) => {
            const environments = await db.getEnvironmentsByProjectId(project.id);
            const member = await db.getProjectMember(project.id, req.userId);
            return {
                id: project.id,
                name: project.name,
                slug: project.slug,
                componentCount: project.architecture.components.length,
                createdAt: project.createdAt,
                updatedAt: project.updatedAt,
                isOwner: project.userId === req.userId,
                role: project.userId === req.userId ? 'owner' : member?.role,
                isArchived: !!project.archivedAt,
                environments: environments.map(e => ({
                    name: e.name,
                    status: e.status,
                    url: e.url,
                    monthlyCostCents: e.monthlyCostCents,
                })),
            };
        }));
        res.json({ projects: projectsWithEnvs });
    }
    catch (error) {
        console.error('List projects error:', error);
        res.status(500).json({ error: 'Failed to list projects' });
    }
});
// Create a new project
router.post('/', async (req, res) => {
    try {
        const db = getDatabase();
        const { name, architecture, documentation } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Project name is required' });
        }
        const project = await db.createProject(req.userId, name, architecture || { components: [], connections: [] });
        if (documentation) {
            await db.updateProject(project.id, { documentation });
        }
        // Get environments
        const environments = await db.getEnvironmentsByProjectId(project.id);
        // Calculate estimated cost
        const estimatedCost = deploymentService.calculateMonthlyCost(project);
        res.status(201).json({
            project: {
                id: project.id,
                name: project.name,
                slug: project.slug,
                documentation: project.documentation,
                architecture: project.architecture,
                createdAt: project.createdAt,
                updatedAt: project.updatedAt,
                environments: environments.map(e => ({
                    name: e.name,
                    status: e.status,
                })),
                estimatedMonthlyCostCents: estimatedCost,
            },
        });
    }
    catch (error) {
        console.error('Create project error:', error);
        res.status(500).json({ error: 'Failed to create project' });
    }
});
// Get a single project
router.get('/:id', async (req, res) => {
    try {
        const db = getDatabase();
        const access = await checkProjectAccess(req.params.id, req.userId);
        if (!access) {
            return res.status(404).json({ error: 'Project not found' });
        }
        const { project, role } = access;
        const environments = await db.getEnvironmentsByProjectId(project.id);
        const estimatedCost = deploymentService.calculateMonthlyCost(project);
        const members = await db.getProjectMembers(project.id);
        res.json({
            project: {
                id: project.id,
                name: project.name,
                slug: project.slug,
                documentation: project.documentation,
                architecture: project.architecture,
                connectionLabels: project.connectionLabels || {},
                bac: project.bac || null,
                componentSpecs: project.componentSpecs || {},
                diagram: project.diagram || null,
                lastGeneratedComponents: project.lastGeneratedComponents || [],
                createdAt: project.createdAt,
                updatedAt: project.updatedAt,
                isArchived: !!project.archivedAt,
                archivedAt: project.archivedAt,
                role,
                environments: environments.map(e => ({
                    id: e.id,
                    name: e.name,
                    status: e.status,
                    url: e.url,
                    lastDeployedAt: e.lastDeployedAt,
                    monthlyCostCents: e.monthlyCostCents,
                })),
                estimatedMonthlyCostCents: estimatedCost,
                memberCount: members.length,
            },
        });
    }
    catch (error) {
        console.error('Get project error:', error);
        res.status(500).json({ error: 'Failed to get project' });
    }
});
// Update a project
router.patch('/:id', async (req, res) => {
    try {
        const db = getDatabase();
        const access = await checkProjectAccess(req.params.id, req.userId, 'editor');
        if (!access) {
            return res.status(404).json({ error: 'Project not found or not authorized' });
        }
        const { name, documentation, architecture, connectionLabels, bac, componentSpecs, diagram, lastGeneratedComponents } = req.body;
        const updates = {};
        if (name)
            updates.name = name;
        if (documentation !== undefined)
            updates.documentation = documentation;
        if (architecture)
            updates.architecture = architecture;
        if (connectionLabels !== undefined)
            updates.connectionLabels = connectionLabels;
        if (bac !== undefined)
            updates.bac = bac;
        if (componentSpecs !== undefined)
            updates.componentSpecs = componentSpecs;
        if (diagram !== undefined)
            updates.diagram = diagram;
        if (lastGeneratedComponents !== undefined)
            updates.lastGeneratedComponents = lastGeneratedComponents;
        const updated = await db.updateProject(access.project.id, updates);
        res.json({
            project: {
                id: updated.id,
                name: updated.name,
                slug: updated.slug,
                documentation: updated.documentation,
                architecture: updated.architecture,
                connectionLabels: updated.connectionLabels || {},
                updatedAt: updated.updatedAt,
            },
        });
    }
    catch (error) {
        console.error('Update project error:', error);
        res.status(500).json({ error: 'Failed to update project' });
    }
});
// Delete a project
router.delete('/:id', async (req, res) => {
    try {
        const db = getDatabase();
        const access = await checkProjectAccess(req.params.id, req.userId, 'owner');
        if (!access) {
            return res.status(404).json({ error: 'Project not found or not authorized' });
        }
        // Stop any active deployments first
        const environments = await db.getEnvironmentsByProjectId(access.project.id);
        for (const env of environments) {
            if (env.doAppId) {
                try {
                    await deploymentService.stopDeployment(access.project.id, env.name, req.userId);
                }
                catch {
                    // Continue even if stop fails
                }
            }
        }
        await db.deleteProject(access.project.id);
        res.json({ success: true });
    }
    catch (error) {
        console.error('Delete project error:', error);
        res.status(500).json({ error: 'Failed to delete project' });
    }
});
// Archive a project
router.patch('/:id/archive', async (req, res) => {
    try {
        const db = getDatabase();
        const access = await checkProjectAccess(req.params.id, req.userId, 'owner');
        if (!access) {
            return res.status(404).json({ error: 'Project not found or not authorized' });
        }
        const archived = await db.archiveProject(access.project.id, req.userId);
        res.json({
            project: {
                id: archived.id,
                name: archived.name,
                isArchived: true,
                archivedAt: archived.archivedAt,
            },
        });
    }
    catch (error) {
        console.error('Archive project error:', error);
        res.status(500).json({ error: 'Failed to archive project' });
    }
});
// Restore an archived project
router.patch('/:id/restore', async (req, res) => {
    try {
        const db = getDatabase();
        const access = await checkProjectAccess(req.params.id, req.userId, 'owner');
        if (!access) {
            return res.status(404).json({ error: 'Project not found or not authorized' });
        }
        const restored = await db.restoreProject(access.project.id);
        res.json({
            project: {
                id: restored.id,
                name: restored.name,
                isArchived: false,
                archivedAt: null,
            },
        });
    }
    catch (error) {
        console.error('Restore project error:', error);
        res.status(500).json({ error: 'Failed to restore project' });
    }
});
// === Project Members ===
// Get project members
router.get('/:id/members', async (req, res) => {
    try {
        const db = getDatabase();
        const access = await checkProjectAccess(req.params.id, req.userId);
        if (!access) {
            return res.status(404).json({ error: 'Project not found' });
        }
        const members = await db.getProjectMembers(access.project.id);
        // Get user details for each member
        const membersWithDetails = await Promise.all(members.map(async (member) => {
            const user = await db.getUserById(member.userId);
            return {
                id: member.id,
                userId: member.userId,
                email: user?.email,
                name: user?.name,
                role: member.role,
                invitedAt: member.invitedAt,
                acceptedAt: member.acceptedAt,
            };
        }));
        res.json({ members: membersWithDetails });
    }
    catch (error) {
        console.error('Get members error:', error);
        res.status(500).json({ error: 'Failed to get members' });
    }
});
// Invite a user to project
router.post('/:id/invite', async (req, res) => {
    try {
        const db = getDatabase();
        const access = await checkProjectAccess(req.params.id, req.userId, 'owner');
        if (!access) {
            return res.status(404).json({ error: 'Project not found or not authorized' });
        }
        const { email, role } = req.body;
        if (!email || !role) {
            return res.status(400).json({ error: 'Email and role are required' });
        }
        if (!['editor', 'viewer'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role. Must be editor or viewer.' });
        }
        // Check if user is already a member
        const existingUser = await db.getUserByEmail(email);
        if (existingUser) {
            const existingMember = await db.getProjectMember(access.project.id, existingUser.id);
            if (existingMember) {
                return res.status(400).json({ error: 'User is already a member of this project' });
            }
        }
        // Create invite
        const invite = await db.createProjectInvite(access.project.id, email, role, req.userId);
        res.status(201).json({
            invite: {
                id: invite.id,
                email: invite.email,
                role: invite.role,
                token: invite.token,
                expiresAt: invite.expiresAt,
                inviteUrl: `/invite/${invite.token}`,
            },
        });
    }
    catch (error) {
        console.error('Create invite error:', error);
        res.status(500).json({ error: 'Failed to create invite' });
    }
});
// Get pending invites for a project
router.get('/:id/invites', async (req, res) => {
    try {
        const db = getDatabase();
        const access = await checkProjectAccess(req.params.id, req.userId, 'owner');
        if (!access) {
            return res.status(404).json({ error: 'Project not found or not authorized' });
        }
        const invites = await db.getProjectInvitesByProjectId(access.project.id);
        res.json({
            invites: invites.map(i => ({
                id: i.id,
                email: i.email,
                role: i.role,
                createdAt: i.createdAt,
                expiresAt: i.expiresAt,
            })),
        });
    }
    catch (error) {
        console.error('Get invites error:', error);
        res.status(500).json({ error: 'Failed to get invites' });
    }
});
// Update a member's role
router.patch('/:id/members/:memberId', async (req, res) => {
    try {
        const db = getDatabase();
        const access = await checkProjectAccess(req.params.id, req.userId, 'owner');
        if (!access) {
            return res.status(404).json({ error: 'Project not found or not authorized' });
        }
        const { role } = req.body;
        if (!['editor', 'viewer'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role. Must be editor or viewer.' });
        }
        // Get the member to check if it's the owner
        const members = await db.getProjectMembers(access.project.id);
        const member = members.find(m => m.id === req.params.memberId);
        if (!member) {
            return res.status(404).json({ error: 'Member not found' });
        }
        if (member.role === 'owner') {
            return res.status(400).json({ error: 'Cannot change owner role' });
        }
        const updated = await db.updateProjectMember(req.params.memberId, { role });
        res.json({
            member: {
                id: updated.id,
                userId: updated.userId,
                role: updated.role,
            },
        });
    }
    catch (error) {
        console.error('Update member error:', error);
        res.status(500).json({ error: 'Failed to update member' });
    }
});
// Remove a member from project
router.delete('/:id/members/:memberId', async (req, res) => {
    try {
        const db = getDatabase();
        const access = await checkProjectAccess(req.params.id, req.userId, 'owner');
        if (!access) {
            return res.status(404).json({ error: 'Project not found or not authorized' });
        }
        // Get the member to check if it's the owner
        const members = await db.getProjectMembers(access.project.id);
        const member = members.find(m => m.id === req.params.memberId);
        if (!member) {
            return res.status(404).json({ error: 'Member not found' });
        }
        if (member.role === 'owner') {
            return res.status(400).json({ error: 'Cannot remove owner from project' });
        }
        await db.removeProjectMember(req.params.memberId);
        res.json({ success: true });
    }
    catch (error) {
        console.error('Remove member error:', error);
        res.status(500).json({ error: 'Failed to remove member' });
    }
});
// Delete a pending invite
router.delete('/:id/invites/:inviteId', async (req, res) => {
    try {
        const db = getDatabase();
        const access = await checkProjectAccess(req.params.id, req.userId, 'owner');
        if (!access) {
            return res.status(404).json({ error: 'Project not found or not authorized' });
        }
        await db.deleteProjectInvite(req.params.inviteId);
        res.json({ success: true });
    }
    catch (error) {
        console.error('Delete invite error:', error);
        res.status(500).json({ error: 'Failed to delete invite' });
    }
});
export default router;
//# sourceMappingURL=projects.js.map