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
// VERTICAL PRESETS
// ============================================================================
export const VERTICAL_CONFIGS = {
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
export function getVerticalConfig(vertical) {
    return VERTICAL_CONFIGS[vertical] || VERTICAL_CONFIGS.general;
}
export function createTransaction(type, clientId, organizationId, data) {
    const categoryMap = {
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
function formatTransactionTitle(type) {
    return type
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}
//# sourceMappingURL=crm.js.map