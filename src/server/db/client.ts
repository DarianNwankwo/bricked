// Database client abstraction for Brick Platform
// Supports in-memory (default) and SQLite backends

import crypto from 'crypto';
import type {
  User,
  Project,
  Environment,
  Deployment,
  UsageRecord,
  AIUsageRecord,
  UserPreferences,
  ProjectMember,
  ProjectInvite,
  DatabaseClient,
  Contact,
  Note,
  ContactInteraction,
} from './schema.js';
import { SQLiteClient } from './sqlite-client.js';
import { PostgresClient } from './postgres-client.js';

// In-memory database implementation
class InMemoryDB implements DatabaseClient {
  private users: Map<string, User> = new Map();
  private usersByEmail: Map<string, User> = new Map();
  private projects: Map<string, Project> = new Map();
  private environments: Map<string, Environment> = new Map();
  private deployments: Map<string, Deployment> = new Map();
  private usageRecords: Map<string, UsageRecord> = new Map();
  private aiUsageRecords: Map<string, AIUsageRecord> = new Map();
  private userPreferences: Map<string, UserPreferences> = new Map();
  private projectMembers: Map<string, ProjectMember> = new Map();
  private projectInvites: Map<string, ProjectInvite> = new Map();

  // Foundational data layer
  private contacts: Map<string, Contact> = new Map();
  private notes: Map<string, Note> = new Map();
  private contactInteractions: Map<string, ContactInteraction> = new Map();

  private generateId(): string {
    return crypto.randomBytes(12).toString('hex');
  }

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 30);
  }

  // === Users ===
  async createUser(email: string, passwordHash: string, name: string): Promise<User> {
    const id = this.generateId();
    const user: User = {
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

  async getUserById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return this.usersByEmail.get(email.toLowerCase()) || null;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    const user = this.users.get(id);
    if (!user) return null;

    const updated = { ...user, ...updates };
    this.users.set(id, updated);
    this.usersByEmail.set(updated.email.toLowerCase(), updated);
    return updated;
  }

  // === Projects ===
  async createProject(userId: string, name: string, architecture: Project['architecture']): Promise<Project> {
    const id = this.generateId();
    const slug = this.slugify(name) + '-' + id.slice(0, 6);
    const project: Project = {
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
    for (const envName of ['development', 'staging', 'production'] as const) {
      await this.createEnvironment(id, envName);
    }

    // Add owner as project member
    await this.addProjectMember(id, userId, 'owner', userId);

    return project;
  }

  async getProjectById(id: string): Promise<Project | null> {
    return this.projects.get(id) || null;
  }

  async getProjectsByUserId(userId: string, includeArchived = false): Promise<Project[]> {
    return Array.from(this.projects.values())
      .filter(p => p.userId === userId && (includeArchived || !p.archivedAt))
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<Project | null> {
    const project = this.projects.get(id);
    if (!project) return null;

    const updated = { ...project, ...updates, updatedAt: new Date() };
    this.projects.set(id, updated);
    return updated;
  }

  async deleteProject(id: string): Promise<boolean> {
    const envs = await this.getEnvironmentsByProjectId(id);
    for (const env of envs) {
      this.environments.delete(env.id);
    }
    // Delete members and invites
    for (const [memberId, member] of this.projectMembers) {
      if (member.projectId === id) this.projectMembers.delete(memberId);
    }
    for (const [inviteId, invite] of this.projectInvites) {
      if (invite.projectId === id) this.projectInvites.delete(inviteId);
    }
    return this.projects.delete(id);
  }

  async archiveProject(id: string, userId: string): Promise<Project | null> {
    const project = this.projects.get(id);
    if (!project) return null;

    const updated: Project = {
      ...project,
      archivedAt: new Date(),
      archivedBy: userId,
      updatedAt: new Date(),
    };
    this.projects.set(id, updated);
    return updated;
  }

  async restoreProject(id: string): Promise<Project | null> {
    const project = this.projects.get(id);
    if (!project) return null;

    const updated: Project = {
      ...project,
      archivedAt: undefined,
      archivedBy: undefined,
      updatedAt: new Date(),
    };
    this.projects.set(id, updated);
    return updated;
  }

  // === Environments ===
  async createEnvironment(projectId: string, name: Environment['name']): Promise<Environment> {
    const id = this.generateId();
    const env: Environment = {
      id,
      projectId,
      name,
      status: 'not_deployed',
      monthlyCostCents: 0,
    };
    this.environments.set(id, env);
    return env;
  }

  async getEnvironmentById(id: string): Promise<Environment | null> {
    return this.environments.get(id) || null;
  }

  async getEnvironmentsByProjectId(projectId: string): Promise<Environment[]> {
    return Array.from(this.environments.values()).filter(e => e.projectId === projectId);
  }

  async updateEnvironment(id: string, updates: Partial<Environment>): Promise<Environment | null> {
    const env = this.environments.get(id);
    if (!env) return null;

    const updated = { ...env, ...updates };
    this.environments.set(id, updated);
    return updated;
  }

  // === Deployments ===
  async createDeployment(environmentId: string, projectId: string, userId: string): Promise<Deployment> {
    const id = this.generateId();
    const deployment: Deployment = {
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

  async getDeploymentById(id: string): Promise<Deployment | null> {
    return this.deployments.get(id) || null;
  }

  async getDeploymentsByEnvironmentId(environmentId: string): Promise<Deployment[]> {
    return Array.from(this.deployments.values())
      .filter(d => d.environmentId === environmentId)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  }

  async updateDeployment(id: string, updates: Partial<Deployment>): Promise<Deployment | null> {
    const deployment = this.deployments.get(id);
    if (!deployment) return null;

    const updated = { ...deployment, ...updates };
    this.deployments.set(id, updated);
    return updated;
  }

  async appendDeploymentLog(id: string, log: string): Promise<void> {
    const deployment = this.deployments.get(id);
    if (deployment) {
      deployment.logs.push(`[${new Date().toISOString()}] ${log}`);
    }
  }

  // === Usage Records ===
  async createUsageRecord(record: Omit<UsageRecord, 'id'>): Promise<UsageRecord> {
    const id = this.generateId();
    const usage: UsageRecord = { id, ...record };
    this.usageRecords.set(id, usage);
    return usage;
  }

  async getUsageByUserId(userId: string, startDate: Date, endDate: Date): Promise<UsageRecord[]> {
    return Array.from(this.usageRecords.values()).filter(
      r => r.userId === userId && r.periodStart >= startDate && r.periodEnd <= endDate
    );
  }

  // === AI Usage Records ===
  async createAIUsageRecord(record: Omit<AIUsageRecord, 'id'>): Promise<AIUsageRecord> {
    const id = this.generateId();
    const usage: AIUsageRecord = { id, ...record };
    this.aiUsageRecords.set(id, usage);
    return usage;
  }

  async getAIUsageByUserId(userId: string, startDate?: Date, endDate?: Date): Promise<AIUsageRecord[]> {
    return Array.from(this.aiUsageRecords.values())
      .filter(r => {
        if (r.userId !== userId) return false;
        if (startDate && r.createdAt < startDate) return false;
        if (endDate && r.createdAt > endDate) return false;
        return true;
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getAIUsageByProjectId(projectId: string): Promise<AIUsageRecord[]> {
    return Array.from(this.aiUsageRecords.values())
      .filter(r => r.projectId === projectId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getAIUsageSummary(userId: string, startDate: Date, endDate: Date): Promise<{
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCostCents: number;
    premiumCostCents: number;
    standardCostCents: number;
    byModel: Record<string, { inputTokens: number; outputTokens: number; costCents: number }>;
    byProject: Record<string, { inputTokens: number; outputTokens: number; costCents: number }>;
  }> {
    const records = await this.getAIUsageByUserId(userId, startDate, endDate);

    const summary = {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCostCents: 0,
      premiumCostCents: 0,
      standardCostCents: 0,
      byModel: {} as Record<string, { inputTokens: number; outputTokens: number; costCents: number }>,
      byProject: {} as Record<string, { inputTokens: number; outputTokens: number; costCents: number }>,
    };

    for (const record of records) {
      summary.totalInputTokens += record.inputTokens;
      summary.totalOutputTokens += record.outputTokens;
      summary.totalCostCents += record.costCents;

      if (record.isPremium) {
        summary.premiumCostCents += record.costCents;
      } else {
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
  async getUserPreferences(userId: string): Promise<UserPreferences | null> {
    return this.userPreferences.get(userId) || null;
  }

  async upsertUserPreferences(userId: string, prefs: Partial<UserPreferences>): Promise<UserPreferences> {
    const existing = this.userPreferences.get(userId);
    const updated: UserPreferences = {
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
  async addProjectMember(projectId: string, userId: string, role: ProjectMember['role'], invitedBy: string): Promise<ProjectMember> {
    const id = this.generateId();
    const member: ProjectMember = {
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

  async getProjectMembers(projectId: string): Promise<ProjectMember[]> {
    return Array.from(this.projectMembers.values()).filter(m => m.projectId === projectId);
  }

  async getProjectMember(projectId: string, userId: string): Promise<ProjectMember | null> {
    for (const member of this.projectMembers.values()) {
      if (member.projectId === projectId && member.userId === userId) {
        return member;
      }
    }
    return null;
  }

  async updateProjectMember(id: string, updates: Partial<ProjectMember>): Promise<ProjectMember | null> {
    const member = this.projectMembers.get(id);
    if (!member) return null;

    const updated = { ...member, ...updates };
    this.projectMembers.set(id, updated);
    return updated;
  }

  async removeProjectMember(id: string): Promise<boolean> {
    return this.projectMembers.delete(id);
  }

  async getProjectsForMember(userId: string): Promise<Project[]> {
    const memberProjectIds = new Set<string>();
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
  async createProjectInvite(projectId: string, email: string, role: ProjectInvite['role'], invitedBy: string): Promise<ProjectInvite> {
    const id = this.generateId();
    const token = crypto.randomBytes(32).toString('hex');
    const createdAt = new Date();
    const invite: ProjectInvite = {
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

  async getProjectInvite(token: string): Promise<ProjectInvite | null> {
    for (const invite of this.projectInvites.values()) {
      if (invite.token === token) return invite;
    }
    return null;
  }

  async getProjectInvitesByProjectId(projectId: string): Promise<ProjectInvite[]> {
    return Array.from(this.projectInvites.values()).filter(
      i => i.projectId === projectId && !i.acceptedAt
    );
  }

  async acceptProjectInvite(token: string, userId: string): Promise<ProjectMember | null> {
    const invite = await this.getProjectInvite(token);
    if (!invite || invite.acceptedAt || new Date() > invite.expiresAt) return null;

    invite.acceptedAt = new Date();
    return this.addProjectMember(invite.projectId, userId, invite.role, invite.invitedBy);
  }

  async deleteProjectInvite(id: string): Promise<boolean> {
    return this.projectInvites.delete(id);
  }

  // ==========================================================================
  // Foundational Data Layer - Contacts
  // ==========================================================================

  async createContact(tenantId: string, data: Omit<Contact, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>): Promise<Contact> {
    const id = this.generateId();
    const now = new Date();
    const contact: Contact = { id, tenantId, ...data, createdAt: now, updatedAt: now };
    this.contacts.set(id, contact);
    return contact;
  }

  async getContactById(id: string): Promise<Contact | null> {
    return this.contacts.get(id) || null;
  }

  async getContactsByTenantId(tenantId: string, status?: Contact['status']): Promise<Contact[]> {
    return Array.from(this.contacts.values())
      .filter(c => c.tenantId === tenantId && (!status || c.status === status))
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async updateContact(id: string, updates: Partial<Contact>): Promise<Contact | null> {
    const contact = this.contacts.get(id);
    if (!contact) return null;
    const updated = { ...contact, ...updates, updatedAt: new Date() };
    this.contacts.set(id, updated);
    return updated;
  }

  async deleteContact(id: string): Promise<boolean> {
    return this.contacts.delete(id);
  }

  async findContactByEmail(tenantId: string, email: string): Promise<Contact | null> {
    return Array.from(this.contacts.values()).find(
      c => c.tenantId === tenantId && c.email.toLowerCase() === email.toLowerCase()
    ) || null;
  }

  // ==========================================================================
  // Foundational Data Layer - Notes
  // ==========================================================================

  async createNote(tenantId: string, data: Omit<Note, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>): Promise<Note> {
    const id = this.generateId();
    const now = new Date();
    const note: Note = { id, tenantId, ...data, createdAt: now, updatedAt: now };
    this.notes.set(id, note);
    return note;
  }

  async getNoteById(id: string): Promise<Note | null> {
    return this.notes.get(id) || null;
  }

  async getNotesByContactId(contactId: string): Promise<Note[]> {
    return Array.from(this.notes.values())
      .filter(n => n.contactId === contactId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async updateNote(id: string, updates: Partial<Note>): Promise<Note | null> {
    const note = this.notes.get(id);
    if (!note) return null;
    const updated = { ...note, ...updates, updatedAt: new Date() };
    this.notes.set(id, updated);
    return updated;
  }

  async deleteNote(id: string): Promise<boolean> {
    return this.notes.delete(id);
  }

  // ==========================================================================
  // Foundational Data Layer - Contact Interactions
  // ==========================================================================

  async createContactInteraction(tenantId: string, data: Omit<ContactInteraction, 'id' | 'tenantId' | 'createdAt'>): Promise<ContactInteraction> {
    const id = this.generateId();
    const interaction: ContactInteraction = { id, tenantId, ...data, createdAt: new Date() };
    this.contactInteractions.set(id, interaction);
    return interaction;
  }

  async getContactInteractionById(id: string): Promise<ContactInteraction | null> {
    return this.contactInteractions.get(id) || null;
  }

  async getContactInteractionsByContactId(contactId: string): Promise<ContactInteraction[]> {
    return Array.from(this.contactInteractions.values())
      .filter(i => i.contactId === contactId)
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  }

  async getContactInteractionsByTenantId(tenantId: string, startDate?: Date, endDate?: Date): Promise<ContactInteraction[]> {
    return Array.from(this.contactInteractions.values())
      .filter(i => {
        if (i.tenantId !== tenantId) return false;
        if (startDate && i.occurredAt < startDate) return false;
        if (endDate && i.occurredAt > endDate) return false;
        return true;
      })
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  }

}

// Database client singleton - choose based on environment variable
let dbInstance: DatabaseClient | null = null;

export function getDatabase(): DatabaseClient {
  if (!dbInstance) {
    if (process.env.DATABASE_URL) {
      console.log('  Using PostgreSQL database');
      dbInstance = new PostgresClient();
    } else if (process.env.BRICK_DB === 'sqlite' || process.env.BRICK_DB_PATH) {
      console.log('  Using SQLite database');
      dbInstance = new SQLiteClient();
    } else {
      console.log('  Using in-memory database');
      dbInstance = new InMemoryDB();
    }
  }
  return dbInstance;
}

// Backward compatible export
export const db = new Proxy({} as DatabaseClient, {
  get(_target, prop) {
    return (getDatabase() as unknown as Record<string, unknown>)[prop as string];
  }
});

// Seed test data
export async function seedDatabase(): Promise<void> {
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
