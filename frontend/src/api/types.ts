// Shared types matching the backend API contracts

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  description?: string;
  userId: string;
  status?: string;
  environments?: EnvironmentInfo[];
  estimatedMonthlyCostCents?: number;
  createdAt: string;
  updatedAt: string;
  editedAt?: string;
  architecture?: ManualArchitecture;
  bac?: BrickAppContract;
  diagram?: string;
  componentSpecs?: Record<string, ComponentSpec>;
}

export type ComponentType =
  | 'service'
  | 'static_site'
  | 'database'
  | 'cache'
  | 'queue'
  | 'worker'
  | 'cdn'
  | 'api_gateway'
  | 'load_balancer'
  | 'auth'
  | 'storage'
  | 'search'
  | 'monitoring'
  | 'ml_model';

export interface ArchComponent {
  id: string;
  name: string;
  type: ComponentType;
  x: number;
  y: number;
}

export interface ArchConnectionContract {
  sourceOutput?: string;
  targetInput?: string;
  notes?: string;
}

export interface ArchConnection {
  from: string;
  to: string;
  label?: string;
  contract?: ArchConnectionContract;
}

export interface ManualArchitecture {
  name: string;
  components: ArchComponent[];
  connections: ArchConnection[];
}

export interface ComponentSpec {
  description?: string;
  inputs?: string;
  outputs?: string;
  notes?: string;
  technology?: string;
  innerComponents?: Array<{ name: string; description: string }>;
}

export interface BrickAppContract {
  version: string;
  metadata: {
    name: string;
    description?: string;
    owner?: string;
  };
  nodes: BACNode[];
  edges: BACEdge[];
}

export interface BACNode {
  id: string;
  name: string;
  type: string;
  spec?: {
    description?: string;
    inputs?: string;
    outputs?: string;
    notes?: string;
    runtime?: string;
    framework?: string;
    port?: number;
    engine?: string;
    version?: string;
  };
}

export interface BACEdge {
  from: string;
  to: string;
  label?: string;
  contract?: string;
  protocol?: string;
}

export interface BACPatch {
  op: 'add_node' | 'remove_node' | 'update_node' | 'add_edge' | 'remove_edge' | 'update_edge' | 'set_metadata';
  path?: string;
  value?: unknown;
}

export interface CostEstimate {
  monthly: number;
  breakdown: Array<{ name: string; cost: number }>;
}

export interface ProjectFile {
  path: string;
  content: string;
  componentId?: string;
  generatedAt?: string;
  isManuallyEdited?: boolean;
}

export interface ArchitectureTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  longDescription?: string;
  architecture: ManualArchitecture;
  components?: Array<{ type: string; name: string; description: string }>;
}

export interface LLMModel {
  id: string;
  name: string;
  provider: string;
}

// Feature/Kanban types
export type FeatureStatus = 'backlog' | 'in_progress' | 'review' | 'deployed';
export type AgentStatus = 'waiting' | 'needs_context' | 'planning' | 'building' | 'testing' | 'complete' | 'error';

export interface Feature {
  id: string;
  title: string;
  description: string;
  status: FeatureStatus;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  agentStatus?: AgentStatus | null;
  agentMessage?: string;
  timerEnd?: string | null;
}

// Chat context mode
export type ChatContextMode = 'architecture' | 'code' | 'docs';

// Chat types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  diagram?: string;
  cost?: CostEstimate;
}

// BAC Completeness
export interface BACCompleteness {
  complete: boolean;
  incompleteNodes?: Array<{ nodeId: string; nodeName: string; fields: string[] }>;
  incompleteEdges?: Array<{ from: string; to: string; fields: string[] }>;
  error?: string;
}

// Deployment types
export type EnvironmentName = 'development' | 'staging' | 'production';
export type EnvironmentStatus = 'not_deployed' | 'deploying' | 'live' | 'failed' | 'stopped';
export type DeploymentStatus = 'pending' | 'building' | 'deploying' | 'live' | 'failed' | 'cancelled';

export interface EnvironmentInfo {
  id: string;
  name: EnvironmentName;
  status: EnvironmentStatus;
  url?: string;
  lastDeployedAt?: string;
  monthlyCostCents?: number;
}

export interface DeploymentInfo {
  id: string;
  status: DeploymentStatus;
  url?: string;
  logs?: string[];
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

// Preview types
export interface PreviewStatus {
  status: 'not_started' | 'starting' | 'running' | 'error' | 'stopped';
  services?: Array<{ name: string; status: string; port?: number }>;
  startedAt?: string;
  error?: string;
  urls?: Record<string, string>;
}
