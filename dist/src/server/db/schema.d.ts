export interface User {
    id: string;
    email: string;
    passwordHash: string;
    name: string;
    createdAt: Date;
    stripeCustomerId?: string;
}
export interface Project {
    id: string;
    userId: string;
    name: string;
    slug: string;
    documentation: string;
    architecture: {
        components: Array<{
            id: string;
            name: string;
            type: 'service' | 'static_site' | 'database' | 'worker' | 'job';
            spec?: {
                description?: string;
                inputs?: string;
                outputs?: string;
                notes?: string;
            };
        }>;
        connections: Array<{
            from: string;
            to: string;
            label?: string;
        }>;
    };
    connectionLabels: Record<string, string>;
    bac?: Record<string, unknown> | null;
    componentSpecs?: Record<string, Record<string, unknown>>;
    diagram?: string | null;
    lastGeneratedComponents?: Array<Record<string, unknown>>;
    createdAt: Date;
    updatedAt: Date;
    archivedAt?: Date;
    archivedBy?: string;
}
export interface Environment {
    id: string;
    projectId: string;
    name: 'development' | 'staging' | 'production';
    status: 'not_deployed' | 'deploying' | 'live' | 'failed' | 'stopped';
    doAppId?: string;
    url?: string;
    lastDeployedAt?: Date;
    monthlyCostCents: number;
}
export interface Deployment {
    id: string;
    environmentId: string;
    projectId: string;
    userId: string;
    status: 'pending' | 'building' | 'deploying' | 'live' | 'failed' | 'cancelled';
    doAppId?: string;
    url?: string;
    logs: string[];
    startedAt: Date;
    completedAt?: Date;
    error?: string;
}
export interface UsageRecord {
    id: string;
    userId: string;
    projectId: string;
    environmentId: string;
    periodStart: Date;
    periodEnd: Date;
    computeMinutes: number;
    bandwidthGb: number;
    costCents: number;
}
export interface AIUsageRecord {
    id: string;
    userId: string;
    projectId?: string;
    model: string;
    provider: string;
    inputTokens: number;
    outputTokens: number;
    isPremium: boolean;
    costCents: number;
    createdAt: Date;
}
export interface UserPreferences {
    userId: string;
    theme: 'light' | 'dark' | 'auto';
    customIcons: Record<string, string>;
    githubToken?: string;
    githubUsername?: string;
    preferredModel?: string;
}
export interface ProjectMember {
    id: string;
    projectId: string;
    userId: string;
    role: 'owner' | 'editor' | 'viewer';
    invitedBy: string;
    invitedAt: Date;
    acceptedAt?: Date;
}
export interface ProjectInvite {
    id: string;
    projectId: string;
    email: string;
    role: 'editor' | 'viewer';
    token: string;
    invitedBy: string;
    createdAt: Date;
    expiresAt: Date;
    acceptedAt?: Date;
}
export interface Feature {
    id: string;
    projectId: string;
    title: string;
    description: string;
    status: 'backlog' | 'in_progress' | 'review' | 'deployed';
    agentStatus?: 'waiting' | 'needs_context' | 'planning' | 'building' | 'testing' | 'complete' | 'error' | null;
    agentMessage?: string;
    position: number;
    timerEnd?: Date | null;
    createdAt: Date;
    updatedAt: Date;
}
export interface Message {
    id: string;
    projectId: string;
    userId: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    contextMode: 'architecture' | 'code' | 'docs';
    metadata: Record<string, unknown>;
    createdAt: Date;
}
export interface ProjectFile {
    id: string;
    projectId: string;
    path: string;
    content: string;
    componentId?: string;
    isManuallyEdited: boolean;
    generatedAt: Date;
    updatedAt: Date;
}
export interface Contact {
    id: string;
    tenantId: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    timezone?: string;
    status: 'active' | 'inactive' | 'lead' | 'archived';
    metadata: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
}
export interface Note {
    id: string;
    tenantId: string;
    contactId: string;
    title: string;
    content: string;
    tags: string[];
    metadata: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
}
export interface ContactInteraction {
    id: string;
    tenantId: string;
    contactId: string;
    type: string;
    channel: string;
    title: string;
    description?: string;
    occurredAt: Date;
    metadata: Record<string, unknown>;
    createdAt: Date;
}
export interface DatabaseClient {
    createUser(email: string, passwordHash: string, name: string): Promise<User>;
    getUserById(id: string): Promise<User | null>;
    getUserByEmail(email: string): Promise<User | null>;
    updateUser(id: string, updates: Partial<User>): Promise<User | null>;
    createProject(userId: string, name: string, architecture: Project['architecture']): Promise<Project>;
    getProjectById(id: string): Promise<Project | null>;
    getProjectsByUserId(userId: string, includeArchived?: boolean): Promise<Project[]>;
    updateProject(id: string, updates: Partial<Project>): Promise<Project | null>;
    deleteProject(id: string): Promise<boolean>;
    archiveProject(id: string, userId: string): Promise<Project | null>;
    restoreProject(id: string): Promise<Project | null>;
    createEnvironment(projectId: string, name: Environment['name']): Promise<Environment>;
    getEnvironmentById(id: string): Promise<Environment | null>;
    getEnvironmentsByProjectId(projectId: string): Promise<Environment[]>;
    updateEnvironment(id: string, updates: Partial<Environment>): Promise<Environment | null>;
    createDeployment(environmentId: string, projectId: string, userId: string): Promise<Deployment>;
    getDeploymentById(id: string): Promise<Deployment | null>;
    getDeploymentsByEnvironmentId(environmentId: string): Promise<Deployment[]>;
    updateDeployment(id: string, updates: Partial<Deployment>): Promise<Deployment | null>;
    appendDeploymentLog(id: string, log: string): Promise<void>;
    createUsageRecord(record: Omit<UsageRecord, 'id'>): Promise<UsageRecord>;
    getUsageByUserId(userId: string, startDate: Date, endDate: Date): Promise<UsageRecord[]>;
    createAIUsageRecord(record: Omit<AIUsageRecord, 'id'>): Promise<AIUsageRecord>;
    getAIUsageByUserId(userId: string, startDate?: Date, endDate?: Date): Promise<AIUsageRecord[]>;
    getAIUsageByProjectId(projectId: string): Promise<AIUsageRecord[]>;
    getAIUsageSummary(userId: string, startDate: Date, endDate: Date): Promise<{
        totalInputTokens: number;
        totalOutputTokens: number;
        totalCostCents: number;
        premiumCostCents: number;
        standardCostCents: number;
        byModel: Record<string, {
            inputTokens: number;
            outputTokens: number;
            costCents: number;
        }>;
        byProject: Record<string, {
            inputTokens: number;
            outputTokens: number;
            costCents: number;
        }>;
    }>;
    getUserPreferences(userId: string): Promise<UserPreferences | null>;
    upsertUserPreferences(userId: string, prefs: Partial<UserPreferences>): Promise<UserPreferences>;
    addProjectMember(projectId: string, userId: string, role: ProjectMember['role'], invitedBy: string): Promise<ProjectMember>;
    getProjectMembers(projectId: string): Promise<ProjectMember[]>;
    getProjectMember(projectId: string, userId: string): Promise<ProjectMember | null>;
    updateProjectMember(id: string, updates: Partial<ProjectMember>): Promise<ProjectMember | null>;
    removeProjectMember(id: string): Promise<boolean>;
    getProjectsForMember(userId: string): Promise<Project[]>;
    createProjectInvite(projectId: string, email: string, role: ProjectInvite['role'], invitedBy: string): Promise<ProjectInvite>;
    getProjectInvite(token: string): Promise<ProjectInvite | null>;
    getProjectInvitesByProjectId(projectId: string): Promise<ProjectInvite[]>;
    acceptProjectInvite(token: string, userId: string): Promise<ProjectMember | null>;
    deleteProjectInvite(id: string): Promise<boolean>;
    createFeature(projectId: string, title: string, description: string): Promise<Feature>;
    getFeaturesByProjectId(projectId: string): Promise<Feature[]>;
    getFeatureById(id: string): Promise<Feature | null>;
    updateFeature(id: string, updates: Partial<Feature>): Promise<Feature | null>;
    deleteFeature(id: string): Promise<boolean>;
    createMessage(data: Omit<Message, 'id' | 'createdAt'>): Promise<Message>;
    getMessagesByProjectId(projectId: string, limit?: number): Promise<Message[]>;
    deleteMessagesByProjectId(projectId: string): Promise<boolean>;
    upsertProjectFile(projectId: string, path: string, content: string, componentId?: string): Promise<ProjectFile>;
    getProjectFilesByProjectId(projectId: string): Promise<ProjectFile[]>;
    getProjectFile(projectId: string, path: string): Promise<ProjectFile | null>;
    updateProjectFile(projectId: string, path: string, content: string): Promise<ProjectFile | null>;
    deleteProjectFilesByProjectId(projectId: string): Promise<boolean>;
    createContact(tenantId: string, data: Omit<Contact, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>): Promise<Contact>;
    getContactById(id: string): Promise<Contact | null>;
    getContactsByTenantId(tenantId: string, status?: Contact['status']): Promise<Contact[]>;
    updateContact(id: string, updates: Partial<Contact>): Promise<Contact | null>;
    deleteContact(id: string): Promise<boolean>;
    findContactByEmail(tenantId: string, email: string): Promise<Contact | null>;
    createNote(tenantId: string, data: Omit<Note, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>): Promise<Note>;
    getNoteById(id: string): Promise<Note | null>;
    getNotesByContactId(contactId: string): Promise<Note[]>;
    updateNote(id: string, updates: Partial<Note>): Promise<Note | null>;
    deleteNote(id: string): Promise<boolean>;
    createContactInteraction(tenantId: string, data: Omit<ContactInteraction, 'id' | 'tenantId' | 'createdAt'>): Promise<ContactInteraction>;
    getContactInteractionById(id: string): Promise<ContactInteraction | null>;
    getContactInteractionsByContactId(contactId: string): Promise<ContactInteraction[]>;
    getContactInteractionsByTenantId(tenantId: string, startDate?: Date, endDate?: Date): Promise<ContactInteraction[]>;
}
//# sourceMappingURL=schema.d.ts.map