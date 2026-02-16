/**
 * PostgresClient — implements DatabaseClient for managed Postgres (DO, Supabase, etc.)
 * Uses the `pg` package (node-postgres).
 */

import crypto from 'crypto';
import type {
  User, Project, Environment, Deployment, UsageRecord,
  AIUsageRecord, UserPreferences, ProjectMember, ProjectInvite,
  DatabaseClient, Contact, Note, ContactInteraction,
} from './schema.js';

// pg is a peer dependency — only imported when DATABASE_URL is set
let Pool: typeof import('pg').Pool;

export class PostgresClient implements DatabaseClient {
  private pool!: InstanceType<typeof import('pg').Pool>;
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    const pg = await import('pg');
    Pool = pg.default?.Pool ?? pg.Pool;
    const dbUrl = process.env.DATABASE_URL || '';
    const needsSsl = dbUrl.includes('sslmode=require') || process.env.DATABASE_SSL === 'true';
    this.pool = new Pool({
      connectionString: dbUrl,
      ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
      max: 10,
    });

    // Run migrations
    const { readFileSync } = await import('fs');
    const { join, dirname } = await import('path');
    const { fileURLToPath } = await import('url');
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    const migrationPaths = [
      join(__dirname, 'migrations', '001-initial.sql'),
      join(process.cwd(), 'src', 'server', 'db', 'migrations', '001-initial.sql'),
    ];
    let migrationRan = false;
    for (const mp of migrationPaths) {
      let sql: string;
      try {
        sql = readFileSync(mp, 'utf-8');
      } catch {
        continue; // file not found, try next path
      }
      await this.pool.query(sql);
      migrationRan = true;
      break;
    }
    if (!migrationRan) {
      console.warn('Warning: No migration file found at any of:', migrationPaths);
    }

    this.initialized = true;
  }

  private generateId(): string {
    return crypto.randomBytes(12).toString('hex');
  }

  private slugify(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
  }

  // === Users ===

  async createUser(email: string, passwordHash: string, name: string): Promise<User> {
    await this.init();
    const id = this.generateId();
    const { rows } = await this.pool.query(
      `INSERT INTO users (id, email, password_hash, name) VALUES ($1, $2, $3, $4)
       RETURNING id, email, password_hash, name, stripe_customer_id, created_at`,
      [id, email.toLowerCase(), passwordHash, name]
    );
    return this.mapUser(rows[0]);
  }

  async getUserById(id: string): Promise<User | null> {
    await this.init();
    const { rows } = await this.pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return rows[0] ? this.mapUser(rows[0]) : null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    await this.init();
    const { rows } = await this.pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    return rows[0] ? this.mapUser(rows[0]) : null;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    await this.init();
    const sets: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;
    if (updates.email !== undefined) { sets.push(`email = $${idx++}`); vals.push(updates.email.toLowerCase()); }
    if (updates.name !== undefined) { sets.push(`name = $${idx++}`); vals.push(updates.name); }
    if (updates.stripeCustomerId !== undefined) { sets.push(`stripe_customer_id = $${idx++}`); vals.push(updates.stripeCustomerId); }
    if (sets.length === 0) return this.getUserById(id);
    vals.push(id);
    const { rows } = await this.pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`, vals);
    return rows[0] ? this.mapUser(rows[0]) : null;
  }

  // === Projects ===

  async createProject(userId: string, name: string, architecture: Project['architecture']): Promise<Project> {
    await this.init();
    const id = this.generateId();
    const slug = this.slugify(name) + '-' + id.slice(0, 6);
    const { rows } = await this.pool.query(
      `INSERT INTO projects (id, user_id, name, slug, architecture) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, userId, name, slug, JSON.stringify(architecture)]
    );
    // Auto-create environments
    for (const envName of ['development', 'staging', 'production'] as const) {
      await this.createEnvironment(id, envName);
    }
    await this.addProjectMember(id, userId, 'owner', userId);
    return this.mapProject(rows[0]);
  }

  async getProjectById(id: string): Promise<Project | null> {
    await this.init();
    const { rows } = await this.pool.query('SELECT * FROM projects WHERE id = $1', [id]);
    return rows[0] ? this.mapProject(rows[0]) : null;
  }

  async getProjectsByUserId(userId: string, includeArchived = false): Promise<Project[]> {
    await this.init();
    const q = includeArchived
      ? 'SELECT * FROM projects WHERE user_id = $1 ORDER BY updated_at DESC'
      : 'SELECT * FROM projects WHERE user_id = $1 AND archived_at IS NULL ORDER BY updated_at DESC';
    const { rows } = await this.pool.query(q, [userId]);
    return rows.map(r => this.mapProject(r));
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<Project | null> {
    await this.init();
    const sets: string[] = ['updated_at = NOW()'];
    const vals: unknown[] = [];
    let idx = 1;
    if (updates.name !== undefined) { sets.push(`name = $${idx++}`); vals.push(updates.name); }
    if (updates.documentation !== undefined) { sets.push(`documentation = $${idx++}`); vals.push(updates.documentation); }
    if (updates.architecture !== undefined) { sets.push(`architecture = $${idx++}`); vals.push(JSON.stringify(updates.architecture)); }
    if (updates.connectionLabels !== undefined) { sets.push(`connection_labels = $${idx++}`); vals.push(JSON.stringify(updates.connectionLabels)); }
    vals.push(id);
    const { rows } = await this.pool.query(`UPDATE projects SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`, vals);
    return rows[0] ? this.mapProject(rows[0]) : null;
  }

  async deleteProject(id: string): Promise<boolean> {
    await this.init();
    const { rowCount } = await this.pool.query('DELETE FROM projects WHERE id = $1', [id]);
    return (rowCount ?? 0) > 0;
  }

  async archiveProject(id: string, userId: string): Promise<Project | null> {
    await this.init();
    const { rows } = await this.pool.query(
      'UPDATE projects SET archived_at = NOW(), archived_by = $2, updated_at = NOW() WHERE id = $1 RETURNING *',
      [id, userId]
    );
    return rows[0] ? this.mapProject(rows[0]) : null;
  }

  async restoreProject(id: string): Promise<Project | null> {
    await this.init();
    const { rows } = await this.pool.query(
      'UPDATE projects SET archived_at = NULL, archived_by = NULL, updated_at = NOW() WHERE id = $1 RETURNING *',
      [id]
    );
    return rows[0] ? this.mapProject(rows[0]) : null;
  }

  // === Environments ===

  async createEnvironment(projectId: string, name: Environment['name']): Promise<Environment> {
    await this.init();
    const id = this.generateId();
    const { rows } = await this.pool.query(
      'INSERT INTO environments (id, project_id, name) VALUES ($1, $2, $3) RETURNING *',
      [id, projectId, name]
    );
    return this.mapEnvironment(rows[0]);
  }

  async getEnvironmentById(id: string): Promise<Environment | null> {
    await this.init();
    const { rows } = await this.pool.query('SELECT * FROM environments WHERE id = $1', [id]);
    return rows[0] ? this.mapEnvironment(rows[0]) : null;
  }

  async getEnvironmentsByProjectId(projectId: string): Promise<Environment[]> {
    await this.init();
    const { rows } = await this.pool.query('SELECT * FROM environments WHERE project_id = $1', [projectId]);
    return rows.map(r => this.mapEnvironment(r));
  }

  async updateEnvironment(id: string, updates: Partial<Environment>): Promise<Environment | null> {
    await this.init();
    const sets: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;
    if (updates.status !== undefined) { sets.push(`status = $${idx++}`); vals.push(updates.status); }
    if (updates.doAppId !== undefined) { sets.push(`do_app_id = $${idx++}`); vals.push(updates.doAppId); }
    if (updates.url !== undefined) { sets.push(`url = $${idx++}`); vals.push(updates.url); }
    if (updates.lastDeployedAt !== undefined) { sets.push(`last_deployed_at = $${idx++}`); vals.push(updates.lastDeployedAt); }
    if (updates.monthlyCostCents !== undefined) { sets.push(`monthly_cost_cents = $${idx++}`); vals.push(updates.monthlyCostCents); }
    if (sets.length === 0) return this.getEnvironmentById(id);
    vals.push(id);
    const { rows } = await this.pool.query(`UPDATE environments SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`, vals);
    return rows[0] ? this.mapEnvironment(rows[0]) : null;
  }

  // === Deployments ===

  async createDeployment(environmentId: string, projectId: string, userId: string): Promise<Deployment> {
    await this.init();
    const id = this.generateId();
    const { rows } = await this.pool.query(
      'INSERT INTO deployments (id, environment_id, project_id, user_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [id, environmentId, projectId, userId]
    );
    return this.mapDeployment(rows[0]);
  }

  async getDeploymentById(id: string): Promise<Deployment | null> {
    await this.init();
    const { rows } = await this.pool.query('SELECT * FROM deployments WHERE id = $1', [id]);
    return rows[0] ? this.mapDeployment(rows[0]) : null;
  }

  async getDeploymentsByEnvironmentId(environmentId: string): Promise<Deployment[]> {
    await this.init();
    const { rows } = await this.pool.query(
      'SELECT * FROM deployments WHERE environment_id = $1 ORDER BY started_at DESC',
      [environmentId]
    );
    return rows.map(r => this.mapDeployment(r));
  }

  async updateDeployment(id: string, updates: Partial<Deployment>): Promise<Deployment | null> {
    await this.init();
    const sets: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;
    if (updates.status !== undefined) { sets.push(`status = $${idx++}`); vals.push(updates.status); }
    if (updates.doAppId !== undefined) { sets.push(`do_app_id = $${idx++}`); vals.push(updates.doAppId); }
    if (updates.url !== undefined) { sets.push(`url = $${idx++}`); vals.push(updates.url); }
    if (updates.completedAt !== undefined) { sets.push(`completed_at = $${idx++}`); vals.push(updates.completedAt); }
    if (updates.error !== undefined) { sets.push(`error = $${idx++}`); vals.push(updates.error); }
    if (sets.length === 0) return this.getDeploymentById(id);
    vals.push(id);
    const { rows } = await this.pool.query(`UPDATE deployments SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`, vals);
    return rows[0] ? this.mapDeployment(rows[0]) : null;
  }

  async appendDeploymentLog(id: string, log: string): Promise<void> {
    await this.init();
    const entry = `[${new Date().toISOString()}] ${log}`;
    await this.pool.query(
      `UPDATE deployments SET logs = logs || $2::jsonb WHERE id = $1`,
      [id, JSON.stringify([entry])]
    );
  }

  // === Usage Records ===

  async createUsageRecord(record: Omit<UsageRecord, 'id'>): Promise<UsageRecord> {
    await this.init();
    const id = this.generateId();
    const { rows } = await this.pool.query(
      `INSERT INTO usage_records (id, user_id, project_id, environment_id, period_start, period_end, compute_minutes, bandwidth_gb, cost_cents)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [id, record.userId, record.projectId, record.environmentId, record.periodStart, record.periodEnd, record.computeMinutes, record.bandwidthGb, record.costCents]
    );
    return this.mapUsageRecord(rows[0]);
  }

  async getUsageByUserId(userId: string, startDate: Date, endDate: Date): Promise<UsageRecord[]> {
    await this.init();
    const { rows } = await this.pool.query(
      'SELECT * FROM usage_records WHERE user_id = $1 AND period_start >= $2 AND period_end <= $3',
      [userId, startDate, endDate]
    );
    return rows.map(r => this.mapUsageRecord(r));
  }

  // === AI Usage ===

  async createAIUsageRecord(record: Omit<AIUsageRecord, 'id'>): Promise<AIUsageRecord> {
    await this.init();
    const id = this.generateId();
    const { rows } = await this.pool.query(
      `INSERT INTO ai_usage_records (id, user_id, project_id, model, provider, input_tokens, output_tokens, is_premium, cost_cents)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [id, record.userId, record.projectId || null, record.model, record.provider, record.inputTokens, record.outputTokens, record.isPremium, record.costCents]
    );
    return this.mapAIUsageRecord(rows[0]);
  }

  async getAIUsageByUserId(userId: string, startDate?: Date, endDate?: Date): Promise<AIUsageRecord[]> {
    await this.init();
    let q = 'SELECT * FROM ai_usage_records WHERE user_id = $1';
    const vals: unknown[] = [userId];
    if (startDate) { q += ` AND created_at >= $${vals.length + 1}`; vals.push(startDate); }
    if (endDate) { q += ` AND created_at <= $${vals.length + 1}`; vals.push(endDate); }
    q += ' ORDER BY created_at DESC';
    const { rows } = await this.pool.query(q, vals);
    return rows.map(r => this.mapAIUsageRecord(r));
  }

  async getAIUsageByProjectId(projectId: string): Promise<AIUsageRecord[]> {
    await this.init();
    const { rows } = await this.pool.query(
      'SELECT * FROM ai_usage_records WHERE project_id = $1 ORDER BY created_at DESC',
      [projectId]
    );
    return rows.map(r => this.mapAIUsageRecord(r));
  }

  async getAIUsageSummary(userId: string, startDate: Date, endDate: Date) {
    await this.init();
    const records = await this.getAIUsageByUserId(userId, startDate, endDate);
    const summary = {
      totalInputTokens: 0, totalOutputTokens: 0, totalCostCents: 0,
      premiumCostCents: 0, standardCostCents: 0,
      byModel: {} as Record<string, { inputTokens: number; outputTokens: number; costCents: number }>,
      byProject: {} as Record<string, { inputTokens: number; outputTokens: number; costCents: number }>,
    };
    for (const r of records) {
      summary.totalInputTokens += r.inputTokens;
      summary.totalOutputTokens += r.outputTokens;
      summary.totalCostCents += r.costCents;
      if (r.isPremium) summary.premiumCostCents += r.costCents;
      else summary.standardCostCents += r.costCents;
      if (!summary.byModel[r.model]) summary.byModel[r.model] = { inputTokens: 0, outputTokens: 0, costCents: 0 };
      summary.byModel[r.model].inputTokens += r.inputTokens;
      summary.byModel[r.model].outputTokens += r.outputTokens;
      summary.byModel[r.model].costCents += r.costCents;
      const pk = r.projectId || 'no-project';
      if (!summary.byProject[pk]) summary.byProject[pk] = { inputTokens: 0, outputTokens: 0, costCents: 0 };
      summary.byProject[pk].inputTokens += r.inputTokens;
      summary.byProject[pk].outputTokens += r.outputTokens;
      summary.byProject[pk].costCents += r.costCents;
    }
    return summary;
  }

  // === User Preferences ===

  async getUserPreferences(userId: string): Promise<UserPreferences | null> {
    await this.init();
    const { rows } = await this.pool.query('SELECT * FROM user_preferences WHERE user_id = $1', [userId]);
    return rows[0] ? this.mapPreferences(rows[0]) : null;
  }

  async upsertUserPreferences(userId: string, prefs: Partial<UserPreferences>): Promise<UserPreferences> {
    await this.init();
    const { rows } = await this.pool.query(
      `INSERT INTO user_preferences (user_id, theme, custom_icons, github_token, github_username)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO UPDATE SET
         theme = COALESCE($2, user_preferences.theme),
         custom_icons = COALESCE($3, user_preferences.custom_icons),
         github_token = COALESCE($4, user_preferences.github_token),
         github_username = COALESCE($5, user_preferences.github_username)
       RETURNING *`,
      [userId, prefs.theme || 'auto', JSON.stringify(prefs.customIcons || {}), prefs.githubToken || null, prefs.githubUsername || null]
    );
    return this.mapPreferences(rows[0]);
  }

  // === Project Members ===

  async addProjectMember(projectId: string, userId: string, role: ProjectMember['role'], invitedBy: string): Promise<ProjectMember> {
    await this.init();
    const id = this.generateId();
    const { rows } = await this.pool.query(
      `INSERT INTO project_members (id, project_id, user_id, role, invited_by, accepted_at)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [id, projectId, userId, role, invitedBy, role === 'owner' ? new Date() : null]
    );
    return this.mapMember(rows[0]);
  }

  async getProjectMembers(projectId: string): Promise<ProjectMember[]> {
    await this.init();
    const { rows } = await this.pool.query('SELECT * FROM project_members WHERE project_id = $1', [projectId]);
    return rows.map(r => this.mapMember(r));
  }

  async getProjectMember(projectId: string, userId: string): Promise<ProjectMember | null> {
    await this.init();
    const { rows } = await this.pool.query(
      'SELECT * FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, userId]
    );
    return rows[0] ? this.mapMember(rows[0]) : null;
  }

  async updateProjectMember(id: string, updates: Partial<ProjectMember>): Promise<ProjectMember | null> {
    await this.init();
    const sets: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;
    if (updates.role !== undefined) { sets.push(`role = $${idx++}`); vals.push(updates.role); }
    if (updates.acceptedAt !== undefined) { sets.push(`accepted_at = $${idx++}`); vals.push(updates.acceptedAt); }
    if (sets.length === 0) return null;
    vals.push(id);
    const { rows } = await this.pool.query(`UPDATE project_members SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`, vals);
    return rows[0] ? this.mapMember(rows[0]) : null;
  }

  async removeProjectMember(id: string): Promise<boolean> {
    await this.init();
    const { rowCount } = await this.pool.query('DELETE FROM project_members WHERE id = $1', [id]);
    return (rowCount ?? 0) > 0;
  }

  async getProjectsForMember(userId: string): Promise<Project[]> {
    await this.init();
    const { rows } = await this.pool.query(
      `SELECT p.* FROM projects p
       JOIN project_members pm ON pm.project_id = p.id
       WHERE pm.user_id = $1 AND p.archived_at IS NULL
       ORDER BY p.updated_at DESC`,
      [userId]
    );
    return rows.map(r => this.mapProject(r));
  }

  // === Project Invites ===

  async createProjectInvite(projectId: string, email: string, role: ProjectInvite['role'], invitedBy: string): Promise<ProjectInvite> {
    await this.init();
    const id = this.generateId();
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const { rows } = await this.pool.query(
      `INSERT INTO project_invites (id, project_id, email, role, token, invited_by, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [id, projectId, email.toLowerCase(), role, token, invitedBy, expiresAt]
    );
    return this.mapInvite(rows[0]);
  }

  async getProjectInvite(token: string): Promise<ProjectInvite | null> {
    await this.init();
    const { rows } = await this.pool.query('SELECT * FROM project_invites WHERE token = $1', [token]);
    return rows[0] ? this.mapInvite(rows[0]) : null;
  }

  async getProjectInvitesByProjectId(projectId: string): Promise<ProjectInvite[]> {
    await this.init();
    const { rows } = await this.pool.query(
      'SELECT * FROM project_invites WHERE project_id = $1 AND accepted_at IS NULL',
      [projectId]
    );
    return rows.map(r => this.mapInvite(r));
  }

  async acceptProjectInvite(token: string, userId: string): Promise<ProjectMember | null> {
    await this.init();
    const invite = await this.getProjectInvite(token);
    if (!invite || invite.acceptedAt || new Date() > invite.expiresAt) return null;
    await this.pool.query('UPDATE project_invites SET accepted_at = NOW() WHERE token = $1', [token]);
    return this.addProjectMember(invite.projectId, userId, invite.role, invite.invitedBy);
  }

  async deleteProjectInvite(id: string): Promise<boolean> {
    await this.init();
    const { rowCount } = await this.pool.query('DELETE FROM project_invites WHERE id = $1', [id]);
    return (rowCount ?? 0) > 0;
  }

  // === Contacts ===

  async createContact(tenantId: string, data: Omit<Contact, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>): Promise<Contact> {
    await this.init();
    const id = this.generateId();
    const { rows } = await this.pool.query(
      `INSERT INTO contacts (id, tenant_id, first_name, last_name, email, phone, timezone, status, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [id, tenantId, data.firstName, data.lastName, data.email, data.phone || null, data.timezone || null, data.status, JSON.stringify(data.metadata)]
    );
    return this.mapContact(rows[0]);
  }

  async getContactById(id: string): Promise<Contact | null> {
    await this.init();
    const { rows } = await this.pool.query('SELECT * FROM contacts WHERE id = $1', [id]);
    return rows[0] ? this.mapContact(rows[0]) : null;
  }

  async getContactsByTenantId(tenantId: string, status?: Contact['status']): Promise<Contact[]> {
    await this.init();
    let q = 'SELECT * FROM contacts WHERE tenant_id = $1';
    const vals: unknown[] = [tenantId];
    if (status) { q += ' AND status = $2'; vals.push(status); }
    q += ' ORDER BY updated_at DESC';
    const { rows } = await this.pool.query(q, vals);
    return rows.map(r => this.mapContact(r));
  }

  async updateContact(id: string, updates: Partial<Contact>): Promise<Contact | null> {
    await this.init();
    const sets: string[] = ['updated_at = NOW()'];
    const vals: unknown[] = [];
    let idx = 1;
    if (updates.firstName !== undefined) { sets.push(`first_name = $${idx++}`); vals.push(updates.firstName); }
    if (updates.lastName !== undefined) { sets.push(`last_name = $${idx++}`); vals.push(updates.lastName); }
    if (updates.email !== undefined) { sets.push(`email = $${idx++}`); vals.push(updates.email); }
    if (updates.phone !== undefined) { sets.push(`phone = $${idx++}`); vals.push(updates.phone); }
    if (updates.status !== undefined) { sets.push(`status = $${idx++}`); vals.push(updates.status); }
    if (updates.metadata !== undefined) { sets.push(`metadata = $${idx++}`); vals.push(JSON.stringify(updates.metadata)); }
    vals.push(id);
    const { rows } = await this.pool.query(`UPDATE contacts SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`, vals);
    return rows[0] ? this.mapContact(rows[0]) : null;
  }

  async deleteContact(id: string): Promise<boolean> {
    await this.init();
    const { rowCount } = await this.pool.query('DELETE FROM contacts WHERE id = $1', [id]);
    return (rowCount ?? 0) > 0;
  }

  async findContactByEmail(tenantId: string, email: string): Promise<Contact | null> {
    await this.init();
    const { rows } = await this.pool.query(
      'SELECT * FROM contacts WHERE tenant_id = $1 AND LOWER(email) = $2',
      [tenantId, email.toLowerCase()]
    );
    return rows[0] ? this.mapContact(rows[0]) : null;
  }

  // === Notes ===

  async createNote(tenantId: string, data: Omit<Note, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>): Promise<Note> {
    await this.init();
    const id = this.generateId();
    const { rows } = await this.pool.query(
      `INSERT INTO notes (id, tenant_id, contact_id, title, content, tags, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [id, tenantId, data.contactId, data.title, data.content, JSON.stringify(data.tags), JSON.stringify(data.metadata)]
    );
    return this.mapNote(rows[0]);
  }

  async getNoteById(id: string): Promise<Note | null> {
    await this.init();
    const { rows } = await this.pool.query('SELECT * FROM notes WHERE id = $1', [id]);
    return rows[0] ? this.mapNote(rows[0]) : null;
  }

  async getNotesByContactId(contactId: string): Promise<Note[]> {
    await this.init();
    const { rows } = await this.pool.query('SELECT * FROM notes WHERE contact_id = $1 ORDER BY updated_at DESC', [contactId]);
    return rows.map(r => this.mapNote(r));
  }

  async updateNote(id: string, updates: Partial<Note>): Promise<Note | null> {
    await this.init();
    const sets: string[] = ['updated_at = NOW()'];
    const vals: unknown[] = [];
    let idx = 1;
    if (updates.title !== undefined) { sets.push(`title = $${idx++}`); vals.push(updates.title); }
    if (updates.content !== undefined) { sets.push(`content = $${idx++}`); vals.push(updates.content); }
    if (updates.tags !== undefined) { sets.push(`tags = $${idx++}`); vals.push(JSON.stringify(updates.tags)); }
    if (updates.metadata !== undefined) { sets.push(`metadata = $${idx++}`); vals.push(JSON.stringify(updates.metadata)); }
    vals.push(id);
    const { rows } = await this.pool.query(`UPDATE notes SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`, vals);
    return rows[0] ? this.mapNote(rows[0]) : null;
  }

  async deleteNote(id: string): Promise<boolean> {
    await this.init();
    const { rowCount } = await this.pool.query('DELETE FROM notes WHERE id = $1', [id]);
    return (rowCount ?? 0) > 0;
  }

  // === Contact Interactions ===

  async createContactInteraction(tenantId: string, data: Omit<ContactInteraction, 'id' | 'tenantId' | 'createdAt'>): Promise<ContactInteraction> {
    await this.init();
    const id = this.generateId();
    const { rows } = await this.pool.query(
      `INSERT INTO contact_interactions (id, tenant_id, contact_id, type, channel, title, description, occurred_at, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [id, tenantId, data.contactId, data.type, data.channel, data.title, data.description || null, data.occurredAt, JSON.stringify(data.metadata)]
    );
    return this.mapInteraction(rows[0]);
  }

  async getContactInteractionById(id: string): Promise<ContactInteraction | null> {
    await this.init();
    const { rows } = await this.pool.query('SELECT * FROM contact_interactions WHERE id = $1', [id]);
    return rows[0] ? this.mapInteraction(rows[0]) : null;
  }

  async getContactInteractionsByContactId(contactId: string): Promise<ContactInteraction[]> {
    await this.init();
    const { rows } = await this.pool.query(
      'SELECT * FROM contact_interactions WHERE contact_id = $1 ORDER BY occurred_at DESC',
      [contactId]
    );
    return rows.map(r => this.mapInteraction(r));
  }

  async getContactInteractionsByTenantId(tenantId: string, startDate?: Date, endDate?: Date): Promise<ContactInteraction[]> {
    await this.init();
    let q = 'SELECT * FROM contact_interactions WHERE tenant_id = $1';
    const vals: unknown[] = [tenantId];
    if (startDate) { q += ` AND occurred_at >= $${vals.length + 1}`; vals.push(startDate); }
    if (endDate) { q += ` AND occurred_at <= $${vals.length + 1}`; vals.push(endDate); }
    q += ' ORDER BY occurred_at DESC';
    const { rows } = await this.pool.query(q, vals);
    return rows.map(r => this.mapInteraction(r));
  }

  // ── Row mappers ─────────────────────────────────────────────────────

  private mapUser(row: Record<string, unknown>): User {
    return {
      id: row.id as string,
      email: row.email as string,
      passwordHash: row.password_hash as string,
      name: row.name as string,
      createdAt: new Date(row.created_at as string),
      stripeCustomerId: row.stripe_customer_id as string | undefined,
    };
  }

  private mapProject(row: Record<string, unknown>): Project {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      name: row.name as string,
      slug: row.slug as string,
      documentation: (row.documentation as string) || '',
      architecture: typeof row.architecture === 'string' ? JSON.parse(row.architecture) : row.architecture as Project['architecture'],
      connectionLabels: typeof row.connection_labels === 'string' ? JSON.parse(row.connection_labels) : (row.connection_labels as Record<string, string>) || {},
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
      archivedAt: row.archived_at ? new Date(row.archived_at as string) : undefined,
      archivedBy: row.archived_by as string | undefined,
    };
  }

  private mapEnvironment(row: Record<string, unknown>): Environment {
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

  private mapDeployment(row: Record<string, unknown>): Deployment {
    return {
      id: row.id as string,
      environmentId: row.environment_id as string,
      projectId: row.project_id as string,
      userId: row.user_id as string,
      status: row.status as Deployment['status'],
      doAppId: row.do_app_id as string | undefined,
      url: row.url as string | undefined,
      logs: (typeof row.logs === 'string' ? JSON.parse(row.logs) : row.logs) as string[],
      startedAt: new Date(row.started_at as string),
      completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
      error: row.error as string | undefined,
    };
  }

  private mapUsageRecord(row: Record<string, unknown>): UsageRecord {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      projectId: row.project_id as string,
      environmentId: row.environment_id as string,
      periodStart: new Date(row.period_start as string),
      periodEnd: new Date(row.period_end as string),
      computeMinutes: Number(row.compute_minutes),
      bandwidthGb: Number(row.bandwidth_gb),
      costCents: Number(row.cost_cents),
    };
  }

  private mapAIUsageRecord(row: Record<string, unknown>): AIUsageRecord {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      projectId: row.project_id as string | undefined,
      model: row.model as string,
      provider: row.provider as string,
      inputTokens: Number(row.input_tokens),
      outputTokens: Number(row.output_tokens),
      isPremium: row.is_premium as boolean,
      costCents: Number(row.cost_cents),
      createdAt: new Date(row.created_at as string),
    };
  }

  private mapPreferences(row: Record<string, unknown>): UserPreferences {
    return {
      userId: row.user_id as string,
      theme: row.theme as UserPreferences['theme'],
      customIcons: (typeof row.custom_icons === 'string' ? JSON.parse(row.custom_icons) : row.custom_icons) as Record<string, string>,
      githubToken: row.github_token as string | undefined,
      githubUsername: row.github_username as string | undefined,
    };
  }

  private mapMember(row: Record<string, unknown>): ProjectMember {
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

  private mapInvite(row: Record<string, unknown>): ProjectInvite {
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

  private mapContact(row: Record<string, unknown>): Contact {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      firstName: row.first_name as string,
      lastName: row.last_name as string,
      email: row.email as string,
      phone: row.phone as string | undefined,
      timezone: row.timezone as string | undefined,
      status: row.status as Contact['status'],
      metadata: (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) as Record<string, unknown>,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  private mapNote(row: Record<string, unknown>): Note {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      contactId: row.contact_id as string,
      title: row.title as string,
      content: row.content as string,
      tags: (typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags) as string[],
      metadata: (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) as Record<string, unknown>,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  private mapInteraction(row: Record<string, unknown>): ContactInteraction {
    return {
      id: row.id as string,
      tenantId: row.tenant_id as string,
      contactId: row.contact_id as string,
      type: row.type as string,
      channel: row.channel as string,
      title: row.title as string,
      description: row.description as string | undefined,
      occurredAt: new Date(row.occurred_at as string),
      metadata: (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) as Record<string, unknown>,
      createdAt: new Date(row.created_at as string),
    };
  }
}
