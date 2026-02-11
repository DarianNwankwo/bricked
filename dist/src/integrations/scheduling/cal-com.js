/**
 * Cal.com Integration
 *
 * Open-source scheduling integration for Cal.com.
 * https://cal.com/docs/api-reference
 *
 * Cal.com is ideal for:
 * - Self-hosted scheduling (for privacy-conscious coaches)
 * - Custom branding requirements
 * - Integration with existing Cal.com workflows
 */
// =============================================================================
// Port Contracts (Schemas)
// =============================================================================
/**
 * Booking request input - data needed to create a booking via Cal.com.
 */
const bookingRequestSchema = {
    type: 'object',
    description: 'Request to create a booking via Cal.com',
    properties: {
        eventTypeId: {
            type: 'number',
            description: 'Cal.com event type ID',
        },
        name: {
            type: 'string',
            description: 'Attendee name',
        },
        email: {
            type: 'string',
            format: 'email',
            description: 'Attendee email',
        },
        start: {
            type: 'string',
            format: 'date-time',
            description: 'Booking start time (ISO 8601)',
        },
        end: {
            type: 'string',
            format: 'date-time',
            description: 'Booking end time (ISO 8601)',
        },
        timeZone: {
            type: 'string',
            description: 'Attendee timezone (e.g., America/New_York)',
        },
        language: {
            type: 'string',
            description: 'Language for notifications (e.g., en)',
        },
        metadata: {
            type: 'object',
            description: 'Custom metadata to attach to the booking',
        },
        responses: {
            type: 'object',
            description: 'Answers to booking questions',
        },
    },
    required: ['eventTypeId', 'name', 'email', 'start'],
};
/**
 * Booking created output - webhook payload when booking is created.
 */
const bookingCreatedSchema = {
    type: 'object',
    description: 'Webhook payload when a Cal.com booking is created',
    properties: {
        triggerEvent: {
            type: 'string',
            enum: ['BOOKING_CREATED'],
            description: 'Webhook event type',
        },
        bookingId: {
            type: 'number',
            description: 'Unique booking ID',
        },
        uid: {
            type: 'string',
            description: 'Unique booking UID',
        },
        eventTypeId: {
            type: 'number',
            description: 'Event type ID',
        },
        title: {
            type: 'string',
            description: 'Booking title',
        },
        startTime: {
            type: 'string',
            format: 'date-time',
            description: 'Scheduled start time',
        },
        endTime: {
            type: 'string',
            format: 'date-time',
            description: 'Scheduled end time',
        },
        attendees: {
            type: 'array',
            description: 'List of attendees with name, email, timezone',
        },
        organizer: {
            type: 'object',
            description: 'Organizer details',
        },
        location: {
            type: 'string',
            description: 'Meeting location or video link',
        },
        status: {
            type: 'string',
            enum: ['ACCEPTED', 'PENDING', 'CANCELLED'],
            description: 'Booking status',
        },
        metadata: {
            type: 'object',
            description: 'Custom metadata',
        },
    },
    required: ['bookingId', 'uid', 'startTime', 'attendees'],
};
/**
 * Booking cancelled output - webhook payload when booking is cancelled.
 */
const bookingCancelledSchema = {
    type: 'object',
    description: 'Webhook payload when a Cal.com booking is cancelled',
    properties: {
        triggerEvent: {
            type: 'string',
            enum: ['BOOKING_CANCELLED'],
            description: 'Webhook event type',
        },
        bookingId: {
            type: 'number',
            description: 'Cancelled booking ID',
        },
        uid: {
            type: 'string',
            description: 'Booking UID',
        },
        cancellationReason: {
            type: 'string',
            description: 'Reason for cancellation',
        },
        cancelledBy: {
            type: 'string',
            description: 'Who cancelled (organizer email or attendee email)',
        },
        attendees: {
            type: 'array',
            description: 'Attendee details',
        },
    },
    required: ['bookingId', 'uid'],
};
/**
 * Booking rescheduled output - webhook payload when booking is rescheduled.
 */
const bookingRescheduledSchema = {
    type: 'object',
    description: 'Webhook payload when a Cal.com booking is rescheduled',
    properties: {
        triggerEvent: {
            type: 'string',
            enum: ['BOOKING_RESCHEDULED'],
            description: 'Webhook event type',
        },
        bookingId: {
            type: 'number',
            description: 'Booking ID',
        },
        uid: {
            type: 'string',
            description: 'Booking UID',
        },
        rescheduleUid: {
            type: 'string',
            description: 'New UID after reschedule',
        },
        previousStartTime: {
            type: 'string',
            format: 'date-time',
            description: 'Original start time',
        },
        startTime: {
            type: 'string',
            format: 'date-time',
            description: 'New start time',
        },
        endTime: {
            type: 'string',
            format: 'date-time',
            description: 'New end time',
        },
        attendees: {
            type: 'array',
            description: 'Attendee details',
        },
    },
    required: ['bookingId', 'startTime'],
};
/**
 * Availability request input - check available slots.
 */
const availabilityRequestSchema = {
    type: 'object',
    description: 'Request to check availability for an event type',
    properties: {
        eventTypeId: {
            type: 'number',
            description: 'Cal.com event type ID',
        },
        username: {
            type: 'string',
            description: 'Cal.com username (alternative to eventTypeId)',
        },
        dateFrom: {
            type: 'string',
            format: 'date-time',
            description: 'Start of date range',
        },
        dateTo: {
            type: 'string',
            format: 'date-time',
            description: 'End of date range',
        },
        timeZone: {
            type: 'string',
            description: 'Timezone for availability',
        },
    },
    required: ['dateFrom', 'dateTo'],
};
/**
 * Availability response output.
 */
const availabilityResponseSchema = {
    type: 'object',
    description: 'Available time slots response',
    properties: {
        slots: {
            type: 'object',
            description: 'Map of dates to available time slots',
        },
        timeZone: {
            type: 'string',
            description: 'Timezone of the slots',
        },
    },
    required: ['slots'],
};
/**
 * Meeting ended output - webhook when meeting concludes.
 */
const meetingEndedSchema = {
    type: 'object',
    description: 'Webhook payload when a Cal.com meeting ends',
    properties: {
        triggerEvent: {
            type: 'string',
            enum: ['MEETING_ENDED'],
            description: 'Webhook event type',
        },
        bookingId: {
            type: 'number',
            description: 'Booking ID',
        },
        uid: {
            type: 'string',
            description: 'Booking UID',
        },
        endedAt: {
            type: 'string',
            format: 'date-time',
            description: 'When the meeting ended',
        },
        duration: {
            type: 'number',
            description: 'Actual meeting duration in minutes',
        },
        recordingUrl: {
            type: 'string',
            format: 'uri',
            description: 'Recording URL if available',
        },
    },
    required: ['bookingId'],
};
// =============================================================================
// Port Definitions
// =============================================================================
const inputs = [
    {
        id: 'booking_request',
        name: 'Create Booking',
        direction: 'input',
        contract: bookingRequestSchema,
        required: false,
        description: 'Create a new booking via Cal.com API',
    },
    {
        id: 'availability_request',
        name: 'Check Availability',
        direction: 'input',
        contract: availabilityRequestSchema,
        required: false,
        description: 'Query available time slots',
    },
];
const outputs = [
    {
        id: 'booking_created',
        name: 'Booking Created',
        direction: 'output',
        contract: bookingCreatedSchema,
        description: 'Fires when a new booking is created',
    },
    {
        id: 'booking_cancelled',
        name: 'Booking Cancelled',
        direction: 'output',
        contract: bookingCancelledSchema,
        description: 'Fires when a booking is cancelled',
    },
    {
        id: 'booking_rescheduled',
        name: 'Booking Rescheduled',
        direction: 'output',
        contract: bookingRescheduledSchema,
        description: 'Fires when a booking is rescheduled',
    },
    {
        id: 'availability_response',
        name: 'Available Slots',
        direction: 'output',
        contract: availabilityResponseSchema,
        description: 'Returns available time slots',
    },
    {
        id: 'meeting_ended',
        name: 'Meeting Ended',
        direction: 'output',
        contract: meetingEndedSchema,
        description: 'Fires when a meeting ends (with optional recording)',
    },
];
// =============================================================================
// Integration Definition
// =============================================================================
export const calComIntegration = {
    type: 'cal_com',
    name: 'Cal.com',
    description: 'Open-source scheduling with Cal.com - self-hostable and customizable',
    category: 'scheduling',
    ports: { inputs, outputs },
    requiredConfig: ['apiKeyEnvVar'],
    docsUrl: 'https://cal.com/docs/api-reference',
    icon: 'cal-com',
};
//# sourceMappingURL=cal-com.js.map