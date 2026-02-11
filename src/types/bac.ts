export type AILeverage = 'low' | 'medium' | 'high';

export type AIOpportunityMode =
  | 'chat_agent'
  | 'agent_workflow'
  | 'backend_ai_service'
  | 'none_for_now';

export type AIOpportunityDecision =
  | 'include_in_v1'
  | 'defer_to_v2'
  | 'exclude';

export type AIFlowType = Exclude<AIOpportunityMode, 'none_for_now'>;

export interface BACMetadata {
  name: string;
  vertical?: string;
  createdAt: string;
  updatedAt: string;
  source: 'manual' | 'derived';
}

export interface BACProductOutcome {
  summary: string;
  userJobs: string[];
  nonGoals: string[];
}

export interface BACEntity {
  id: string;
  name: string;
  description: string;
}

export interface BACWorkflow {
  id: string;
  name: string;
  description: string;
  components: string[];
}

export interface BACIntegration {
  id: string;
  name: string;
  category: 'internal' | 'external';
  purpose: string;
}

export interface BACRuntimeConstraint {
  key: string;
  value: string;
}

export interface BACObservabilityGate {
  id: string;
  name: string;
  description: string;
  required: boolean;
}

export interface AIOpportunityAssessment {
  workflowId: string;
  leverage: AILeverage;
  proposedMode: AIOpportunityMode;
  expectedValue: string;
  risks: string[];
  decision: AIOpportunityDecision;
  reason: string;
  revisitTrigger?: string;
}

export interface AIFlowTool {
  name: string;
  scope: 'read' | 'write' | 'execute';
}

export interface AIFlowOutputContract {
  format: 'json' | 'markdown' | 'structured_event';
  fields: string[];
}

export interface AIFlowAuditSettings {
  logInputs: boolean;
  logOutputs: boolean;
  logActions: boolean;
}

export interface AIFlowSpec {
  id: string;
  name: string;
  type: AIFlowType;
  trigger: 'user_action' | 'schedule' | 'event';
  contextSources: string[];
  tools: AIFlowTool[];
  outputContract: AIFlowOutputContract;
  guardrails: string[];
  fallback: string;
  successMetrics: string[];
  audit: AIFlowAuditSettings;
}

export interface BACPlatformPolicy {
  modelRouter: 'openrouter' | 'none';
  defaultEditStrategy: 'targeted_edit' | 'full_regeneration';
}

export interface BACRuntime {
  region?: string;
  constraints: BACRuntimeConstraint[];
}

export interface BACObservability {
  qualityGates: BACObservabilityGate[];
}

export interface BACNodeContract {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  description?: string;
  inputContract: string;
  outputContract: string;
  notes?: string;
}

export interface BACEdgeContract {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  label?: string;
  sourceOutputContract: string;
  targetInputContract: string;
  notes?: string;
}

export interface BACSystemContracts {
  nodes: BACNodeContract[];
  edges: BACEdgeContract[];
}

export interface BrickAppContract {
  version: '1.0';
  metadata: BACMetadata;
  productOutcome: BACProductOutcome;
  domainModel: {
    entities: BACEntity[];
  };
  workflows: BACWorkflow[];
  integrations: BACIntegration[];
  runtime: BACRuntime;
  observability: BACObservability;
  systemContracts: BACSystemContracts;
  platformPolicy: BACPlatformPolicy;
  aiOpportunityAssessment: AIOpportunityAssessment[];
  aiFlows: AIFlowSpec[];
}
