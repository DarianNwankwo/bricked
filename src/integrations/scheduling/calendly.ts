/**
 * Calendly Integration
 *
 * Scheduling integration for Calendly.
 * https://developer.calendly.com/api-docs
 *
 * Calendly is ideal for:
 * - 1:1 coaching sessions
 * - Group classes with limited spots
 * - Discovery calls and consultations
 */

import type { IntegrationDefinition, Port, PortSchema } from '../../types/graph.js';

// =============================================================================
// Port Contracts (Schemas)
// =============================================================================

/**
 * Booking request input - data needed to create/modify a booking.
 * This is typically triggered by user action or automation.
 */
const bookingRequestSchema: PortSchema = {
  type: 'object',
  description: 'Request to check availability or create a booking',
  properties: {
    eventTypeId: {
      type: 'string',
      description: 'Calendly event type UUID',
    },
    inviteeEmail: {
      type: 'string',
      format: 'email',
      description: 'Email of the person booking',
    },
    inviteeName: {
      type: 'string',
      description: 'Name of the person booking',
    },
    startTime: {
      type: 'string',
      format: 'date-time',
      description: 'Requested start time (ISO 8601)',
    },
    timezone: {
      type: 'string',
      description: 'Invitee timezone (e.g., America/New_York)',
    },
    customAnswers: {
      type: 'object',
      description: 'Answers to custom questions on the booking form',
    },
  },
  required: ['eventTypeId', 'inviteeEmail'],
};

/**
 * Booking confirmed output - webhook payload when booking is created.
 */
const bookingConfirmedSchema: PortSchema = {
  type: 'object',
  description: 'Webhook payload when a booking is confirmed',
  properties: {
    eventId: {
      type: 'string',
      description: 'Unique identifier for this booking',
    },
    eventTypeId: {
      type: 'string',
      description: 'Calendly event type UUID',
    },
    eventTypeName: {
      type: 'string',
      description: 'Name of the event type (e.g., "30 Minute Coaching Call")',
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
    invitee: {
      type: 'object',
      description: 'Invitee details',
    },
    location: {
      type: 'object',
      description: 'Meeting location (Zoom link, phone, etc.)',
    },
    cancellationUrl: {
      type: 'string',
      format: 'uri',
      description: 'URL for invitee to cancel',
    },
    rescheduleUrl: {
      type: 'string',
      format: 'uri',
      description: 'URL for invitee to reschedule',
    },
  },
  required: ['eventId', 'startTime', 'invitee'],
};

/**
 * Booking cancelled output - webhook payload when booking is cancelled.
 */
const bookingCancelledSchema: PortSchema = {
  type: 'object',
  description: 'Webhook payload when a booking is cancelled',
  properties: {
    eventId: {
      type: 'string',
      description: 'Unique identifier for the cancelled booking',
    },
    cancelledAt: {
      type: 'string',
      format: 'date-time',
      description: 'When the cancellation occurred',
    },
    cancelledBy: {
      type: 'string',
      enum: ['host', 'invitee'],
      description: 'Who cancelled the booking',
    },
    reason: {
      type: 'string',
      description: 'Cancellation reason if provided',
    },
    invitee: {
      type: 'object',
      description: 'Invitee details',
    },
  },
  required: ['eventId', 'cancelledAt'],
};

/**
 * Booking rescheduled output - webhook payload when booking is rescheduled.
 */
const bookingRescheduledSchema: PortSchema = {
  type: 'object',
  description: 'Webhook payload when a booking is rescheduled',
  properties: {
    eventId: {
      type: 'string',
      description: 'Unique identifier for the booking',
    },
    oldStartTime: {
      type: 'string',
      format: 'date-time',
      description: 'Previous start time',
    },
    newStartTime: {
      type: 'string',
      format: 'date-time',
      description: 'New start time',
    },
    rescheduledBy: {
      type: 'string',
      enum: ['host', 'invitee'],
      description: 'Who rescheduled the booking',
    },
    invitee: {
      type: 'object',
      description: 'Invitee details',
    },
  },
  required: ['eventId', 'newStartTime'],
};

/**
 * Availability check input - query available time slots.
 */
const availabilityCheckSchema: PortSchema = {
  type: 'object',
  description: 'Request to check available time slots',
  properties: {
    eventTypeId: {
      type: 'string',
      description: 'Calendly event type UUID',
    },
    startDate: {
      type: 'string',
      format: 'date-time',
      description: 'Start of date range to check',
    },
    endDate: {
      type: 'string',
      format: 'date-time',
      description: 'End of date range to check',
    },
    timezone: {
      type: 'string',
      description: 'Timezone for availability display',
    },
  },
  required: ['eventTypeId'],
};

/**
 * Available slots output - response with available time slots.
 */
const availableSlotsSchema: PortSchema = {
  type: 'object',
  description: 'Available time slots response',
  properties: {
    slots: {
      type: 'array',
      description: 'Array of available time slots',
    },
    eventTypeId: {
      type: 'string',
      description: 'Event type these slots are for',
    },
  },
  required: ['slots'],
};

// =============================================================================
// Port Definitions
// =============================================================================

const inputs: Port[] = [
  {
    id: 'booking_request',
    name: 'Booking Request',
    direction: 'input',
    contract: bookingRequestSchema,
    required: false,
    description: 'Trigger to create a new booking',
  },
  {
    id: 'availability_check',
    name: 'Check Availability',
    direction: 'input',
    contract: availabilityCheckSchema,
    required: false,
    description: 'Query available time slots',
  },
];

const outputs: Port[] = [
  {
    id: 'booking_confirmed',
    name: 'Booking Confirmed',
    direction: 'output',
    contract: bookingConfirmedSchema,
    description: 'Fires when a booking is successfully created',
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
    id: 'available_slots',
    name: 'Available Slots',
    direction: 'output',
    contract: availableSlotsSchema,
    description: 'Returns available time slots for an event type',
  },
];

// =============================================================================
// Integration Definition
// =============================================================================

export const calendlyIntegration: IntegrationDefinition = {
  type: 'calendly',
  name: 'Calendly',
  description: 'Schedule meetings and coaching sessions with Calendly',
  category: 'scheduling',
  ports: { inputs, outputs },
  requiredConfig: ['apiKeyEnvVar'],
  docsUrl: 'https://developer.calendly.com/api-docs',
  icon: 'calendly',
};
