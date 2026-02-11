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
export type VerticalType = 'coaching' | 'fitness' | 'consulting' | 'healthcare' | 'therapy' | 'education' | 'creative' | 'general';
export interface VerticalConfig {
    type: VerticalType;
    clientLabel: string;
    sessionLabel: string;
    providerLabel: string;
    defaultFields: ClientFieldDefinition[];
    transactionTypes: TransactionType[];
}
export interface Client {
    id: string;
    organizationId: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    avatarUrl?: string;
    status: ClientStatus;
    stage: ClientStage;
    createdAt: string;
    updatedAt: string;
    lastInteractionAt?: string;
    nextScheduledAt?: string;
    source?: ClientSource;
    referredBy?: string;
    metadata: Record<string, unknown>;
    customFields: Record<string, unknown>;
    stats: ClientStats;
    tags: string[];
    quickNote?: string;
}
export type ClientStatus = 'lead' | 'active' | 'paused' | 'completed' | 'churned';
export type ClientStage = 'inquiry' | 'discovery' | 'proposal' | 'onboarding' | 'engaged' | 'graduating' | 'alumni';
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
    engagementScore: number;
}
export interface ClientFieldDefinition {
    id: string;
    name: string;
    type: FieldType;
    category: 'contact' | 'profile' | 'engagement' | 'custom';
    required: boolean;
    options?: string[];
    defaultValue?: unknown;
    verticals?: VerticalType[];
    description?: string;
}
export type FieldType = 'text' | 'textarea' | 'number' | 'currency' | 'date' | 'datetime' | 'select' | 'multiselect' | 'boolean' | 'email' | 'phone' | 'url' | 'rating';
/**
 * Transaction represents ANY interaction with a client.
 * This is the foundation for analytics and relationship history.
 */
export interface Transaction {
    id: string;
    clientId: string;
    organizationId: string;
    type: TransactionType;
    category: TransactionCategory;
    occurredAt: string;
    createdAt: string;
    title: string;
    description?: string;
    metadata: Record<string, unknown>;
    amount?: number;
    currency?: string;
    sessionId?: string;
    packageId?: string;
    invoiceId?: string;
    createdBy: string;
    automated: boolean;
}
export type TransactionCategory = 'scheduling' | 'financial' | 'communication' | 'session' | 'milestone' | 'administrative';
export type TransactionType = 'booking_created' | 'booking_confirmed' | 'booking_cancelled' | 'booking_rescheduled' | 'booking_no_show' | 'session_started' | 'session_completed' | 'session_notes_added' | 'session_rated' | 'payment_received' | 'payment_failed' | 'refund_issued' | 'invoice_sent' | 'invoice_paid' | 'package_purchased' | 'subscription_started' | 'subscription_cancelled' | 'email_sent' | 'email_opened' | 'sms_sent' | 'call_logged' | 'message_sent' | 'goal_set' | 'goal_achieved' | 'program_started' | 'program_completed' | 'check_in_submitted' | 'client_created' | 'client_updated' | 'status_changed' | 'stage_changed' | 'tag_added' | 'tag_removed' | 'note_added' | 'file_uploaded';
export interface Session {
    id: string;
    clientId: string;
    organizationId: string;
    scheduledAt: string;
    duration: number;
    timezone: string;
    status: SessionStatus;
    type: string;
    location: SessionLocation;
    title: string;
    description?: string;
    agenda?: string;
    notes?: string;
    rating?: number;
    feedback?: string;
    actionItems?: ActionItem[];
    price?: number;
    paid: boolean;
    invoiceId?: string;
    externalId?: string;
    meetingUrl?: string;
    createdAt: string;
    updatedAt: string;
    completedAt?: string;
    cancelledAt?: string;
}
export type SessionStatus = 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show' | 'rescheduled';
export interface SessionLocation {
    type: 'video' | 'phone' | 'in_person' | 'other';
    details?: string;
    provider?: 'zoom' | 'google_meet' | 'teams' | 'other';
}
export interface ActionItem {
    id: string;
    text: string;
    completed: boolean;
    dueDate?: string;
    completedAt?: string;
}
export interface Package {
    id: string;
    organizationId: string;
    name: string;
    description?: string;
    price: number;
    currency: string;
    billingType: 'one_time' | 'recurring';
    billingInterval?: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
    sessionCount?: number;
    validityDays?: number;
    features: string[];
    active: boolean;
    createdAt: string;
    updatedAt: string;
}
export interface ClientPackage {
    id: string;
    clientId: string;
    packageId: string;
    organizationId: string;
    sessionsUsed: number;
    sessionsRemaining: number;
    purchasedAt: string;
    expiresAt?: string;
    amountPaid: number;
    paymentStatus: 'pending' | 'paid' | 'partial' | 'refunded';
    status: 'active' | 'expired' | 'exhausted' | 'cancelled';
}
export interface Payment {
    id: string;
    clientId: string;
    organizationId: string;
    amount: number;
    currency: string;
    status: PaymentStatus;
    method: 'card' | 'bank_transfer' | 'cash' | 'other';
    provider?: 'stripe' | 'square' | 'paypal' | 'manual';
    externalId?: string;
    description: string;
    invoiceId?: string;
    packageId?: string;
    sessionId?: string;
    createdAt: string;
    paidAt?: string;
    refundedAt?: string;
    metadata: Record<string, unknown>;
}
export type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded' | 'partially_refunded';
export interface Invoice {
    id: string;
    clientId: string;
    organizationId: string;
    number: string;
    status: InvoiceStatus;
    subtotal: number;
    tax: number;
    total: number;
    amountPaid: number;
    amountDue: number;
    currency: string;
    items: InvoiceItem[];
    issuedAt: string;
    dueAt: string;
    paidAt?: string;
    notes?: string;
    terms?: string;
}
export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'cancelled';
export interface InvoiceItem {
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
    sessionId?: string;
    packageId?: string;
}
export interface ClientTimeline {
    clientId: string;
    transactions: Transaction[];
    sessions: Session[];
    payments: Payment[];
}
export interface EngagementMetrics {
    clientId: string;
    period: 'week' | 'month' | 'quarter' | 'year' | 'all_time';
    sessionsCount: number;
    messagesCount: number;
    totalInteractions: number;
    totalRevenue: number;
    averageSessionValue: number;
    attendanceRate: number;
    responseTime: number;
    averageRating: number;
    npsScore?: number;
}
export declare const VERTICAL_CONFIGS: Record<VerticalType, VerticalConfig>;
export declare function getVerticalConfig(vertical: VerticalType): VerticalConfig;
export declare function createTransaction(type: TransactionType, clientId: string, organizationId: string, data: Partial<Transaction>): Transaction;
//# sourceMappingURL=crm.d.ts.map