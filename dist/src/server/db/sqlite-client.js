// SQLite database client for Brick Platform
// Persistent storage with better-sqlite3
import Database from 'better-sqlite3';
import crypto from 'crypto';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync } from 'fs';
// Get database path - store in data directory
function getDatabasePath() {
    const dbPath = process.env.BRICK_DB_PATH;
    if (dbPath)
        return dbPath;
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
export class SQLiteClient {
    db;
    constructor(dbPath) {
        const path = dbPath || getDatabasePath();
        console.log(`  SQLite database: ${path}`);
        this.db = new Database(path);
        this.db.pragma('journal_mode = WAL');
        this.initializeTables();
    }
    initializeTables() {
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
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        archived_at TEXT,
        archived_by TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
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
        const createdAt = new Date();
        const stmt = this.db.prepare(`
      INSERT INTO users (id, email, password_hash, name, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
        stmt.run(id, email.toLowerCase(), passwordHash, name, createdAt.toISOString());
        return { id, email: email.toLowerCase(), passwordHash, name, createdAt };
    }
    async getUserById(id) {
        const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
        const row = stmt.get(id);
        if (!row)
            return null;
        return {
            id: row.id,
            email: row.email,
            passwordHash: row.password_hash,
            name: row.name,
            createdAt: new Date(row.created_at),
            stripeCustomerId: row.stripe_customer_id,
        };
    }
    async getUserByEmail(email) {
        const stmt = this.db.prepare('SELECT * FROM users WHERE email = ?');
        const row = stmt.get(email.toLowerCase());
        if (!row)
            return null;
        return {
            id: row.id,
            email: row.email,
            passwordHash: row.password_hash,
            name: row.name,
            createdAt: new Date(row.created_at),
            stripeCustomerId: row.stripe_customer_id,
        };
    }
    async updateUser(id, updates) {
        const user = await this.getUserById(id);
        if (!user)
            return null;
        const fields = [];
        const values = [];
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
    async createProject(userId, name, architecture) {
        const id = this.generateId();
        const slug = this.slugify(name) + '-' + id.slice(0, 6);
        const now = new Date();
        const stmt = this.db.prepare(`
      INSERT INTO projects (id, user_id, name, slug, documentation, architecture, connection_labels, created_at, updated_at)
      VALUES (?, ?, ?, ?, '', ?, '{}', ?, ?)
    `);
        stmt.run(id, userId, name, slug, JSON.stringify(architecture), now.toISOString(), now.toISOString());
        // Auto-create environments
        for (const envName of ['development', 'staging', 'production']) {
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
    async getProjectById(id) {
        const stmt = this.db.prepare('SELECT * FROM projects WHERE id = ?');
        const row = stmt.get(id);
        if (!row)
            return null;
        return this.rowToProject(row);
    }
    rowToProject(row) {
        return {
            id: row.id,
            userId: row.user_id,
            name: row.name,
            slug: row.slug,
            documentation: row.documentation,
            architecture: JSON.parse(row.architecture),
            connectionLabels: JSON.parse(row.connection_labels || '{}'),
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
            archivedAt: row.archived_at ? new Date(row.archived_at) : undefined,
            archivedBy: row.archived_by,
        };
    }
    async getProjectsByUserId(userId, includeArchived = false) {
        let query = 'SELECT * FROM projects WHERE user_id = ?';
        if (!includeArchived) {
            query += ' AND archived_at IS NULL';
        }
        query += ' ORDER BY updated_at DESC';
        const stmt = this.db.prepare(query);
        const rows = stmt.all(userId);
        return rows.map(row => this.rowToProject(row));
    }
    async updateProject(id, updates) {
        const project = await this.getProjectById(id);
        if (!project)
            return null;
        const fields = ['updated_at = ?'];
        const values = [new Date().toISOString()];
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
        values.push(id);
        const stmt = this.db.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`);
        stmt.run(...values);
        return this.getProjectById(id);
    }
    async deleteProject(id) {
        // Delete associated data
        this.db.prepare('DELETE FROM project_members WHERE project_id = ?').run(id);
        this.db.prepare('DELETE FROM project_invites WHERE project_id = ?').run(id);
        this.db.prepare('DELETE FROM deployments WHERE project_id = ?').run(id);
        this.db.prepare('DELETE FROM environments WHERE project_id = ?').run(id);
        const result = this.db.prepare('DELETE FROM projects WHERE id = ?').run(id);
        return result.changes > 0;
    }
    async archiveProject(id, userId) {
        const stmt = this.db.prepare(`
      UPDATE projects SET archived_at = ?, archived_by = ?, updated_at = ?
      WHERE id = ?
    `);
        const now = new Date().toISOString();
        stmt.run(now, userId, now, id);
        return this.getProjectById(id);
    }
    async restoreProject(id) {
        const stmt = this.db.prepare(`
      UPDATE projects SET archived_at = NULL, archived_by = NULL, updated_at = ?
      WHERE id = ?
    `);
        stmt.run(new Date().toISOString(), id);
        return this.getProjectById(id);
    }
    // === Environments ===
    async createEnvironment(projectId, name) {
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
    async getEnvironmentById(id) {
        const stmt = this.db.prepare('SELECT * FROM environments WHERE id = ?');
        const row = stmt.get(id);
        if (!row)
            return null;
        return {
            id: row.id,
            projectId: row.project_id,
            name: row.name,
            status: row.status,
            doAppId: row.do_app_id,
            url: row.url,
            lastDeployedAt: row.last_deployed_at ? new Date(row.last_deployed_at) : undefined,
            monthlyCostCents: row.monthly_cost_cents,
        };
    }
    async getEnvironmentsByProjectId(projectId) {
        const stmt = this.db.prepare('SELECT * FROM environments WHERE project_id = ?');
        const rows = stmt.all(projectId);
        return rows.map(row => ({
            id: row.id,
            projectId: row.project_id,
            name: row.name,
            status: row.status,
            doAppId: row.do_app_id,
            url: row.url,
            lastDeployedAt: row.last_deployed_at ? new Date(row.last_deployed_at) : undefined,
            monthlyCostCents: row.monthly_cost_cents,
        }));
    }
    async updateEnvironment(id, updates) {
        const fields = [];
        const values = [];
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
    async createDeployment(environmentId, projectId, userId) {
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
    async getDeploymentById(id) {
        const stmt = this.db.prepare('SELECT * FROM deployments WHERE id = ?');
        const row = stmt.get(id);
        if (!row)
            return null;
        return {
            id: row.id,
            environmentId: row.environment_id,
            projectId: row.project_id,
            userId: row.user_id,
            status: row.status,
            doAppId: row.do_app_id,
            url: row.url,
            logs: JSON.parse(row.logs),
            startedAt: new Date(row.started_at),
            completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
            error: row.error,
        };
    }
    async getDeploymentsByEnvironmentId(environmentId) {
        const stmt = this.db.prepare('SELECT * FROM deployments WHERE environment_id = ? ORDER BY started_at DESC');
        const rows = stmt.all(environmentId);
        return rows.map(row => ({
            id: row.id,
            environmentId: row.environment_id,
            projectId: row.project_id,
            userId: row.user_id,
            status: row.status,
            doAppId: row.do_app_id,
            url: row.url,
            logs: JSON.parse(row.logs),
            startedAt: new Date(row.started_at),
            completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
            error: row.error,
        }));
    }
    async updateDeployment(id, updates) {
        const fields = [];
        const values = [];
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
    async appendDeploymentLog(id, log) {
        const deployment = await this.getDeploymentById(id);
        if (deployment) {
            deployment.logs.push(`[${new Date().toISOString()}] ${log}`);
            const stmt = this.db.prepare('UPDATE deployments SET logs = ? WHERE id = ?');
            stmt.run(JSON.stringify(deployment.logs), id);
        }
    }
    // === Usage Records ===
    async createUsageRecord(record) {
        const id = this.generateId();
        const stmt = this.db.prepare(`
      INSERT INTO usage_records (id, user_id, project_id, environment_id, period_start, period_end, compute_minutes, bandwidth_gb, cost_cents)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, record.userId, record.projectId, record.environmentId, record.periodStart.toISOString(), record.periodEnd.toISOString(), record.computeMinutes, record.bandwidthGb, record.costCents);
        return { id, ...record };
    }
    async getUsageByUserId(userId, startDate, endDate) {
        const stmt = this.db.prepare(`
      SELECT * FROM usage_records
      WHERE user_id = ? AND period_start >= ? AND period_end <= ?
    `);
        const rows = stmt.all(userId, startDate.toISOString(), endDate.toISOString());
        return rows.map(row => ({
            id: row.id,
            userId: row.user_id,
            projectId: row.project_id,
            environmentId: row.environment_id,
            periodStart: new Date(row.period_start),
            periodEnd: new Date(row.period_end),
            computeMinutes: row.compute_minutes,
            bandwidthGb: row.bandwidth_gb,
            costCents: row.cost_cents,
        }));
    }
    // === AI Usage Records ===
    async createAIUsageRecord(record) {
        const id = this.generateId();
        const stmt = this.db.prepare(`
      INSERT INTO ai_usage_records (id, user_id, project_id, model, provider, input_tokens, output_tokens, is_premium, cost_cents, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, record.userId, record.projectId || null, record.model, record.provider, record.inputTokens, record.outputTokens, record.isPremium ? 1 : 0, record.costCents, record.createdAt.toISOString());
        return { id, ...record };
    }
    async getAIUsageByUserId(userId, startDate, endDate) {
        let query = 'SELECT * FROM ai_usage_records WHERE user_id = ?';
        const params = [userId];
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
        const rows = stmt.all(...params);
        return rows.map(row => ({
            id: row.id,
            userId: row.user_id,
            projectId: row.project_id,
            model: row.model,
            provider: row.provider,
            inputTokens: row.input_tokens,
            outputTokens: row.output_tokens,
            isPremium: Boolean(row.is_premium),
            costCents: row.cost_cents,
            createdAt: new Date(row.created_at),
        }));
    }
    async getAIUsageByProjectId(projectId) {
        const stmt = this.db.prepare('SELECT * FROM ai_usage_records WHERE project_id = ? ORDER BY created_at DESC');
        const rows = stmt.all(projectId);
        return rows.map(row => ({
            id: row.id,
            userId: row.user_id,
            projectId: row.project_id,
            model: row.model,
            provider: row.provider,
            inputTokens: row.input_tokens,
            outputTokens: row.output_tokens,
            isPremium: Boolean(row.is_premium),
            costCents: row.cost_cents,
            createdAt: new Date(row.created_at),
        }));
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
    async getUserPreferences(userId) {
        const stmt = this.db.prepare('SELECT * FROM user_preferences WHERE user_id = ?');
        const row = stmt.get(userId);
        if (!row)
            return null;
        return {
            userId: row.user_id,
            theme: row.theme,
            customIcons: JSON.parse(row.custom_icons || '{}'),
            githubToken: row.github_token,
            githubUsername: row.github_username,
        };
    }
    async upsertUserPreferences(userId, prefs) {
        const existing = await this.getUserPreferences(userId);
        if (existing) {
            const fields = [];
            const values = [];
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
            if (fields.length > 0) {
                values.push(userId);
                const stmt = this.db.prepare(`UPDATE user_preferences SET ${fields.join(', ')} WHERE user_id = ?`);
                stmt.run(...values);
            }
        }
        else {
            const stmt = this.db.prepare(`
        INSERT INTO user_preferences (user_id, theme, custom_icons, github_token, github_username)
        VALUES (?, ?, ?, ?, ?)
      `);
            stmt.run(userId, prefs.theme || 'auto', JSON.stringify(prefs.customIcons || {}), prefs.githubToken || null, prefs.githubUsername || null);
        }
        return (await this.getUserPreferences(userId));
    }
    // === Project Members ===
    async addProjectMember(projectId, userId, role, invitedBy) {
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
    async getProjectMembers(projectId) {
        const stmt = this.db.prepare('SELECT * FROM project_members WHERE project_id = ?');
        const rows = stmt.all(projectId);
        return rows.map(row => ({
            id: row.id,
            projectId: row.project_id,
            userId: row.user_id,
            role: row.role,
            invitedBy: row.invited_by,
            invitedAt: new Date(row.invited_at),
            acceptedAt: row.accepted_at ? new Date(row.accepted_at) : undefined,
        }));
    }
    async getProjectMember(projectId, userId) {
        const stmt = this.db.prepare('SELECT * FROM project_members WHERE project_id = ? AND user_id = ?');
        const row = stmt.get(projectId, userId);
        if (!row)
            return null;
        return {
            id: row.id,
            projectId: row.project_id,
            userId: row.user_id,
            role: row.role,
            invitedBy: row.invited_by,
            invitedAt: new Date(row.invited_at),
            acceptedAt: row.accepted_at ? new Date(row.accepted_at) : undefined,
        };
    }
    async updateProjectMember(id, updates) {
        const fields = [];
        const values = [];
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
        const row = stmt.get(id);
        if (!row)
            return null;
        return {
            id: row.id,
            projectId: row.project_id,
            userId: row.user_id,
            role: row.role,
            invitedBy: row.invited_by,
            invitedAt: new Date(row.invited_at),
            acceptedAt: row.accepted_at ? new Date(row.accepted_at) : undefined,
        };
    }
    async removeProjectMember(id) {
        const result = this.db.prepare('DELETE FROM project_members WHERE id = ?').run(id);
        return result.changes > 0;
    }
    async getProjectsForMember(userId) {
        const stmt = this.db.prepare(`
      SELECT p.* FROM projects p
      JOIN project_members pm ON p.id = pm.project_id
      WHERE pm.user_id = ? AND p.archived_at IS NULL
      ORDER BY p.updated_at DESC
    `);
        const rows = stmt.all(userId);
        return rows.map(row => this.rowToProject(row));
    }
    // === Project Invites ===
    async createProjectInvite(projectId, email, role, invitedBy) {
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
    async getProjectInvite(token) {
        const stmt = this.db.prepare('SELECT * FROM project_invites WHERE token = ?');
        const row = stmt.get(token);
        if (!row)
            return null;
        return {
            id: row.id,
            projectId: row.project_id,
            email: row.email,
            role: row.role,
            token: row.token,
            invitedBy: row.invited_by,
            createdAt: new Date(row.created_at),
            expiresAt: new Date(row.expires_at),
            acceptedAt: row.accepted_at ? new Date(row.accepted_at) : undefined,
        };
    }
    async getProjectInvitesByProjectId(projectId) {
        const stmt = this.db.prepare('SELECT * FROM project_invites WHERE project_id = ? AND accepted_at IS NULL');
        const rows = stmt.all(projectId);
        return rows.map(row => ({
            id: row.id,
            projectId: row.project_id,
            email: row.email,
            role: row.role,
            token: row.token,
            invitedBy: row.invited_by,
            createdAt: new Date(row.created_at),
            expiresAt: new Date(row.expires_at),
            acceptedAt: row.accepted_at ? new Date(row.accepted_at) : undefined,
        }));
    }
    async acceptProjectInvite(token, userId) {
        const invite = await this.getProjectInvite(token);
        if (!invite)
            return null;
        if (invite.acceptedAt)
            return null;
        if (new Date() > invite.expiresAt)
            return null;
        // Mark invite as accepted
        const stmt = this.db.prepare('UPDATE project_invites SET accepted_at = ? WHERE token = ?');
        stmt.run(new Date().toISOString(), token);
        // Add user as member
        return this.addProjectMember(invite.projectId, userId, invite.role, invite.invitedBy);
    }
    async deleteProjectInvite(id) {
        const result = this.db.prepare('DELETE FROM project_invites WHERE id = ?').run(id);
        return result.changes > 0;
    }
    // ==========================================================================
    // Foundational Data Layer - Contacts
    // ==========================================================================
    async createContact(tenantId, data) {
        const id = this.generateId();
        const now = new Date();
        const stmt = this.db.prepare(`
      INSERT INTO contacts (id, tenant_id, first_name, last_name, email, phone, timezone, status, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(id, tenantId, data.firstName, data.lastName, data.email, data.phone || null, data.timezone || null, data.status, JSON.stringify(data.metadata || {}), now.toISOString(), now.toISOString());
        return { id, tenantId, ...data, createdAt: now, updatedAt: now };
    }
    async getContactById(id) {
        const stmt = this.db.prepare('SELECT * FROM contacts WHERE id = ?');
        const row = stmt.get(id);
        if (!row)
            return null;
        return this.rowToContact(row);
    }
    rowToContact(row) {
        return {
            id: row.id,
            tenantId: row.tenant_id,
            firstName: row.first_name,
            lastName: row.last_name,
            email: row.email,
            phone: row.phone,
            timezone: row.timezone,
            status: row.status,
            metadata: JSON.parse(row.metadata || '{}'),
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
        };
    }
    async getContactsByTenantId(tenantId, status) {
        let query = 'SELECT * FROM contacts WHERE tenant_id = ?';
        const params = [tenantId];
        if (status) {
            query += ' AND status = ?';
            params.push(status);
        }
        query += ' ORDER BY updated_at DESC';
        const stmt = this.db.prepare(query);
        return stmt.all(...params).map(row => this.rowToContact(row));
    }
    async updateContact(id, updates) {
        const fields = ['updated_at = ?'];
        const values = [new Date().toISOString()];
        if (updates.firstName !== undefined) {
            fields.push('first_name = ?');
            values.push(updates.firstName);
        }
        if (updates.lastName !== undefined) {
            fields.push('last_name = ?');
            values.push(updates.lastName);
        }
        if (updates.email !== undefined) {
            fields.push('email = ?');
            values.push(updates.email);
        }
        if (updates.phone !== undefined) {
            fields.push('phone = ?');
            values.push(updates.phone);
        }
        if (updates.timezone !== undefined) {
            fields.push('timezone = ?');
            values.push(updates.timezone);
        }
        if (updates.status !== undefined) {
            fields.push('status = ?');
            values.push(updates.status);
        }
        if (updates.metadata !== undefined) {
            fields.push('metadata = ?');
            values.push(JSON.stringify(updates.metadata));
        }
        values.push(id);
        this.db.prepare(`UPDATE contacts SET ${fields.join(', ')} WHERE id = ?`).run(...values);
        return this.getContactById(id);
    }
    async deleteContact(id) {
        return this.db.prepare('DELETE FROM contacts WHERE id = ?').run(id).changes > 0;
    }
    async findContactByEmail(tenantId, email) {
        const stmt = this.db.prepare('SELECT * FROM contacts WHERE tenant_id = ? AND LOWER(email) = LOWER(?)');
        const row = stmt.get(tenantId, email);
        if (!row)
            return null;
        return this.rowToContact(row);
    }
    // ==========================================================================
    // Foundational Data Layer - Notes
    // ==========================================================================
    async createNote(tenantId, data) {
        const id = this.generateId();
        const now = new Date();
        this.db.prepare(`
      INSERT INTO notes (id, tenant_id, contact_id, title, content, tags, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, tenantId, data.contactId, data.title, data.content, JSON.stringify(data.tags || []), JSON.stringify(data.metadata || {}), now.toISOString(), now.toISOString());
        return { id, tenantId, ...data, createdAt: now, updatedAt: now };
    }
    async getNoteById(id) {
        const row = this.db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
        if (!row)
            return null;
        return this.rowToNote(row);
    }
    rowToNote(row) {
        return {
            id: row.id,
            tenantId: row.tenant_id,
            contactId: row.contact_id,
            title: row.title,
            content: row.content,
            tags: JSON.parse(row.tags || '[]'),
            metadata: JSON.parse(row.metadata || '{}'),
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
        };
    }
    async getNotesByContactId(contactId) {
        const rows = this.db.prepare('SELECT * FROM notes WHERE contact_id = ? ORDER BY updated_at DESC').all(contactId);
        return rows.map(row => this.rowToNote(row));
    }
    async updateNote(id, updates) {
        const fields = ['updated_at = ?'];
        const values = [new Date().toISOString()];
        if (updates.title !== undefined) {
            fields.push('title = ?');
            values.push(updates.title);
        }
        if (updates.content !== undefined) {
            fields.push('content = ?');
            values.push(updates.content);
        }
        if (updates.tags !== undefined) {
            fields.push('tags = ?');
            values.push(JSON.stringify(updates.tags));
        }
        if (updates.metadata !== undefined) {
            fields.push('metadata = ?');
            values.push(JSON.stringify(updates.metadata));
        }
        values.push(id);
        this.db.prepare(`UPDATE notes SET ${fields.join(', ')} WHERE id = ?`).run(...values);
        return this.getNoteById(id);
    }
    async deleteNote(id) {
        return this.db.prepare('DELETE FROM notes WHERE id = ?').run(id).changes > 0;
    }
    // ==========================================================================
    // Foundational Data Layer - Contact Interactions
    // ==========================================================================
    async createContactInteraction(tenantId, data) {
        const id = this.generateId();
        const now = new Date();
        this.db.prepare(`
      INSERT INTO contact_interactions (id, tenant_id, contact_id, type, channel, title, description, occurred_at, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, tenantId, data.contactId, data.type, data.channel, data.title, data.description || null, data.occurredAt.toISOString(), JSON.stringify(data.metadata || {}), now.toISOString());
        return { id, tenantId, ...data, createdAt: now };
    }
    async getContactInteractionById(id) {
        const row = this.db.prepare('SELECT * FROM contact_interactions WHERE id = ?').get(id);
        if (!row)
            return null;
        return this.rowToContactInteraction(row);
    }
    rowToContactInteraction(row) {
        return {
            id: row.id,
            tenantId: row.tenant_id,
            contactId: row.contact_id,
            type: row.type,
            channel: row.channel,
            title: row.title,
            description: row.description,
            occurredAt: new Date(row.occurred_at),
            metadata: JSON.parse(row.metadata || '{}'),
            createdAt: new Date(row.created_at),
        };
    }
    async getContactInteractionsByContactId(contactId) {
        const rows = this.db.prepare('SELECT * FROM contact_interactions WHERE contact_id = ? ORDER BY occurred_at DESC').all(contactId);
        return rows.map(row => this.rowToContactInteraction(row));
    }
    async getContactInteractionsByTenantId(tenantId, startDate, endDate) {
        let query = 'SELECT * FROM contact_interactions WHERE tenant_id = ?';
        const params = [tenantId];
        if (startDate) {
            query += ' AND occurred_at >= ?';
            params.push(startDate.toISOString());
        }
        if (endDate) {
            query += ' AND occurred_at <= ?';
            params.push(endDate.toISOString());
        }
        query += ' ORDER BY occurred_at DESC';
        return this.db.prepare(query).all(...params).map(row => this.rowToContactInteraction(row));
    }
    // Close database connection
    close() {
        this.db.close();
    }
}
//# sourceMappingURL=sqlite-client.js.map