// SQLite database client for Brick Platform
// Persistent storage with better-sqlite3

import Database from 'better-sqlite3';
import crypto from 'crypto';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync } from 'fs';
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
  Feature,
  Message,
  ProjectFile,
  Contact,
  Note,
  ContactInteraction,
} from './schema.js';

// Get database path - store in data directory
function getDatabasePath(): string {
  const dbPath = process.env.BRICK_DB_PATH;
  if (dbPath) return dbPath;

  // Default to project's data directory
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const dataDir = join(__dirname, '..', '..', '..', 'data');

  // Ensure data directory exists
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  return join(dataDir, 'brick.db');
}

export class SQLiteClient implements DatabaseClient {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const path = dbPath || getDatabasePath();
    console.log(`  SQLite database: ${path}`);
    this.db = new Database(path);
    this.db.pragma('journal_mode = WAL');
    this.initializeTables();
  }

  private initializeTables(): void {
    // Users table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        stripe_customer_id TEXT
      )
    `);

    // Projects table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        slug TEXT NOT NULL,
        documentation TEXT DEFAULT '',
        architecture TEXT NOT NULL,
        connection_labels TEXT DEFAULT '{}',
        bac TEXT,
        diagram TEXT,
        component_specs TEXT DEFAULT '{}',
        last_generated_components TEXT DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        archived_at TEXT,
        archived_by TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Add columns if they don't exist (for existing databases)
    try { this.db.exec('ALTER TABLE projects ADD COLUMN bac TEXT'); } catch {}
    try { this.db.exec('ALTER TABLE projects ADD COLUMN diagram TEXT'); } catch {}
    try { this.db.exec("ALTER TABLE projects ADD COLUMN component_specs TEXT DEFAULT '{}'"); } catch {}
    try { this.db.exec("ALTER TABLE projects ADD COLUMN last_generated_components TEXT DEFAULT '[]'"); } catch {}

    // Environments table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS environments (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'not_deployed',
        do_app_id TEXT,
        url TEXT,
        last_deployed_at TEXT,
        monthly_cost_cents INTEGER DEFAULT 0,
        FOREIGN KEY (project_id) REFERENCES projects(id)
      )
    `);

    // Deployments table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS deployments (
        id TEXT PRIMARY KEY,
        environment_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        do_app_id TEXT,
        url TEXT,
        logs TEXT DEFAULT '[]',
        started_at TEXT NOT NULL,
        completed_at TEXT,
        error TEXT,
        FOREIGN KEY (environment_id) REFERENCES environments(id),
        FOREIGN KEY (project_id) REFERENCES projects(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Usage records table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS usage_records (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        environment_id TEXT NOT NULL,
        period_start TEXT NOT NULL,
        period_end TEXT NOT NULL,
        compute_minutes INTEGER DEFAULT 0,
        bandwidth_gb REAL DEFAULT 0,
        cost_cents INTEGER DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // AI Usage records table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ai_usage_records (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        project_id TEXT,
        model TEXT NOT NULL,
        provider TEXT NOT NULL,
        input_tokens INTEGER NOT NULL,
        output_tokens INTEGER NOT NULL,
        is_premium INTEGER NOT NULL,
        cost_cents INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // User preferences table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        user_id TEXT PRIMARY KEY,
        theme TEXT DEFAULT 'auto',
        custom_icons TEXT DEFAULT '{}',
        github_token TEXT,
        github_username TEXT,
        preferred_model TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Project members table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS project_members (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL,
        invited_by TEXT NOT NULL,
        invited_at TEXT NOT NULL,
        accepted_at TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE(project_id, user_id)
      )
    `);

    // Project invites table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS project_invites (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        email TEXT NOT NULL,
        role TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        invited_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        accepted_at TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id)
      )
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
      CREATE INDEX IF NOT EXISTS idx_environments_project_id ON environments(project_id);
      CREATE INDEX IF NOT EXISTS idx_deployments_environment_id ON deployments(environment_id);
      CREATE INDEX IF NOT EXISTS idx_ai_usage_user_id ON ai_usage_records(user_id);
      CREATE INDEX IF NOT EXISTS idx_ai_usage_created_at ON ai_usage_records(created_at);
      CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members(user_id);
      CREATE INDEX IF NOT EXISTS idx_project_invites_token ON project_invites(token);
    `);

    // =========================================================================
    // Features, Messages, and Project Files Tables
    // =========================================================================

    // Features table for the Kanban board
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS features (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'backlog',
        agent_status TEXT,
        agent_message TEXT,
        position INTEGER DEFAULT 0,
        timer_end TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `);

    // Messages table for chat history persistence
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        context_mode TEXT DEFAULT 'architecture',
        metadata TEXT DEFAULT '{}',
        created_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Project files table for generated code persistence
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS project_files (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        path TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        component_id TEXT,
        is_manually_edited INTEGER DEFAULT 0,
        generated_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        UNIQUE(project_id, path)
      )
    `);

    // Features/Messages/Files indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_features_project ON features(project_id);
      CREATE INDEX IF NOT EXISTS idx_messages_project ON messages(project_id);
      CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
      CREATE INDEX IF NOT EXISTS idx_project_files_project ON project_files(project_id);
    `);

    // =========================================================================
    // Foundational Data Layer Tables
    // =========================================================================

    // Contacts table (platform-level, used by all verticals)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        timezone TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        metadata TEXT DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (tenant_id) REFERENCES users(id)
      )
    `);

    // Notes table (platform-level, per-contact notes)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        contact_id TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        tags TEXT DEFAULT '[]',
        metadata TEXT DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (tenant_id) REFERENCES users(id),
        FOREIGN KEY (contact_id) REFERENCES contacts(id)
      )
    `);

    // Contact interactions table (platform-level, event-sourced touchpoints)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS contact_interactions (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        contact_id TEXT NOT NULL,
        type TEXT NOT NULL,
        channel TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        occurred_at TEXT NOT NULL,
        metadata TEXT DEFAULT '{}',
        created_at TEXT NOT NULL,
        FOREIGN KEY (tenant_id) REFERENCES users(id),
        FOREIGN KEY (contact_id) REFERENCES contacts(id)
      )
    `);

    // Foundational data indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_contacts_tenant_id ON contacts(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(tenant_id, email);
      CREATE INDEX IF NOT EXISTS idx_notes_contact_id ON notes(contact_id);
      CREATE INDEX IF NOT EXISTS idx_notes_tenant_id ON notes(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_interactions_contact_id ON contact_interactions(contact_id);
      CREATE INDEX IF NOT EXISTS idx_interactions_tenant_id ON contact_interactions(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_interactions_occurred_at ON contact_interactions(occurred_at);
    `);

  }

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
    const createdAt = new Date();

    const stmt = this.db.prepare(`
      INSERT INTO users (id, email, password_hash, name, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, email.toLowerCase(), passwordHash, name, createdAt.toISOString());

    return { id, email: email.toLowerCase(), passwordHash, name, createdAt };
  }

  async getUserById(id: string): Promise<User | null> {
    const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    if (!row) return null;

    return {
      id: row.id as string,
      email: row.email as string,
      passwordHash: row.password_hash as string,
      name: row.name as string,
      createdAt: new Date(row.created_at as string),
      stripeCustomerId: row.stripe_customer_id as string | undefined,
    };
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const stmt = this.db.prepare('SELECT * FROM users WHERE email = ?');
    const row = stmt.get(email.toLowerCase()) as Record<string, unknown> | undefined;
    if (!row) return null;

    return {
      id: row.id as string,
      email: row.email as string,
      passwordHash: row.password_hash as string,
      name: row.name as string,
      createdAt: new Date(row.created_at as string),
      stripeCustomerId: row.stripe_customer_id as string | undefined,
    };
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    const user = await this.getUserById(id);
    if (!user) return null;

    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.email) {
      fields.push('email = ?');
      values.push(updates.email.toLowerCase());
    }
    if (updates.passwordHash) {
      fields.push('password_hash = ?');
      values.push(updates.passwordHash);
    }
    if (updates.name) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.stripeCustomerId !== undefined) {
      fields.push('stripe_customer_id = ?');
      values.push(updates.stripeCustomerId);
    }

    if (fields.length > 0) {
      values.push(id);
      const stmt = this.db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`);
      stmt.run(...values);
    }

    return this.getUserById(id);
  }

  // === Projects ===
  async createProject(userId: string, name: string, architecture: Project['architecture']): Promise<Project> {
    const id = this.generateId();
    const slug = this.slugify(name) + '-' + id.slice(0, 6);
    const now = new Date();

    const stmt = this.db.prepare(`
      INSERT INTO projects (id, user_id, name, slug, documentation, architecture, connection_labels, created_at, updated_at)
      VALUES (?, ?, ?, ?, '', ?, '{}', ?, ?)
    `);
    stmt.run(id, userId, name, slug, JSON.stringify(architecture), now.toISOString(), now.toISOString());

    // Auto-create environments
    for (const envName of ['development', 'staging', 'production'] as const) {
      await this.createEnvironment(id, envName);
    }

    // Add owner as project member
    await this.addProjectMember(id, userId, 'owner', userId);

    return {
      id,
      userId,
      name,
      slug,
      documentation: '',
      architecture,
      connectionLabels: {},
      createdAt: now,
      updatedAt: now,
    };
  }

  async getProjectById(id: string): Promise<Project | null> {
    const stmt = this.db.prepare('SELECT * FROM projects WHERE id = ?');
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    if (!row) return null;

    return this.rowToProject(row);
  }

  private rowToProject(row: Record<string, unknown>): Project {
    const parseJson = (val: unknown) => {
      if (val == null) return null;
      if (typeof val === 'string') { try { return JSON.parse(val); } catch { return null; } }
      return val;
    };
    return {
      id: row.id as string,
      userId: row.user_id as string,
      name: row.name as string,
      slug: row.slug as string,
      documentation: row.documentation as string,
      architecture: JSON.parse(row.architecture as string),
      connectionLabels: JSON.parse((row.connection_labels as string) || '{}'),
      bac: parseJson(row.bac) as Project['bac'],
      componentSpecs: (parseJson(row.component_specs) as Project['componentSpecs']) || {},
      diagram: (row.diagram as string) || null,
      lastGeneratedComponents: (parseJson(row.last_generated_components) as Project['lastGeneratedComponents']) || [],
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
      archivedAt: row.archived_at ? new Date(row.archived_at as string) : undefined,
      archivedBy: row.archived_by as string | undefined,
    };
  }

  async getProjectsByUserId(userId: string, includeArchived = false): Promise<Project[]> {
    let query = 'SELECT * FROM projects WHERE user_id = ?';
    if (!includeArchived) {
      query += ' AND archived_at IS NULL';
    }
    query += ' ORDER BY updated_at DESC';

    const stmt = this.db.prepare(query);
    const rows = stmt.all(userId) as Record<string, unknown>[];
    return rows.map(row => this.rowToProject(row));
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<Project | null> {
    const project = await this.getProjectById(id);
    if (!project) return null;

    const fields: string[] = ['updated_at = ?'];
    const values: unknown[] = [new Date().toISOString()];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.documentation !== undefined) {
      fields.push('documentation = ?');
      values.push(updates.documentation);
    }
    if (updates.architecture !== undefined) {
      fields.push('architecture = ?');
      values.push(JSON.stringify(updates.architecture));
    }
    if (updates.connectionLabels !== undefined) {
      fields.push('connection_labels = ?');
      values.push(JSON.stringify(updates.connectionLabels));
    }
    if (updates.bac !== undefined) {
      fields.push('bac = ?');
      values.push(updates.bac ? JSON.stringify(updates.bac) : null);
    }
    if (updates.componentSpecs !== undefined) {
      fields.push('component_specs = ?');
      values.push(JSON.stringify(updates.componentSpecs));
    }
    if (updates.diagram !== undefined) {
      fields.push('diagram = ?');
      values.push(updates.diagram);
    }
    if (updates.lastGeneratedComponents !== undefined) {
      fields.push('last_generated_components = ?');
      values.push(JSON.stringify(updates.lastGeneratedComponents));
    }

    values.push(id);
    const stmt = this.db.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    return this.getProjectById(id);
  }

  async deleteProject(id: string): Promise<boolean> {
    // Delete associated data
    this.db.prepare('DELETE FROM project_members WHERE project_id = ?').run(id);
    this.db.prepare('DELETE FROM project_invites WHERE project_id = ?').run(id);
    this.db.prepare('DELETE FROM deployments WHERE project_id = ?').run(id);
    this.db.prepare('DELETE FROM environments WHERE project_id = ?').run(id);

    const result = this.db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    return result.changes > 0;
  }

  async archiveProject(id: string, userId: string): Promise<Project | null> {
    const stmt = this.db.prepare(`
      UPDATE projects SET archived_at = ?, archived_by = ?, updated_at = ?
      WHERE id = ?
    `);
    const now = new Date().toISOString();
    stmt.run(now, userId, now, id);
    return this.getProjectById(id);
  }

  async restoreProject(id: string): Promise<Project | null> {
    const stmt = this.db.prepare(`
      UPDATE projects SET archived_at = NULL, archived_by = NULL, updated_at = ?
      WHERE id = ?
    `);
    stmt.run(new Date().toISOString(), id);
    return this.getProjectById(id);
  }

  // === Environments ===
  async createEnvironment(projectId: string, name: Environment['name']): Promise<Environment> {
    const id = this.generateId();
    const stmt = this.db.prepare(`
      INSERT INTO environments (id, project_id, name, status, monthly_cost_cents)
      VALUES (?, ?, ?, 'not_deployed', 0)
    `);
    stmt.run(id, projectId, name);

    return {
      id,
      projectId,
      name,
      status: 'not_deployed',
      monthlyCostCents: 0,
    };
  }

  async getEnvironmentById(id: string): Promise<Environment | null> {
    const stmt = this.db.prepare('SELECT * FROM environments WHERE id = ?');
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    if (!row) return null;

    return {
      id: row.id as string,
      projectId: row.project_id as string,
      name: row.name as Environment['name'],
      status: row.status as Environment['status'],
      doAppId: row.do_app_id as string | undefined,
      url: row.url as string | undefined,
      lastDeployedAt: row.last_deployed_at ? new Date(row.last_deployed_at as string) : undefined,
      monthlyCostCents: row.monthly_cost_cents as number,
    };
  }

  async getEnvironmentsByProjectId(projectId: string): Promise<Environment[]> {
    const stmt = this.db.prepare('SELECT * FROM environments WHERE project_id = ?');
    const rows = stmt.all(projectId) as Record<string, unknown>[];
    return rows.map(row => ({
      id: row.id as string,
      projectId: row.project_id as string,
      name: row.name as Environment['name'],
      status: row.status as Environment['status'],
      doAppId: row.do_app_id as string | undefined,
      url: row.url as string | undefined,
      lastDeployedAt: row.last_deployed_at ? new Date(row.last_deployed_at as string) : undefined,
      monthlyCostCents: row.monthly_cost_cents as number,
    }));
  }

  async updateEnvironment(id: string, updates: Partial<Environment>): Promise<Environment | null> {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.doAppId !== undefined) {
      fields.push('do_app_id = ?');
      values.push(updates.doAppId);
    }
    if (updates.url !== undefined) {
      fields.push('url = ?');
      values.push(updates.url);
    }
    if (updates.lastDeployedAt !== undefined) {
      fields.push('last_deployed_at = ?');
      values.push(updates.lastDeployedAt?.toISOString() || null);
    }
    if (updates.monthlyCostCents !== undefined) {
      fields.push('monthly_cost_cents = ?');
      values.push(updates.monthlyCostCents);
    }

    if (fields.length > 0) {
      values.push(id);
      const stmt = this.db.prepare(`UPDATE environments SET ${fields.join(', ')} WHERE id = ?`);
      stmt.run(...values);
    }

    return this.getEnvironmentById(id);
  }

  // === Deployments ===
  async createDeployment(environmentId: string, projectId: string, userId: string): Promise<Deployment> {
    const id = this.generateId();
    const startedAt = new Date();

    const stmt = this.db.prepare(`
      INSERT INTO deployments (id, environment_id, project_id, user_id, status, logs, started_at)
      VALUES (?, ?, ?, ?, 'pending', '[]', ?)
    `);
    stmt.run(id, environmentId, projectId, userId, startedAt.toISOString());

    return {
      id,
      environmentId,
      projectId,
      userId,
      status: 'pending',
      logs: [],
      startedAt,
    };
  }

  async getDeploymentById(id: string): Promise<Deployment | null> {
    const stmt = this.db.prepare('SELECT * FROM deployments WHERE id = ?');
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    if (!row) return null;

    return {
      id: row.id as string,
      environmentId: row.environment_id as string,
      projectId: row.project_id as string,
      userId: row.user_id as string,
      status: row.status as Deployment['status'],
      doAppId: row.do_app_id as string | undefined,
      url: row.url as string | undefined,
      logs: JSON.parse(row.logs as string),
      startedAt: new Date(row.started_at as string),
      completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
      error: row.error as string | undefined,
    };
  }

  async getDeploymentsByEnvironmentId(environmentId: string): Promise<Deployment[]> {
    const stmt = this.db.prepare(
      'SELECT * FROM deployments WHERE environment_id = ? ORDER BY started_at DESC'
    );
    const rows = stmt.all(environmentId) as Record<string, unknown>[];
    return rows.map(row => ({
      id: row.id as string,
      environmentId: row.environment_id as string,
      projectId: row.project_id as string,
      userId: row.user_id as string,
      status: row.status as Deployment['status'],
      doAppId: row.do_app_id as string | undefined,
      url: row.url as string | undefined,
      logs: JSON.parse(row.logs as string),
      startedAt: new Date(row.started_at as string),
      completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
      error: row.error as string | undefined,
    }));
  }

  async updateDeployment(id: string, updates: Partial<Deployment>): Promise<Deployment | null> {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.doAppId !== undefined) {
      fields.push('do_app_id = ?');
      values.push(updates.doAppId);
    }
    if (updates.url !== undefined) {
      fields.push('url = ?');
      values.push(updates.url);
    }
    if (updates.completedAt !== undefined) {
      fields.push('completed_at = ?');
      values.push(updates.completedAt?.toISOString() || null);
    }
    if (updates.error !== undefined) {
      fields.push('error = ?');
      values.push(updates.error);
    }
    if (updates.logs !== undefined) {
      fields.push('logs = ?');
      values.push(JSON.stringify(updates.logs));
    }

    if (fields.length > 0) {
      values.push(id);
      const stmt = this.db.prepare(`UPDATE deployments SET ${fields.join(', ')} WHERE id = ?`);
      stmt.run(...values);
    }

    return this.getDeploymentById(id);
  }

  async appendDeploymentLog(id: string, log: string): Promise<void> {
    const deployment = await this.getDeploymentById(id);
    if (deployment) {
      deployment.logs.push(`[${new Date().toISOString()}] ${log}`);
      const stmt = this.db.prepare('UPDATE deployments SET logs = ? WHERE id = ?');
      stmt.run(JSON.stringify(deployment.logs), id);
    }
  }

  // === Usage Records ===
  async createUsageRecord(record: Omit<UsageRecord, 'id'>): Promise<UsageRecord> {
    const id = this.generateId();
    const stmt = this.db.prepare(`
      INSERT INTO usage_records (id, user_id, project_id, environment_id, period_start, period_end, compute_minutes, bandwidth_gb, cost_cents)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      record.userId,
      record.projectId,
      record.environmentId,
      record.periodStart.toISOString(),
      record.periodEnd.toISOString(),
      record.computeMinutes,
      record.bandwidthGb,
      record.costCents
    );
    return { id, ...record };
  }

  async getUsageByUserId(userId: string, startDate: Date, endDate: Date): Promise<UsageRecord[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM usage_records
      WHERE user_id = ? AND period_start >= ? AND period_end <= ?
    `);
    const rows = stmt.all(userId, startDate.toISOString(), endDate.toISOString()) as Record<string, unknown>[];
    return rows.map(row => ({
      id: row.id as string,
      userId: row.user_id as string,
      projectId: row.project_id as string,
      environmentId: row.environment_id as string,
      periodStart: new Date(row.period_start as string),
      periodEnd: new Date(row.period_end as string),
      computeMinutes: row.compute_minutes as number,
      bandwidthGb: row.bandwidth_gb as number,
      costCents: row.cost_cents as number,
    }));
  }

  // === AI Usage Records ===
  async createAIUsageRecord(record: Omit<AIUsageRecord, 'id'>): Promise<AIUsageRecord> {
    const id = this.generateId();
    const stmt = this.db.prepare(`
      INSERT INTO ai_usage_records (id, user_id, project_id, model, provider, input_tokens, output_tokens, is_premium, cost_cents, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      record.userId,
      record.projectId || null,
      record.model,
      record.provider,
      record.inputTokens,
      record.outputTokens,
      record.isPremium ? 1 : 0,
      record.costCents,
      record.createdAt.toISOString()
    );
    return { id, ...record };
  }

  async getAIUsageByUserId(userId: string, startDate?: Date, endDate?: Date): Promise<AIUsageRecord[]> {
    let query = 'SELECT * FROM ai_usage_records WHERE user_id = ?';
    const params: unknown[] = [userId];

    if (startDate) {
      query += ' AND created_at >= ?';
      params.push(startDate.toISOString());
    }
    if (endDate) {
      query += ' AND created_at <= ?';
      params.push(endDate.toISOString());
    }
    query += ' ORDER BY created_at DESC';

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as Record<string, unknown>[];
    return rows.map(row => ({
      id: row.id as string,
      userId: row.user_id as string,
      projectId: row.project_id as string | undefined,
      model: row.model as string,
      provider: row.provider as string,
      inputTokens: row.input_tokens as number,
      outputTokens: row.output_tokens as number,
      isPremium: Boolean(row.is_premium),
      costCents: row.cost_cents as number,
      createdAt: new Date(row.created_at as string),
    }));
  }

  async getAIUsageByProjectId(projectId: string): Promise<AIUsageRecord[]> {
    const stmt = this.db.prepare(
      'SELECT * FROM ai_usage_records WHERE project_id = ? ORDER BY created_at DESC'
    );
    const rows = stmt.all(projectId) as Record<string, unknown>[];
    return rows.map(row => ({
      id: row.id as string,
      userId: row.user_id as string,
      projectId: row.project_id as string | undefined,
      model: row.model as string,
      provider: row.provider as string,
      inputTokens: row.input_tokens as number,
      outputTokens: row.output_tokens as number,
      isPremium: Boolean(row.is_premium),
      costCents: row.cost_cents as number,
      createdAt: new Date(row.created_at as string),
    }));
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

      // By model
      if (!summary.byModel[record.model]) {
        summary.byModel[record.model] = { inputTokens: 0, outputTokens: 0, costCents: 0 };
      }
      summary.byModel[record.model].inputTokens += record.inputTokens;
      summary.byModel[record.model].outputTokens += record.outputTokens;
      summary.byModel[record.model].costCents += record.costCents;

      // By project
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
    const stmt = this.db.prepare('SELECT * FROM user_preferences WHERE user_id = ?');
    const row = stmt.get(userId) as Record<string, unknown> | undefined;
    if (!row) return null;

    return {
      userId: row.user_id as string,
      theme: row.theme as UserPreferences['theme'],
      customIcons: JSON.parse((row.custom_icons as string) || '{}'),
      githubToken: row.github_token as string | undefined,
      githubUsername: row.github_username as string | undefined,
      preferredModel: row.preferred_model as string | undefined,
    };
  }

  async upsertUserPreferences(userId: string, prefs: Partial<UserPreferences>): Promise<UserPreferences> {
    const existing = await this.getUserPreferences(userId);

    if (existing) {
      const fields: string[] = [];
      const values: unknown[] = [];

      if (prefs.theme !== undefined) {
        fields.push('theme = ?');
        values.push(prefs.theme);
      }
      if (prefs.customIcons !== undefined) {
        fields.push('custom_icons = ?');
        values.push(JSON.stringify(prefs.customIcons));
      }
      if (prefs.githubToken !== undefined) {
        fields.push('github_token = ?');
        values.push(prefs.githubToken);
      }
      if (prefs.githubUsername !== undefined) {
        fields.push('github_username = ?');
        values.push(prefs.githubUsername);
      }
      if (prefs.preferredModel !== undefined) {
        fields.push('preferred_model = ?');
        values.push(prefs.preferredModel);
      }

      if (fields.length > 0) {
        values.push(userId);
        const stmt = this.db.prepare(`UPDATE user_preferences SET ${fields.join(', ')} WHERE user_id = ?`);
        stmt.run(...values);
      }
    } else {
      const stmt = this.db.prepare(`
        INSERT INTO user_preferences (user_id, theme, custom_icons, github_token, github_username, preferred_model)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        userId,
        prefs.theme || 'auto',
        JSON.stringify(prefs.customIcons || {}),
        prefs.githubToken || null,
        prefs.githubUsername || null,
        prefs.preferredModel || null
      );
    }

    return (await this.getUserPreferences(userId))!;
  }

  // === Project Members ===
  async addProjectMember(projectId: string, userId: string, role: ProjectMember['role'], invitedBy: string): Promise<ProjectMember> {
    const id = this.generateId();
    const invitedAt = new Date();
    const acceptedAt = role === 'owner' ? invitedAt : undefined;

    const stmt = this.db.prepare(`
      INSERT INTO project_members (id, project_id, user_id, role, invited_by, invited_at, accepted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, projectId, userId, role, invitedBy, invitedAt.toISOString(), acceptedAt?.toISOString() || null);

    return { id, projectId, userId, role, invitedBy, invitedAt, acceptedAt };
  }

  async getProjectMembers(projectId: string): Promise<ProjectMember[]> {
    const stmt = this.db.prepare('SELECT * FROM project_members WHERE project_id = ?');
    const rows = stmt.all(projectId) as Record<string, unknown>[];
    return rows.map(row => ({
      id: row.id as string,
      projectId: row.project_id as string,
      userId: row.user_id as string,
      role: row.role as ProjectMember['role'],
      invitedBy: row.invited_by as string,
      invitedAt: new Date(row.invited_at as string),
      acceptedAt: row.accepted_at ? new Date(row.accepted_at as string) : undefined,
    }));
  }

  async getProjectMember(projectId: string, userId: string): Promise<ProjectMember | null> {
    const stmt = this.db.prepare('SELECT * FROM project_members WHERE project_id = ? AND user_id = ?');
    const row = stmt.get(projectId, userId) as Record<string, unknown> | undefined;
    if (!row) return null;

    return {
      id: row.id as string,
      projectId: row.project_id as string,
      userId: row.user_id as string,
      role: row.role as ProjectMember['role'],
      invitedBy: row.invited_by as string,
      invitedAt: new Date(row.invited_at as string),
      acceptedAt: row.accepted_at ? new Date(row.accepted_at as string) : undefined,
    };
  }

  async updateProjectMember(id: string, updates: Partial<ProjectMember>): Promise<ProjectMember | null> {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.role !== undefined) {
      fields.push('role = ?');
      values.push(updates.role);
    }
    if (updates.acceptedAt !== undefined) {
      fields.push('accepted_at = ?');
      values.push(updates.acceptedAt?.toISOString() || null);
    }

    if (fields.length > 0) {
      values.push(id);
      const stmt = this.db.prepare(`UPDATE project_members SET ${fields.join(', ')} WHERE id = ?`);
      stmt.run(...values);
    }

    const stmt = this.db.prepare('SELECT * FROM project_members WHERE id = ?');
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    if (!row) return null;

    return {
      id: row.id as string,
      projectId: row.project_id as string,
      userId: row.user_id as string,
      role: row.role as ProjectMember['role'],
      invitedBy: row.invited_by as string,
      invitedAt: new Date(row.invited_at as string),
      acceptedAt: row.accepted_at ? new Date(row.accepted_at as string) : undefined,
    };
  }

  async removeProjectMember(id: string): Promise<boolean> {
    const result = this.db.prepare('DELETE FROM project_members WHERE id = ?').run(id);
    return result.changes > 0;
  }

  async getProjectsForMember(userId: string): Promise<Project[]> {
    const stmt = this.db.prepare(`
      SELECT p.* FROM projects p
      JOIN project_members pm ON p.id = pm.project_id
      WHERE pm.user_id = ? AND p.archived_at IS NULL
      ORDER BY p.updated_at DESC
    `);
    const rows = stmt.all(userId) as Record<string, unknown>[];
    return rows.map(row => this.rowToProject(row));
  }

  // === Project Invites ===
  async createProjectInvite(projectId: string, email: string, role: ProjectInvite['role'], invitedBy: string): Promise<ProjectInvite> {
    const id = this.generateId();
    const token = crypto.randomBytes(32).toString('hex');
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const stmt = this.db.prepare(`
      INSERT INTO project_invites (id, project_id, email, role, token, invited_by, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, projectId, email.toLowerCase(), role, token, invitedBy, createdAt.toISOString(), expiresAt.toISOString());

    return { id, projectId, email: email.toLowerCase(), role, token, invitedBy, createdAt, expiresAt };
  }

  async getProjectInvite(token: string): Promise<ProjectInvite | null> {
    const stmt = this.db.prepare('SELECT * FROM project_invites WHERE token = ?');
    const row = stmt.get(token) as Record<string, unknown> | undefined;
    if (!row) return null;

    return {
      id: row.id as string,
      projectId: row.project_id as string,
      email: row.email as string,
      role: row.role as ProjectInvite['role'],
      token: row.token as string,
      invitedBy: row.invited_by as string,
      createdAt: new Date(row.created_at as string),
      expiresAt: new Date(row.expires_at as string),
      acceptedAt: row.accepted_at ? new Date(row.accepted_at as string) : undefined,
    };
  }

  async getProjectInvitesByProjectId(projectId: string): Promise<ProjectInvite[]> {
    const stmt = this.db.prepare('SELECT * FROM project_invites WHERE project_id = ? AND accepted_at IS NULL');
    const rows = stmt.all(projectId) as Record<string, unknown>[];
    return rows.map(row => ({
      id: row.id as string,
      projectId: row.project_id as string,
      email: row.email as string,
      role: row.role as ProjectInvite['role'],
      token: row.token as string,
      invitedBy: row.invited_by as string,
      createdAt: new Date(row.created_at as string),
      expiresAt: new Date(row.expires_at as string),
      acceptedAt: row.accepted_at ? new Date(row.accepted_at as string) : undefined,
    }));
  }

  async acceptProjectInvite(token: string, userId: string): Promise<ProjectMember | null> {
    const invite = await this.getProjectInvite(token);
    if (!invite) return null;
    if (invite.acceptedAt) return null;
    if (new Date() > invite.expiresAt) return null;

    // Mark invite as accepted
    const stmt = this.db.prepare('UPDATE project_invites SET accepted_at = ? WHERE token = ?');
    stmt.run(new Date().toISOString(), token);

    // Add user as member
    return this.addProjectMember(invite.projectId, userId, invite.role, invite.invitedBy);
  }

  async deleteProjectInvite(id: string): Promise<boolean> {
    const result = this.db.prepare('DELETE FROM project_invites WHERE id = ?').run(id);
    return result.changes > 0;
  }

  // ==========================================================================
  // Features
  // ==========================================================================

  async createFeature(projectId: string, title: string, description: string): Promise<Feature> {
    const id = this.generateId();
    const now = new Date();
    // Get next position
    const posRow = this.db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM features WHERE project_id = ?').get(projectId) as Record<string, unknown>;
    const position = (posRow?.next_pos as number) ?? 0;

    this.db.prepare(`
      INSERT INTO features (id, project_id, title, description, status, position, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'backlog', ?, ?, ?)
    `).run(id, projectId, title, description, position, now.toISOString(), now.toISOString());

    return {
      id, projectId, title, description, status: 'backlog',
      position, createdAt: now, updatedAt: now,
    };
  }

  async getFeaturesByProjectId(projectId: string): Promise<Feature[]> {
    const rows = this.db.prepare('SELECT * FROM features WHERE project_id = ? ORDER BY position ASC').all(projectId) as Record<string, unknown>[];
    return rows.map(row => this.rowToFeature(row));
  }

  async getFeatureById(id: string): Promise<Feature | null> {
    const row = this.db.prepare('SELECT * FROM features WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.rowToFeature(row);
  }

  async updateFeature(id: string, updates: Partial<Feature>): Promise<Feature | null> {
    const fields: string[] = ['updated_at = ?'];
    const values: unknown[] = [new Date().toISOString()];
    if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title); }
    if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
    if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
    if (updates.agentStatus !== undefined) { fields.push('agent_status = ?'); values.push(updates.agentStatus); }
    if (updates.agentMessage !== undefined) { fields.push('agent_message = ?'); values.push(updates.agentMessage); }
    if (updates.position !== undefined) { fields.push('position = ?'); values.push(updates.position); }
    if (updates.timerEnd !== undefined) { fields.push('timer_end = ?'); values.push(updates.timerEnd ? updates.timerEnd.toISOString() : null); }
    values.push(id);
    this.db.prepare(`UPDATE features SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.getFeatureById(id);
  }

  async deleteFeature(id: string): Promise<boolean> {
    return this.db.prepare('DELETE FROM features WHERE id = ?').run(id).changes > 0;
  }

  private rowToFeature(row: Record<string, unknown>): Feature {
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      title: row.title as string,
      description: (row.description as string) || '',
      status: row.status as Feature['status'],
      agentStatus: row.agent_status as Feature['agentStatus'],
      agentMessage: row.agent_message as string | undefined,
      position: row.position as number,
      timerEnd: row.timer_end ? new Date(row.timer_end as string) : null,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  // ==========================================================================
  // Messages
  // ==========================================================================

  async createMessage(data: Omit<Message, 'id' | 'createdAt'>): Promise<Message> {
    const id = this.generateId();
    const now = new Date();
    this.db.prepare(`
      INSERT INTO messages (id, project_id, user_id, role, content, context_mode, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.projectId, data.userId, data.role, data.content, data.contextMode, JSON.stringify(data.metadata), now.toISOString());
    return { id, ...data, createdAt: now };
  }

  async getMessagesByProjectId(projectId: string, limit?: number): Promise<Message[]> {
    let query: string;
    const params: unknown[] = [projectId];
    if (limit) {
      query = `SELECT * FROM (SELECT * FROM messages WHERE project_id = ? ORDER BY created_at DESC LIMIT ?) sub ORDER BY created_at ASC`;
      params.push(limit);
    } else {
      query = 'SELECT * FROM messages WHERE project_id = ? ORDER BY created_at ASC';
    }
    const rows = this.db.prepare(query).all(...params) as Record<string, unknown>[];
    return rows.map(row => this.rowToMessage(row));
  }

  async deleteMessagesByProjectId(projectId: string): Promise<boolean> {
    return this.db.prepare('DELETE FROM messages WHERE project_id = ?').run(projectId).changes > 0;
  }

  private rowToMessage(row: Record<string, unknown>): Message {
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      userId: row.user_id as string,
      role: row.role as Message['role'],
      content: row.content as string,
      contextMode: (row.context_mode as Message['contextMode']) || 'architecture',
      metadata: JSON.parse((row.metadata as string) || '{}'),
      createdAt: new Date(row.created_at as string),
    };
  }

  // ==========================================================================
  // Project Files
  // ==========================================================================

  async upsertProjectFile(projectId: string, path: string, content: string, componentId?: string): Promise<ProjectFile> {
    const id = this.generateId();
    const now = new Date();
    this.db.prepare(`
      INSERT INTO project_files (id, project_id, path, content, component_id, is_manually_edited, generated_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?)
      ON CONFLICT (project_id, path) DO UPDATE SET
        content = excluded.content,
        component_id = COALESCE(excluded.component_id, project_files.component_id),
        updated_at = excluded.updated_at
    `).run(id, projectId, path, content, componentId || null, now.toISOString(), now.toISOString());

    return (await this.getProjectFile(projectId, path))!;
  }

  async getProjectFilesByProjectId(projectId: string): Promise<ProjectFile[]> {
    const rows = this.db.prepare('SELECT * FROM project_files WHERE project_id = ? ORDER BY path ASC').all(projectId) as Record<string, unknown>[];
    return rows.map(row => this.rowToProjectFile(row));
  }

  async getProjectFile(projectId: string, path: string): Promise<ProjectFile | null> {
    const row = this.db.prepare('SELECT * FROM project_files WHERE project_id = ? AND path = ?').get(projectId, path) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.rowToProjectFile(row);
  }

  async updateProjectFile(projectId: string, path: string, content: string): Promise<ProjectFile | null> {
    const result = this.db.prepare(
      `UPDATE project_files SET content = ?, is_manually_edited = 1, updated_at = ? WHERE project_id = ? AND path = ?`
    ).run(content, new Date().toISOString(), projectId, path);
    if (result.changes === 0) return null;
    return this.getProjectFile(projectId, path);
  }

  async deleteProjectFilesByProjectId(projectId: string): Promise<boolean> {
    return this.db.prepare('DELETE FROM project_files WHERE project_id = ?').run(projectId).changes > 0;
  }

  private rowToProjectFile(row: Record<string, unknown>): ProjectFile {
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      path: row.path as string,
      content: (row.content as string) || '',
      componentId: row.component_id as string | undefined,
      isManuallyEdited: Boolean(row.is_manually_edited),
      generatedAt: new Date(row.generated_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  // ==========================================================================
  // Foundational Data Layer - Contacts
  // ==========================================================================

  async createContact(
    tenantId: string,
    data: Omit<Contact, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>
  ): Promise<Contact> {
    const id = this.generateId();
    const now = new Date();

    const stmt = this.db.prepare(`
      INSERT INTO contacts (id, tenant_id, first_name, last_name, email, phone, timezone, status, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, tenantId, data.firstName, data.lastName, data.email, data.phone || null, data.timezone || null, data.status, JSON.stringify(data.metadata || {}), now.toISOString(), now.toISOString());

    return { id, tenantId, ...data, createdAt: now, updatedAt: now };
  }

  async getContactById(id: string): Promise<Contact | null> {
    const stmt = this.db.prepare('SELECT * FROM contacts WHERE id = ?');
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.rowToContact(row);
  }

  private rowToContact(row: Record<string, unknown>): Contact {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      firstName: row.first_name as string,
      lastName: row.last_name as string,
      email: row.email as string,
      phone: row.phone as string | undefined,
      timezone: row.timezone as string | undefined,
      status: row.status as Contact['status'],
      metadata: JSON.parse((row.metadata as string) || '{}'),
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  async getContactsByTenantId(tenantId: string, status?: Contact['status']): Promise<Contact[]> {
    let query = 'SELECT * FROM contacts WHERE tenant_id = ?';
    const params: unknown[] = [tenantId];
    if (status) { query += ' AND status = ?'; params.push(status); }
    query += ' ORDER BY updated_at DESC';
    const stmt = this.db.prepare(query);
    return (stmt.all(...params) as Record<string, unknown>[]).map(row => this.rowToContact(row));
  }

  async updateContact(id: string, updates: Partial<Contact>): Promise<Contact | null> {
    const fields: string[] = ['updated_at = ?'];
    const values: unknown[] = [new Date().toISOString()];
    if (updates.firstName !== undefined) { fields.push('first_name = ?'); values.push(updates.firstName); }
    if (updates.lastName !== undefined) { fields.push('last_name = ?'); values.push(updates.lastName); }
    if (updates.email !== undefined) { fields.push('email = ?'); values.push(updates.email); }
    if (updates.phone !== undefined) { fields.push('phone = ?'); values.push(updates.phone); }
    if (updates.timezone !== undefined) { fields.push('timezone = ?'); values.push(updates.timezone); }
    if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
    if (updates.metadata !== undefined) { fields.push('metadata = ?'); values.push(JSON.stringify(updates.metadata)); }
    values.push(id);
    this.db.prepare(`UPDATE contacts SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.getContactById(id);
  }

  async deleteContact(id: string): Promise<boolean> {
    return this.db.prepare('DELETE FROM contacts WHERE id = ?').run(id).changes > 0;
  }

  async findContactByEmail(tenantId: string, email: string): Promise<Contact | null> {
    const stmt = this.db.prepare('SELECT * FROM contacts WHERE tenant_id = ? AND LOWER(email) = LOWER(?)');
    const row = stmt.get(tenantId, email) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.rowToContact(row);
  }

  // ==========================================================================
  // Foundational Data Layer - Notes
  // ==========================================================================

  async createNote(
    tenantId: string,
    data: Omit<Note, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>
  ): Promise<Note> {
    const id = this.generateId();
    const now = new Date();
    this.db.prepare(`
      INSERT INTO notes (id, tenant_id, contact_id, title, content, tags, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, tenantId, data.contactId, data.title, data.content, JSON.stringify(data.tags || []), JSON.stringify(data.metadata || {}), now.toISOString(), now.toISOString());
    return { id, tenantId, ...data, createdAt: now, updatedAt: now };
  }

  async getNoteById(id: string): Promise<Note | null> {
    const row = this.db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.rowToNote(row);
  }

  private rowToNote(row: Record<string, unknown>): Note {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      contactId: row.contact_id as string,
      title: row.title as string,
      content: row.content as string,
      tags: JSON.parse((row.tags as string) || '[]'),
      metadata: JSON.parse((row.metadata as string) || '{}'),
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  async getNotesByContactId(contactId: string): Promise<Note[]> {
    const rows = this.db.prepare('SELECT * FROM notes WHERE contact_id = ? ORDER BY updated_at DESC').all(contactId) as Record<string, unknown>[];
    return rows.map(row => this.rowToNote(row));
  }

  async updateNote(id: string, updates: Partial<Note>): Promise<Note | null> {
    const fields: string[] = ['updated_at = ?'];
    const values: unknown[] = [new Date().toISOString()];
    if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title); }
    if (updates.content !== undefined) { fields.push('content = ?'); values.push(updates.content); }
    if (updates.tags !== undefined) { fields.push('tags = ?'); values.push(JSON.stringify(updates.tags)); }
    if (updates.metadata !== undefined) { fields.push('metadata = ?'); values.push(JSON.stringify(updates.metadata)); }
    values.push(id);
    this.db.prepare(`UPDATE notes SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.getNoteById(id);
  }

  async deleteNote(id: string): Promise<boolean> {
    return this.db.prepare('DELETE FROM notes WHERE id = ?').run(id).changes > 0;
  }

  // ==========================================================================
  // Foundational Data Layer - Contact Interactions
  // ==========================================================================

  async createContactInteraction(
    tenantId: string,
    data: Omit<ContactInteraction, 'id' | 'tenantId' | 'createdAt'>
  ): Promise<ContactInteraction> {
    const id = this.generateId();
    const now = new Date();
    this.db.prepare(`
      INSERT INTO contact_interactions (id, tenant_id, contact_id, type, channel, title, description, occurred_at, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, tenantId, data.contactId, data.type, data.channel, data.title, data.description || null, data.occurredAt.toISOString(), JSON.stringify(data.metadata || {}), now.toISOString());
    return { id, tenantId, ...data, createdAt: now };
  }

  async getContactInteractionById(id: string): Promise<ContactInteraction | null> {
    const row = this.db.prepare('SELECT * FROM contact_interactions WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.rowToContactInteraction(row);
  }

  private rowToContactInteraction(row: Record<string, unknown>): ContactInteraction {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      contactId: row.contact_id as string,
      type: row.type as string,
      channel: row.channel as string,
      title: row.title as string,
      description: row.description as string | undefined,
      occurredAt: new Date(row.occurred_at as string),
      metadata: JSON.parse((row.metadata as string) || '{}'),
      createdAt: new Date(row.created_at as string),
    };
  }

  async getContactInteractionsByContactId(contactId: string): Promise<ContactInteraction[]> {
    const rows = this.db.prepare('SELECT * FROM contact_interactions WHERE contact_id = ? ORDER BY occurred_at DESC').all(contactId) as Record<string, unknown>[];
    return rows.map(row => this.rowToContactInteraction(row));
  }

  async getContactInteractionsByTenantId(tenantId: string, startDate?: Date, endDate?: Date): Promise<ContactInteraction[]> {
    let query = 'SELECT * FROM contact_interactions WHERE tenant_id = ?';
    const params: unknown[] = [tenantId];
    if (startDate) { query += ' AND occurred_at >= ?'; params.push(startDate.toISOString()); }
    if (endDate) { query += ' AND occurred_at <= ?'; params.push(endDate.toISOString()); }
    query += ' ORDER BY occurred_at DESC';
    return (this.db.prepare(query).all(...params) as Record<string, unknown>[]).map(row => this.rowToContactInteraction(row));
  }

  // Close database connection
  close(): void {
    this.db.close();
  }
}
