/**
 * CRM Types - Vertical-Agnostic Client Management
 *
 * Designed to support multiple verticals (coaching, fitness, consulting, healthcare, etc.)
 * with a flexible metadata-driven approach inspired by Twenty CRM.
 *
 * Core concepts:
 * - Client: The person being served (could be "Patient" in healthcare, "Athlete" in fitness)
 * - Transaction: Any interaction with a client (booking, payment, note, email, etc.)
 * - Engagement: Ongoing relationship tracking (sessions, packages, subscriptions)
 */

// ============================================================================
// VERTICAL CONFIGURATION
// ============================================================================

export type VerticalType =
  | 'coaching'
  | 'fitness'
  | 'consulting'
  | 'healthcare'
  | 'therapy'
  | 'education'
  | 'creative'
  | 'general';

export interface VerticalConfig {
  type: VerticalType;
  clientLabel: string; // "Client", "Patient", "Athlete", "Student"
  sessionLabel: string; // "Session", "Appointment", "Class", "Lesson"
  providerLabel: string; // "Coach", "Trainer", "Consultant", "Therapist"
  defaultFields: ClientFieldDefinition[];
  transactionTypes: TransactionType[];
}

// ============================================================================
// CLIENT MANAGEMENT
// ============================================================================

export interface Client {
  id: string;
  organizationId: string;

  // Core identity
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  avatarUrl?: string;

  // Status
  status: ClientStatus;
  stage: ClientStage;

  // Dates
  createdAt: string;
  updatedAt: string;
  lastInteractionAt?: string;
  nextScheduledAt?: string;

  // Source tracking
  source?: ClientSource;
  referredBy?: string;

  // Flexible metadata (vertical-specific fields)
  metadata: Record<string, unknown>;

  // Custom fields (user-defined)
  customFields: Record<string, unknown>;

  // Computed stats (denormalized for quick access)
  stats: ClientStats;

  // Tags for organization
  tags: string[];

  // Notes (quick notes, not full transactions)
  quickNote?: string;
}

export type ClientStatus =
  | 'lead' // Interested but not committed
  | 'active' // Currently engaged
  | 'paused' // Temporarily inactive
  | 'completed' // Finished program/engagement
  | 'churned'; // Left without completing

export type ClientStage =
  | 'inquiry' // Just reached out
  | 'discovery' // In discovery/consultation phase
  | 'proposal' // Reviewing proposal/package
  | 'onboarding' // Just signed up
  | 'engaged' // Actively working together
  | 'graduating' // Nearing completion
  | 'alumni'; // Past client

export interface ClientSource {
  channel: 'website' | 'referral' | 'social' | 'ads' | 'event' | 'other';
  campaign?: string;
  medium?: string;
  referrerId?: string;
}

export interface ClientStats {
  totalSessions: number;
  completedSessions: number;
  cancelledSessions: number;
  totalRevenue: number;
  outstandingBalance: number;
  lastPaymentAt?: string;
  averageSessionRating?: number;
  engagementScore: number; // 0-100 computed from activity
}

// ============================================================================
// CUSTOM FIELDS (Flexible Schema)
// ============================================================================

export interface ClientFieldDefinition {
  id: string;
  name: string;
  type: FieldType;
  category: 'contact' | 'profile' | 'engagement' | 'custom';
  required: boolean;
  options?: string[]; // For select/multiselect
  defaultValue?: unknown;
  verticals?: VerticalType[]; // Which verticals this applies to
  description?: string;
}

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'currency'
  | 'date'
  | 'datetime'
  | 'select'
  | 'multiselect'
  | 'boolean'
  | 'email'
  | 'phone'
  | 'url'
  | 'rating'; // 1-5 stars

// ============================================================================
// TRANSACTIONS (All Client Interactions)
// ============================================================================

/**
 * Transaction represents ANY interaction with a client.
 * This is the foundation for analytics and relationship history.
 */
export interface Transaction {
  id: string;
  clientId: string;
  organizationId: string;

  // What happened
  type: TransactionType;
  category: TransactionCategory;

  // When
  occurredAt: string;
  createdAt: string;

  // Context
  title: string;
  description?: string;
  metadata: Record<string, unknown>;

  // Financial (if applicable)
  amount?: number;
  currency?: string;

  // Relations
  sessionId?: string;
  packageId?: string;
  invoiceId?: string;

  // Actor
  createdBy: string; // User ID
  automated: boolean; // Was this auto-generated?
}

export type TransactionCategory =
  | 'scheduling' // Booking, cancellation, reschedule
  | 'financial' // Payment, refund, invoice
  | 'communication' // Email, call, message
  | 'session' // Session completed, notes added
  | 'milestone' // Goal reached, program completed
  | 'administrative'; // Status change, tag added

export type TransactionType =
  // Scheduling
  | 'booking_created'
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'booking_rescheduled'
  | 'booking_no_show'
  // Sessions
  | 'session_started'
  | 'session_completed'
  | 'session_notes_added'
  | 'session_rated'
  // Financial
  | 'payment_received'
  | 'payment_failed'
  | 'refund_issued'
  | 'invoice_sent'
  | 'invoice_paid'
  | 'package_purchased'
  | 'subscription_started'
  | 'subscription_cancelled'
  // Communication
  | 'email_sent'
  | 'email_opened'
  | 'sms_sent'
  | 'call_logged'
  | 'message_sent'
  // Milestones
  | 'goal_set'
  | 'goal_achieved'
  | 'program_started'
  | 'program_completed'
  | 'check_in_submitted'
  // Administrative
  | 'client_created'
  | 'client_updated'
  | 'status_changed'
  | 'stage_changed'
  | 'tag_added'
  | 'tag_removed'
  | 'note_added'
  | 'file_uploaded';

// ============================================================================
// SESSIONS / APPOINTMENTS
// ============================================================================

export interface Session {
  id: string;
  clientId: string;
  organizationId: string;

  // Scheduling
  scheduledAt: string;
  duration: number; // minutes
  timezone: string;

  // Status
  status: SessionStatus;

  // Type
  type: string; // "Discovery Call", "Coaching Session", "Group Class"
  location: SessionLocation;

  // Content
  title: string;
  description?: string;
  agenda?: string;
  notes?: string; // Post-session notes

  // Outcome
  rating?: number; // 1-5
  feedback?: string;
  actionItems?: ActionItem[];

  // Financial
  price?: number;
  paid: boolean;
  invoiceId?: string;

  // External
  externalId?: string; // Calendly event ID, etc.
  meetingUrl?: string;

  // Timestamps
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  cancelledAt?: string;
}

export type SessionStatus =
  | 'scheduled'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  | 'rescheduled';

export interface SessionLocation {
  type: 'video' | 'phone' | 'in_person' | 'other';
  details?: string; // Address, phone number, or meeting URL
  provider?: 'zoom' | 'google_meet' | 'teams' | 'other';
}

export interface ActionItem {
  id: string;
  text: string;
  completed: boolean;
  dueDate?: string;
  completedAt?: string;
}

// ============================================================================
// PACKAGES & SUBSCRIPTIONS
// ============================================================================

export interface Package {
  id: string;
  organizationId: string;

  name: string;
  description?: string;

  // Pricing
  price: number;
  currency: string;
  billingType: 'one_time' | 'recurring';
  billingInterval?: 'weekly' | 'monthly' | 'quarterly' | 'yearly';

  // What's included
  sessionCount?: number; // Number of sessions included
  validityDays?: number; // How long the package is valid
  features: string[];

  // Status
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ClientPackage {
  id: string;
  clientId: string;
  packageId: string;
  organizationId: string;

  // Usage
  sessionsUsed: number;
  sessionsRemaining: number;

  // Validity
  purchasedAt: string;
  expiresAt?: string;

  // Payment
  amountPaid: number;
  paymentStatus: 'pending' | 'paid' | 'partial' | 'refunded';

  // Status
  status: 'active' | 'expired' | 'exhausted' | 'cancelled';
}

// ============================================================================
// PAYMENTS & INVOICES
// ============================================================================

export interface Payment {
  id: string;
  clientId: string;
  organizationId: string;

  amount: number;
  currency: string;
  status: PaymentStatus;

  // Method
  method: 'card' | 'bank_transfer' | 'cash' | 'other';
  provider?: 'stripe' | 'square' | 'paypal' | 'manual';
  externalId?: string; // Stripe payment intent ID, etc.

  // What it's for
  description: string;
  invoiceId?: string;
  packageId?: string;
  sessionId?: string;

  // Timestamps
  createdAt: string;
  paidAt?: string;
  refundedAt?: string;

  // Metadata
  metadata: Record<string, unknown>;
}

export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'refunded'
  | 'partially_refunded';

export interface Invoice {
  id: string;
  clientId: string;
  organizationId: string;

  // Details
  number: string;
  status: InvoiceStatus;

  // Amounts
  subtotal: number;
  tax: number;
  total: number;
  amountPaid: number;
  amountDue: number;
  currency: string;

  // Line items
  items: InvoiceItem[];

  // Dates
  issuedAt: string;
  dueAt: string;
  paidAt?: string;

  // Notes
  notes?: string;
  terms?: string;
}

export type InvoiceStatus =
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'paid'
  | 'overdue'
  | 'cancelled';

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  sessionId?: string;
  packageId?: string;
}

// ============================================================================
// ANALYTICS HELPERS
// ============================================================================

export interface ClientTimeline {
  clientId: string;
  transactions: Transaction[];
  sessions: Session[];
  payments: Payment[];
}

export interface EngagementMetrics {
  clientId: string;
  period: 'week' | 'month' | 'quarter' | 'year' | 'all_time';

  // Activity
  sessionsCount: number;
  messagesCount: number;
  totalInteractions: number;

  // Financial
  totalRevenue: number;
  averageSessionValue: number;

  // Engagement
  attendanceRate: number; // Sessions attended / scheduled
  responseTime: number; // Average response time in hours

  // Satisfaction
  averageRating: number;
  npsScore?: number;
}

// ============================================================================
// VERTICAL PRESETS
// ============================================================================

export const VERTICAL_CONFIGS: Record<VerticalType, VerticalConfig> = {
  coaching: {
    type: 'coaching',
    clientLabel: 'Client',
    sessionLabel: 'Session',
    providerLabel: 'Coach',
    defaultFields: [
      { id: 'goals', name: 'Goals', type: 'textarea', category: 'engagement', required: false },
      { id: 'challenges', name: 'Current Challenges', type: 'textarea', category: 'engagement', required: false },
      { id: 'preferred_time', name: 'Preferred Session Time', type: 'select', category: 'profile', required: false, options: ['Morning', 'Afternoon', 'Evening'] },
    ],
    transactionTypes: ['booking_created', 'session_completed', 'payment_received', 'goal_achieved', 'note_added'],
  },
  fitness: {
    type: 'fitness',
    clientLabel: 'Athlete',
    sessionLabel: 'Training Session',
    providerLabel: 'Trainer',
    defaultFields: [
      { id: 'fitness_goals', name: 'Fitness Goals', type: 'multiselect', category: 'engagement', required: false, options: ['Weight Loss', 'Muscle Gain', 'Endurance', 'Flexibility', 'General Fitness'] },
      { id: 'injuries', name: 'Injuries/Limitations', type: 'textarea', category: 'profile', required: false },
      { id: 'experience_level', name: 'Experience Level', type: 'select', category: 'profile', required: false, options: ['Beginner', 'Intermediate', 'Advanced'] },
    ],
    transactionTypes: ['booking_created', 'session_completed', 'payment_received', 'check_in_submitted', 'goal_achieved'],
  },
  consulting: {
    type: 'consulting',
    clientLabel: 'Client',
    sessionLabel: 'Consultation',
    providerLabel: 'Consultant',
    defaultFields: [
      { id: 'company', name: 'Company', type: 'text', category: 'profile', required: false },
      { id: 'role', name: 'Role/Title', type: 'text', category: 'profile', required: false },
      { id: 'company_size', name: 'Company Size', type: 'select', category: 'profile', required: false, options: ['1-10', '11-50', '51-200', '201-500', '500+'] },
      { id: 'budget', name: 'Budget Range', type: 'select', category: 'engagement', required: false, options: ['<$5k', '$5k-$20k', '$20k-$50k', '$50k+'] },
    ],
    transactionTypes: ['booking_created', 'session_completed', 'payment_received', 'invoice_sent', 'program_completed'],
  },
  healthcare: {
    type: 'healthcare',
    clientLabel: 'Patient',
    sessionLabel: 'Appointment',
    providerLabel: 'Provider',
    defaultFields: [
      { id: 'date_of_birth', name: 'Date of Birth', type: 'date', category: 'profile', required: true },
      { id: 'insurance', name: 'Insurance Provider', type: 'text', category: 'profile', required: false },
      { id: 'emergency_contact', name: 'Emergency Contact', type: 'text', category: 'profile', required: false },
    ],
    transactionTypes: ['booking_created', 'session_completed', 'payment_received', 'note_added'],
  },
  therapy: {
    type: 'therapy',
    clientLabel: 'Client',
    sessionLabel: 'Session',
    providerLabel: 'Therapist',
    defaultFields: [
      { id: 'presenting_concerns', name: 'Presenting Concerns', type: 'textarea', category: 'engagement', required: false },
      { id: 'therapy_type', name: 'Therapy Type', type: 'select', category: 'engagement', required: false, options: ['Individual', 'Couples', 'Family', 'Group'] },
    ],
    transactionTypes: ['booking_created', 'session_completed', 'payment_received', 'note_added'],
  },
  education: {
    type: 'education',
    clientLabel: 'Student',
    sessionLabel: 'Lesson',
    providerLabel: 'Instructor',
    defaultFields: [
      { id: 'subject', name: 'Subject', type: 'text', category: 'engagement', required: false },
      { id: 'grade_level', name: 'Grade/Level', type: 'text', category: 'profile', required: false },
      { id: 'learning_goals', name: 'Learning Goals', type: 'textarea', category: 'engagement', required: false },
    ],
    transactionTypes: ['booking_created', 'session_completed', 'payment_received', 'goal_achieved'],
  },
  creative: {
    type: 'creative',
    clientLabel: 'Client',
    sessionLabel: 'Session',
    providerLabel: 'Creative',
    defaultFields: [
      { id: 'project_type', name: 'Project Type', type: 'text', category: 'engagement', required: false },
      { id: 'brand_guidelines', name: 'Has Brand Guidelines', type: 'boolean', category: 'engagement', required: false },
    ],
    transactionTypes: ['booking_created', 'session_completed', 'payment_received', 'file_uploaded', 'program_completed'],
  },
  general: {
    type: 'general',
    clientLabel: 'Client',
    sessionLabel: 'Appointment',
    providerLabel: 'Provider',
    defaultFields: [],
    transactionTypes: ['booking_created', 'session_completed', 'payment_received', 'note_added'],
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getVerticalConfig(vertical: VerticalType): VerticalConfig {
  return VERTICAL_CONFIGS[vertical] || VERTICAL_CONFIGS.general;
}

export function createTransaction(
  type: TransactionType,
  clientId: string,
  organizationId: string,
  data: Partial<Transaction>
): Transaction {
  const categoryMap: Record<TransactionType, TransactionCategory> = {
    booking_created: 'scheduling',
    booking_confirmed: 'scheduling',
    booking_cancelled: 'scheduling',
    booking_rescheduled: 'scheduling',
    booking_no_show: 'scheduling',
    session_started: 'session',
    session_completed: 'session',
    session_notes_added: 'session',
    session_rated: 'session',
    payment_received: 'financial',
    payment_failed: 'financial',
    refund_issued: 'financial',
    invoice_sent: 'financial',
    invoice_paid: 'financial',
    package_purchased: 'financial',
    subscription_started: 'financial',
    subscription_cancelled: 'financial',
    email_sent: 'communication',
    email_opened: 'communication',
    sms_sent: 'communication',
    call_logged: 'communication',
    message_sent: 'communication',
    goal_set: 'milestone',
    goal_achieved: 'milestone',
    program_started: 'milestone',
    program_completed: 'milestone',
    check_in_submitted: 'milestone',
    client_created: 'administrative',
    client_updated: 'administrative',
    status_changed: 'administrative',
    stage_changed: 'administrative',
    tag_added: 'administrative',
    tag_removed: 'administrative',
    note_added: 'administrative',
    file_uploaded: 'administrative',
  };

  return {
    id: data.id || `txn_${Date.now()}`,
    clientId,
    organizationId,
    type,
    category: categoryMap[type],
    occurredAt: data.occurredAt || new Date().toISOString(),
    createdAt: new Date().toISOString(),
    title: data.title || formatTransactionTitle(type),
    description: data.description,
    metadata: data.metadata || {},
    amount: data.amount,
    currency: data.currency,
    sessionId: data.sessionId,
    packageId: data.packageId,
    invoiceId: data.invoiceId,
    createdBy: data.createdBy || 'system',
    automated: data.automated ?? true,
  };
}

function formatTransactionTitle(type: TransactionType): string {
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
