// Database client abstraction for Brick Platform
// Supports in-memory (default) and SQLite backends
import crypto from 'crypto';
import { SQLiteClient } from './sqlite-client.js';
// In-memory database implementation
class InMemoryDB {
    users = new Map();
    usersByEmail = new Map();
    projects = new Map();
    environments = new Map();
    deployments = new Map();
    usageRecords = new Map();
    aiUsageRecords = new Map();
    userPreferences = new Map();
    projectMembers = new Map();
    projectInvites = new Map();
    // Foundational data layer
    contacts = new Map();
    notes = new Map();
    contactInteractions = new Map();
    generateId() {
        return crypto.randomBytes(12).toString('hex');
    }
    slugify(name) {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 30);
    }
    // === Users ===
    async createUser(email, passwordHash, name) {
        const id = this.generateId();
        const user = {
            id,
            email: email.toLowerCase(),
            passwordHash,
            name,
            createdAt: new Date(),
        };
        this.users.set(id, user);
        this.usersByEmail.set(email.toLowerCase(), user);
        return user;
    }
    async getUserById(id) {
        return this.users.get(id) || null;
    }
    async getUserByEmail(email) {
        return this.usersByEmail.get(email.toLowerCase()) || null;
    }
    async updateUser(id, updates) {
        const user = this.users.get(id);
        if (!user)
            return null;
        const updated = { ...user, ...updates };
        this.users.set(id, updated);
        this.usersByEmail.set(updated.email.toLowerCase(), updated);
        return updated;
    }
    // === Projects ===
    async createProject(userId, name, architecture) {
        const id = this.generateId();
        const slug = this.slugify(name) + '-' + id.slice(0, 6);
        const project = {
            id,
            userId,
            name,
            slug,
            documentation: '',
            architecture,
            connectionLabels: {},
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        this.projects.set(id, project);
        // Auto-create environments
        for (const envName of ['development', 'staging', 'production']) {
            await this.createEnvironment(id, envName);
        }
        // Add owner as project member
        await this.addProjectMember(id, userId, 'owner', userId);
        return project;
    }
    async getProjectById(id) {
        return this.projects.get(id) || null;
    }
    async getProjectsByUserId(userId, includeArchived = false) {
        return Array.from(this.projects.values())
            .filter(p => p.userId === userId && (includeArchived || !p.archivedAt))
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    }
    async updateProject(id, updates) {
        const project = this.projects.get(id);
        if (!project)
            return null;
        const updated = { ...project, ...updates, updatedAt: new Date() };
        this.projects.set(id, updated);
        return updated;
    }
    async deleteProject(id) {
        const envs = await this.getEnvironmentsByProjectId(id);
        for (const env of envs) {
            this.environments.delete(env.id);
        }
        // Delete members and invites
        for (const [memberId, member] of this.projectMembers) {
            if (member.projectId === id)
                this.projectMembers.delete(memberId);
        }
        for (const [inviteId, invite] of this.projectInvites) {
            if (invite.projectId === id)
                this.projectInvites.delete(inviteId);
        }
        return this.projects.delete(id);
    }
    async archiveProject(id, userId) {
        const project = this.projects.get(id);
        if (!project)
            return null;
        const updated = {
            ...project,
            archivedAt: new Date(),
            archivedBy: userId,
            updatedAt: new Date(),
        };
        this.projects.set(id, updated);
        return updated;
    }
    async restoreProject(id) {
        const project = this.projects.get(id);
        if (!project)
            return null;
        const updated = {
            ...project,
            archivedAt: undefined,
            archivedBy: undefined,
            updatedAt: new Date(),
        };
        this.projects.set(id, updated);
        return updated;
    }
    // === Environments ===
    async createEnvironment(projectId, name) {
        const id = this.generateId();
        const env = {
            id,
            projectId,
            name,
            status: 'not_deployed',
            monthlyCostCents: 0,
        };
        this.environments.set(id, env);
        return env;
    }
    async getEnvironmentById(id) {
        return this.environments.get(id) || null;
    }
    async getEnvironmentsByProjectId(projectId) {
        return Array.from(this.environments.values()).filter(e => e.projectId === projectId);
    }
    async updateEnvironment(id, updates) {
        const env = this.environments.get(id);
        if (!env)
            return null;
        const updated = { ...env, ...updates };
        this.environments.set(id, updated);
        return updated;
    }
    // === Deployments ===
    async createDeployment(environmentId, projectId, userId) {
        const id = this.generateId();
        const deployment = {
            id,
            environmentId,
            projectId,
            userId,
            status: 'pending',
            logs: [],
            startedAt: new Date(),
        };
        this.deployments.set(id, deployment);
        return deployment;
    }
    async getDeploymentById(id) {
        return this.deployments.get(id) || null;
    }
    async getDeploymentsByEnvironmentId(environmentId) {
        return Array.from(this.deployments.values())
            .filter(d => d.environmentId === environmentId)
            .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
    }
    async updateDeployment(id, updates) {
        const deployment = this.deployments.get(id);
        if (!deployment)
            return null;
        const updated = { ...deployment, ...updates };
        this.deployments.set(id, updated);
        return updated;
    }
    async appendDeploymentLog(id, log) {
        const deployment = this.deployments.get(id);
        if (deployment) {
            deployment.logs.push(`[${new Date().toISOString()}] ${log}`);
        }
    }
    // === Usage Records ===
    async createUsageRecord(record) {
        const id = this.generateId();
        const usage = { id, ...record };
        this.usageRecords.set(id, usage);
        return usage;
    }
    async getUsageByUserId(userId, startDate, endDate) {
        return Array.from(this.usageRecords.values()).filter(r => r.userId === userId && r.periodStart >= startDate && r.periodEnd <= endDate);
    }
    // === AI Usage Records ===
    async createAIUsageRecord(record) {
        const id = this.generateId();
        const usage = { id, ...record };
        this.aiUsageRecords.set(id, usage);
        return usage;
    }
    async getAIUsageByUserId(userId, startDate, endDate) {
        return Array.from(this.aiUsageRecords.values())
            .filter(r => {
            if (r.userId !== userId)
                return false;
            if (startDate && r.createdAt < startDate)
                return false;
            if (endDate && r.createdAt > endDate)
                return false;
            return true;
        })
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    async getAIUsageByProjectId(projectId) {
        return Array.from(this.aiUsageRecords.values())
            .filter(r => r.projectId === projectId)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    async getAIUsageSummary(userId, startDate, endDate) {
        const records = await this.getAIUsageByUserId(userId, startDate, endDate);
        const summary = {
            totalInputTokens: 0,
            totalOutputTokens: 0,
            totalCostCents: 0,
            premiumCostCents: 0,
            standardCostCents: 0,
            byModel: {},
            byProject: {},
        };
        for (const record of records) {
            summary.totalInputTokens += record.inputTokens;
            summary.totalOutputTokens += record.outputTokens;
            summary.totalCostCents += record.costCents;
            if (record.isPremium) {
                summary.premiumCostCents += record.costCents;
            }
            else {
                summary.standardCostCents += record.costCents;
            }
            if (!summary.byModel[record.model]) {
                summary.byModel[record.model] = { inputTokens: 0, outputTokens: 0, costCents: 0 };
            }
            summary.byModel[record.model].inputTokens += record.inputTokens;
            summary.byModel[record.model].outputTokens += record.outputTokens;
            summary.byModel[record.model].costCents += record.costCents;
            const projectKey = record.projectId || 'no-project';
            if (!summary.byProject[projectKey]) {
                summary.byProject[projectKey] = { inputTokens: 0, outputTokens: 0, costCents: 0 };
            }
            summary.byProject[projectKey].inputTokens += record.inputTokens;
            summary.byProject[projectKey].outputTokens += record.outputTokens;
            summary.byProject[projectKey].costCents += record.costCents;
        }
        return summary;
    }
    // === User Preferences ===
    async getUserPreferences(userId) {
        return this.userPreferences.get(userId) || null;
    }
    async upsertUserPreferences(userId, prefs) {
        const existing = this.userPreferences.get(userId);
        const updated = {
            userId,
            theme: prefs.theme || existing?.theme || 'auto',
            customIcons: prefs.customIcons || existing?.customIcons || {},
            githubToken: prefs.githubToken !== undefined ? prefs.githubToken : existing?.githubToken,
            githubUsername: prefs.githubUsername !== undefined ? prefs.githubUsername : existing?.githubUsername,
        };
        this.userPreferences.set(userId, updated);
        return updated;
    }
    // === Project Members ===
    async addProjectMember(projectId, userId, role, invitedBy) {
        const id = this.generateId();
        const member = {
            id,
            projectId,
            userId,
            role,
            invitedBy,
            invitedAt: new Date(),
            acceptedAt: role === 'owner' ? new Date() : undefined,
        };
        this.projectMembers.set(id, member);
        return member;
    }
    async getProjectMembers(projectId) {
        return Array.from(this.projectMembers.values()).filter(m => m.projectId === projectId);
    }
    async getProjectMember(projectId, userId) {
        for (const member of this.projectMembers.values()) {
            if (member.projectId === projectId && member.userId === userId) {
                return member;
            }
        }
        return null;
    }
    async updateProjectMember(id, updates) {
        const member = this.projectMembers.get(id);
        if (!member)
            return null;
        const updated = { ...member, ...updates };
        this.projectMembers.set(id, updated);
        return updated;
    }
    async removeProjectMember(id) {
        return this.projectMembers.delete(id);
    }
    async getProjectsForMember(userId) {
        const memberProjectIds = new Set();
        for (const member of this.projectMembers.values()) {
            if (member.userId === userId) {
                memberProjectIds.add(member.projectId);
            }
        }
        return Array.from(this.projects.values())
            .filter(p => memberProjectIds.has(p.id) && !p.archivedAt)
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    }
    // === Project Invites ===
    async createProjectInvite(projectId, email, role, invitedBy) {
        const id = this.generateId();
        const token = crypto.randomBytes(32).toString('hex');
        const createdAt = new Date();
        const invite = {
            id,
            projectId,
            email: email.toLowerCase(),
            role,
            token,
            invitedBy,
            createdAt,
            expiresAt: new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000),
        };
        this.projectInvites.set(id, invite);
        return invite;
    }
    async getProjectInvite(token) {
        for (const invite of this.projectInvites.values()) {
            if (invite.token === token)
                return invite;
        }
        return null;
    }
    async getProjectInvitesByProjectId(projectId) {
        return Array.from(this.projectInvites.values()).filter(i => i.projectId === projectId && !i.acceptedAt);
    }
    async acceptProjectInvite(token, userId) {
        const invite = await this.getProjectInvite(token);
        if (!invite || invite.acceptedAt || new Date() > invite.expiresAt)
            return null;
        invite.acceptedAt = new Date();
        return this.addProjectMember(invite.projectId, userId, invite.role, invite.invitedBy);
    }
    async deleteProjectInvite(id) {
        return this.projectInvites.delete(id);
    }
    // ==========================================================================
    // Foundational Data Layer - Contacts
    // ==========================================================================
    async createContact(tenantId, data) {
        const id = this.generateId();
        const now = new Date();
        const contact = { id, tenantId, ...data, createdAt: now, updatedAt: now };
        this.contacts.set(id, contact);
        return contact;
    }
    async getContactById(id) {
        return this.contacts.get(id) || null;
    }
    async getContactsByTenantId(tenantId, status) {
        return Array.from(this.contacts.values())
            .filter(c => c.tenantId === tenantId && (!status || c.status === status))
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    }
    async updateContact(id, updates) {
        const contact = this.contacts.get(id);
        if (!contact)
            return null;
        const updated = { ...contact, ...updates, updatedAt: new Date() };
        this.contacts.set(id, updated);
        return updated;
    }
    async deleteContact(id) {
        return this.contacts.delete(id);
    }
    async findContactByEmail(tenantId, email) {
        return Array.from(this.contacts.values()).find(c => c.tenantId === tenantId && c.email.toLowerCase() === email.toLowerCase()) || null;
    }
    // ==========================================================================
    // Foundational Data Layer - Notes
    // ==========================================================================
    async createNote(tenantId, data) {
        const id = this.generateId();
        const now = new Date();
        const note = { id, tenantId, ...data, createdAt: now, updatedAt: now };
        this.notes.set(id, note);
        return note;
    }
    async getNoteById(id) {
        return this.notes.get(id) || null;
    }
    async getNotesByContactId(contactId) {
        return Array.from(this.notes.values())
            .filter(n => n.contactId === contactId)
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    }
    async updateNote(id, updates) {
        const note = this.notes.get(id);
        if (!note)
            return null;
        const updated = { ...note, ...updates, updatedAt: new Date() };
        this.notes.set(id, updated);
        return updated;
    }
    async deleteNote(id) {
        return this.notes.delete(id);
    }
    // ==========================================================================
    // Foundational Data Layer - Contact Interactions
    // ==========================================================================
    async createContactInteraction(tenantId, data) {
        const id = this.generateId();
        const interaction = { id, tenantId, ...data, createdAt: new Date() };
        this.contactInteractions.set(id, interaction);
        return interaction;
    }
    async getContactInteractionById(id) {
        return this.contactInteractions.get(id) || null;
    }
    async getContactInteractionsByContactId(contactId) {
        return Array.from(this.contactInteractions.values())
            .filter(i => i.contactId === contactId)
            .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
    }
    async getContactInteractionsByTenantId(tenantId, startDate, endDate) {
        return Array.from(this.contactInteractions.values())
            .filter(i => {
            if (i.tenantId !== tenantId)
                return false;
            if (startDate && i.occurredAt < startDate)
                return false;
            if (endDate && i.occurredAt > endDate)
                return false;
            return true;
        })
            .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
    }
}
// Database client singleton - choose based on environment variable
let dbInstance = null;
export function getDatabase() {
    if (!dbInstance) {
        const usesSQLite = process.env.BRICK_DB === 'sqlite' || process.env.BRICK_DB_PATH;
        if (usesSQLite) {
            console.log('  Using SQLite database');
            dbInstance = new SQLiteClient();
        }
        else {
            console.log('  Using in-memory database');
            dbInstance = new InMemoryDB();
        }
    }
    return dbInstance;
}
// Backward compatible export
export const db = new Proxy({}, {
    get(_target, prop) {
        return getDatabase()[prop];
    }
});
// Seed test data
export async function seedDatabase() {
    const database = getDatabase();
    // Check if test user already exists
    const existingUser = await database.getUserByEmail('test@brick.studio');
    if (existingUser) {
        console.log('  Test user already exists');
        return;
    }
    // Create test user with pre-hashed password for "password123"
    const salt = 'a1b2c3d4e5f6g7h8';
    const hash = crypto
        .pbkdf2Sync('password123', salt, 10000, 64, 'sha512')
        .toString('hex');
    const passwordHash = `${salt}:${hash}`;
    const testUser = await database.createUser('test@brick.studio', passwordHash, 'Test User');
    console.log('  Created test user: test@brick.studio / password123');
    // Create a sample project
    const sampleProject = await database.createProject(testUser.id, 'E-Commerce Core', {
        components: [
            { id: 'A', name: 'Web Dashboard', type: 'static_site' },
            { id: 'B', name: 'Auth Service', type: 'service' },
            { id: 'C', name: 'Core API', type: 'service' },
            { id: 'D', name: 'PostgreSQL', type: 'database' },
        ],
        connections: [
            { from: 'A', to: 'B' },
            { from: 'A', to: 'C' },
            { from: 'B', to: 'D' },
            { from: 'C', to: 'D' },
        ],
    });
    console.log('  Created sample project: ' + sampleProject.name);
    // Create default preferences
    await database.upsertUserPreferences(testUser.id, { theme: 'dark' });
}
//# sourceMappingURL=client.js.map