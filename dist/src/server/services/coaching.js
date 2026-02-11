/**
 * Coaching Service Layer
 *
 * Business logic for coaching vertical operations.
 * Handles clients, sessions, transactions, and notes.
 */
import { db } from '../db/client.js';
// =============================================================================
// Client Service
// =============================================================================
class ClientService {
    async create(userId, input) {
        // Check for duplicate email
        const existing = await db.findCoachingClientByEmail(userId, input.email);
        if (existing) {
            throw new Error('A client with this email already exists');
        }
        return db.createCoachingClient(userId, {
            firstName: input.firstName,
            lastName: input.lastName,
            email: input.email,
            phone: input.phone,
            timezone: input.timezone,
            status: input.status || 'active',
            metadata: input.metadata || {},
        });
    }
    async getById(id) {
        return db.getCoachingClientById(id);
    }
    async getByUserId(userId, status) {
        return db.getCoachingClientsByUserId(userId, status);
    }
    async update(id, input) {
        const client = await db.getCoachingClientById(id);
        if (!client)
            return null;
        // If email is changing, check for duplicates
        if (input.email && input.email !== client.email) {
            const existing = await db.findCoachingClientByEmail(client.userId, input.email);
            if (existing && existing.id !== id) {
                throw new Error('A client with this email already exists');
            }
        }
        return db.updateCoachingClient(id, input);
    }
    async delete(id) {
        return db.deleteCoachingClient(id);
    }
    async findByEmail(userId, email) {
        return db.findCoachingClientByEmail(userId, email);
    }
    /**
     * Get client statistics for a coach
     */
    async getStats(userId) {
        const clients = await db.getCoachingClientsByUserId(userId);
        return {
            total: clients.length,
            active: clients.filter(c => c.status === 'active').length,
            inactive: clients.filter(c => c.status === 'inactive').length,
            leads: clients.filter(c => c.status === 'lead').length,
            past: clients.filter(c => c.status === 'past').length,
        };
    }
}
// =============================================================================
// Session Service
// =============================================================================
class SessionService {
    async create(userId, input) {
        // Verify client exists and belongs to user
        const client = await db.getCoachingClientById(input.clientId);
        if (!client || client.userId !== userId) {
            throw new Error('Client not found');
        }
        return db.createCoachingSession(userId, {
            clientId: input.clientId,
            title: input.title,
            description: input.description,
            scheduledAt: input.scheduledAt,
            duration: input.duration,
            status: 'scheduled',
            sessionType: input.sessionType,
            meetingUrl: input.meetingUrl,
        });
    }
    async getById(id) {
        return db.getCoachingSessionById(id);
    }
    async getByUserId(userId, startDate, endDate) {
        return db.getCoachingSessionsByUserId(userId, startDate, endDate);
    }
    async getByClientId(clientId) {
        return db.getCoachingSessionsByClientId(clientId);
    }
    async update(id, input) {
        return db.updateCoachingSession(id, input);
    }
    async delete(id) {
        return db.deleteCoachingSession(id);
    }
    async markCompleted(id, notes) {
        return db.updateCoachingSession(id, {
            status: 'completed',
            notes,
        });
    }
    async markCancelled(id) {
        return db.updateCoachingSession(id, { status: 'cancelled' });
    }
    async markNoShow(id) {
        return db.updateCoachingSession(id, { status: 'no_show' });
    }
    /**
     * Get upcoming sessions for a coach
     */
    async getUpcoming(userId, limit = 10) {
        const now = new Date();
        const sessions = await db.getCoachingSessionsByUserId(userId, now);
        return sessions
            .filter(s => s.status === 'scheduled')
            .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())
            .slice(0, limit);
    }
    /**
     * Get session statistics for a coach
     */
    async getStats(userId, startDate, endDate) {
        const sessions = await db.getCoachingSessionsByUserId(userId, startDate, endDate);
        return {
            total: sessions.length,
            completed: sessions.filter(s => s.status === 'completed').length,
            cancelled: sessions.filter(s => s.status === 'cancelled').length,
            noShow: sessions.filter(s => s.status === 'no_show').length,
            scheduled: sessions.filter(s => s.status === 'scheduled').length,
            totalMinutes: sessions
                .filter(s => s.status === 'completed')
                .reduce((sum, s) => sum + s.duration, 0),
        };
    }
}
// =============================================================================
// Transaction Service
// =============================================================================
class TransactionService {
    async create(userId, input) {
        // Verify client exists and belongs to user
        const client = await db.getCoachingClientById(input.clientId);
        if (!client || client.userId !== userId) {
            throw new Error('Client not found');
        }
        return db.createCoachingTransaction(userId, {
            clientId: input.clientId,
            type: input.type,
            amount: input.amount,
            currency: input.currency || 'USD',
            description: input.description,
            status: 'pending',
            packageDetails: input.packageDetails,
        });
    }
    async getById(id) {
        return db.getCoachingTransactionById(id);
    }
    async getByUserId(userId, startDate, endDate) {
        return db.getCoachingTransactionsByUserId(userId, startDate, endDate);
    }
    async getByClientId(clientId) {
        return db.getCoachingTransactionsByClientId(clientId);
    }
    async markCompleted(id, stripePaymentId) {
        return db.updateCoachingTransaction(id, {
            status: 'completed',
            stripePaymentId,
        });
    }
    async markFailed(id) {
        return db.updateCoachingTransaction(id, { status: 'failed' });
    }
    async markRefunded(id) {
        return db.updateCoachingTransaction(id, { status: 'refunded' });
    }
    /**
     * Get revenue statistics for a coach
     */
    async getRevenueStats(userId, startDate, endDate) {
        const transactions = await db.getCoachingTransactionsByUserId(userId, startDate, endDate);
        const payments = transactions.filter(t => t.type === 'payment');
        return {
            totalRevenue: payments
                .filter(t => t.status === 'completed')
                .reduce((sum, t) => sum + t.amount, 0),
            completedPayments: payments.filter(t => t.status === 'completed').length,
            pendingPayments: payments.filter(t => t.status === 'pending').length,
            refundedAmount: transactions
                .filter(t => t.type === 'refund' && t.status === 'completed')
                .reduce((sum, t) => sum + t.amount, 0),
            currency: 'USD', // Default currency
        };
    }
}
// =============================================================================
// Note Service
// =============================================================================
class NoteService {
    async create(userId, input) {
        // Verify client exists and belongs to user
        const client = await db.getCoachingClientById(input.clientId);
        if (!client || client.userId !== userId) {
            throw new Error('Client not found');
        }
        // If session is specified, verify it exists
        if (input.sessionId) {
            const session = await db.getCoachingSessionById(input.sessionId);
            if (!session || session.userId !== userId) {
                throw new Error('Session not found');
            }
        }
        return db.createCoachingNote(userId, {
            clientId: input.clientId,
            sessionId: input.sessionId,
            title: input.title,
            content: input.content,
            tags: input.tags || [],
            isPrivate: input.isPrivate || false,
        });
    }
    async getById(id) {
        return db.getCoachingNoteById(id);
    }
    async getByUserId(userId) {
        return db.getCoachingNotesByUserId(userId);
    }
    async getByClientId(clientId) {
        return db.getCoachingNotesByClientId(clientId);
    }
    async getBySessionId(sessionId) {
        return db.getCoachingNotesBySessionId(sessionId);
    }
    async update(id, input) {
        return db.updateCoachingNote(id, input);
    }
    async delete(id) {
        return db.deleteCoachingNote(id);
    }
    /**
     * Add a session note (convenience method)
     */
    async addSessionNote(userId, sessionId, title, content) {
        const session = await db.getCoachingSessionById(sessionId);
        if (!session || session.userId !== userId) {
            throw new Error('Session not found');
        }
        return this.create(userId, {
            clientId: session.clientId,
            sessionId,
            title,
            content,
            tags: ['session-note'],
            isPrivate: false,
        });
    }
}
// =============================================================================
// Exports
// =============================================================================
export const clientService = new ClientService();
export const sessionService = new SessionService();
export const transactionService = new TransactionService();
export const noteService = new NoteService();
// Default export for convenience
export const coachingServices = {
    clients: clientService,
    sessions: sessionService,
    transactions: transactionService,
    notes: noteService,
};
//# sourceMappingURL=coaching.js.map