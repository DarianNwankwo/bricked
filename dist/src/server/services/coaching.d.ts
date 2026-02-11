/**
 * Coaching Service Layer
 *
 * Business logic for coaching vertical operations.
 * Handles clients, sessions, transactions, and notes.
 */
import type { CoachingClient, CoachingSession, CoachingTransaction, CoachingNote } from '../db/schema.js';
export interface CreateClientInput {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    timezone?: string;
    status?: CoachingClient['status'];
    metadata?: Record<string, unknown>;
}
export interface UpdateClientInput {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    timezone?: string;
    status?: CoachingClient['status'];
    metadata?: Record<string, unknown>;
}
export interface CreateSessionInput {
    clientId: string;
    title: string;
    description?: string;
    scheduledAt: Date;
    duration: number;
    sessionType: CoachingSession['sessionType'];
    meetingUrl?: string;
}
export interface UpdateSessionInput {
    title?: string;
    description?: string;
    scheduledAt?: Date;
    duration?: number;
    status?: CoachingSession['status'];
    sessionType?: CoachingSession['sessionType'];
    meetingUrl?: string;
    notes?: string;
}
export interface CreateTransactionInput {
    clientId: string;
    type: CoachingTransaction['type'];
    amount: number;
    currency?: string;
    description: string;
    packageDetails?: CoachingTransaction['packageDetails'];
}
export interface CreateNoteInput {
    clientId: string;
    sessionId?: string;
    title: string;
    content: string;
    tags?: string[];
    isPrivate?: boolean;
}
export interface UpdateNoteInput {
    title?: string;
    content?: string;
    tags?: string[];
    isPrivate?: boolean;
    sessionId?: string;
}
declare class ClientService {
    create(userId: string, input: CreateClientInput): Promise<CoachingClient>;
    getById(id: string): Promise<CoachingClient | null>;
    getByUserId(userId: string, status?: CoachingClient['status']): Promise<CoachingClient[]>;
    update(id: string, input: UpdateClientInput): Promise<CoachingClient | null>;
    delete(id: string): Promise<boolean>;
    findByEmail(userId: string, email: string): Promise<CoachingClient | null>;
    /**
     * Get client statistics for a coach
     */
    getStats(userId: string): Promise<{
        total: number;
        active: number;
        inactive: number;
        leads: number;
        past: number;
    }>;
}
declare class SessionService {
    create(userId: string, input: CreateSessionInput): Promise<CoachingSession>;
    getById(id: string): Promise<CoachingSession | null>;
    getByUserId(userId: string, startDate?: Date, endDate?: Date): Promise<CoachingSession[]>;
    getByClientId(clientId: string): Promise<CoachingSession[]>;
    update(id: string, input: UpdateSessionInput): Promise<CoachingSession | null>;
    delete(id: string): Promise<boolean>;
    markCompleted(id: string, notes?: string): Promise<CoachingSession | null>;
    markCancelled(id: string): Promise<CoachingSession | null>;
    markNoShow(id: string): Promise<CoachingSession | null>;
    /**
     * Get upcoming sessions for a coach
     */
    getUpcoming(userId: string, limit?: number): Promise<CoachingSession[]>;
    /**
     * Get session statistics for a coach
     */
    getStats(userId: string, startDate?: Date, endDate?: Date): Promise<{
        total: number;
        completed: number;
        cancelled: number;
        noShow: number;
        scheduled: number;
        totalMinutes: number;
    }>;
}
declare class TransactionService {
    create(userId: string, input: CreateTransactionInput): Promise<CoachingTransaction>;
    getById(id: string): Promise<CoachingTransaction | null>;
    getByUserId(userId: string, startDate?: Date, endDate?: Date): Promise<CoachingTransaction[]>;
    getByClientId(clientId: string): Promise<CoachingTransaction[]>;
    markCompleted(id: string, stripePaymentId?: string): Promise<CoachingTransaction | null>;
    markFailed(id: string): Promise<CoachingTransaction | null>;
    markRefunded(id: string): Promise<CoachingTransaction | null>;
    /**
     * Get revenue statistics for a coach
     */
    getRevenueStats(userId: string, startDate?: Date, endDate?: Date): Promise<{
        totalRevenue: number;
        completedPayments: number;
        pendingPayments: number;
        refundedAmount: number;
        currency: string;
    }>;
}
declare class NoteService {
    create(userId: string, input: CreateNoteInput): Promise<CoachingNote>;
    getById(id: string): Promise<CoachingNote | null>;
    getByUserId(userId: string): Promise<CoachingNote[]>;
    getByClientId(clientId: string): Promise<CoachingNote[]>;
    getBySessionId(sessionId: string): Promise<CoachingNote[]>;
    update(id: string, input: UpdateNoteInput): Promise<CoachingNote | null>;
    delete(id: string): Promise<boolean>;
    /**
     * Add a session note (convenience method)
     */
    addSessionNote(userId: string, sessionId: string, title: string, content: string): Promise<CoachingNote>;
}
export declare const clientService: ClientService;
export declare const sessionService: SessionService;
export declare const transactionService: TransactionService;
export declare const noteService: NoteService;
export declare const coachingServices: {
    clients: ClientService;
    sessions: SessionService;
    transactions: TransactionService;
    notes: NoteService;
};
export {};
//# sourceMappingURL=coaching.d.ts.map