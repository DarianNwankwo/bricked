/**
 * Twenty CRM Integration
 *
 * Open-source CRM integration for client management.
 * https://docs.twenty.com/developers/extend/capabilities/apis
 *
 * Twenty is ideal for:
 * - Client/contact management with flexible metadata
 * - Notes and activity tracking
 * - Relationship history for coaching verticals
 *
 * Focused areas: People and Notes
 */

import type { IntegrationDefinition, Port, PortSchema } from '../../types/graph.js';

// =============================================================================
// Port Contracts (Schemas) - PEOPLE
// =============================================================================

/**
 * Create person input - data needed to create a new person/client.
 */
const createPersonSchema: PortSchema = {
  type: 'object',
  description: 'Create a new person in the CRM',
  properties: {
    firstName: {
      type: 'string',
      description: 'First name',
    },
    lastName: {
      type: 'string',
      description: 'Last name',
    },
    email: {
      type: 'string',
      format: 'email',
      description: 'Primary email address',
    },
    phone: {
      type: 'string',
      description: 'Phone number',
    },
    city: {
      type: 'string',
      description: 'City',
    },
    companyId: {
      type: 'string',
      format: 'uuid',
      description: 'Associated company ID',
    },
    jobTitle: {
      type: 'string',
      description: 'Job title',
    },
    linkedinUrl: {
      type: 'string',
      format: 'uri',
      description: 'LinkedIn profile URL',
    },
    avatarUrl: {
      type: 'string',
      format: 'uri',
      description: 'Avatar/profile image URL',
    },
  },
  required: ['email'],
};

/**
 * Update person input - data to update an existing person.
 */
const updatePersonSchema: PortSchema = {
  type: 'object',
  description: 'Update an existing person in the CRM',
  properties: {
    id: {
      type: 'string',
      format: 'uuid',
      description: 'Person ID to update',
    },
    firstName: {
      type: 'string',
      description: 'First name',
    },
    lastName: {
      type: 'string',
      description: 'Last name',
    },
    email: {
      type: 'string',
      format: 'email',
      description: 'Primary email address',
    },
    phone: {
      type: 'string',
      description: 'Phone number',
    },
    city: {
      type: 'string',
      description: 'City',
    },
    jobTitle: {
      type: 'string',
      description: 'Job title',
    },
  },
  required: ['id'],
};

/**
 * List people query input - filtering and pagination.
 */
const listPeopleQuerySchema: PortSchema = {
  type: 'object',
  description: 'Query parameters for listing people',
  properties: {
    limit: {
      type: 'number',
      description: 'Maximum records to return (default 60, max 60)',
    },
    cursor: {
      type: 'string',
      description: 'Pagination cursor from previous response',
    },
    filter: {
      type: 'object',
      description: 'Filter conditions (e.g., { email: { eq: "test@example.com" } })',
    },
    orderBy: {
      type: 'string',
      description: 'Field to order by (e.g., "createdAt")',
    },
  },
};

/**
 * Person output - single person record from CRM.
 */
const personSchema: PortSchema = {
  type: 'object',
  description: 'Person record from Twenty CRM',
  properties: {
    id: {
      type: 'string',
      format: 'uuid',
      description: 'Unique person identifier',
    },
    firstName: {
      type: 'string',
      description: 'First name',
    },
    lastName: {
      type: 'string',
      description: 'Last name',
    },
    email: {
      type: 'string',
      format: 'email',
      description: 'Primary email',
    },
    phone: {
      type: 'string',
      description: 'Phone number',
    },
    city: {
      type: 'string',
      description: 'City',
    },
    companyId: {
      type: 'string',
      description: 'Associated company ID',
    },
    jobTitle: {
      type: 'string',
      description: 'Job title',
    },
    createdAt: {
      type: 'string',
      format: 'date-time',
      description: 'When record was created',
    },
    updatedAt: {
      type: 'string',
      format: 'date-time',
      description: 'When record was last updated',
    },
  },
  required: ['id', 'email'],
};

/**
 * People list output - paginated list of people.
 */
const peopleListSchema: PortSchema = {
  type: 'object',
  description: 'Paginated list of people',
  properties: {
    data: {
      type: 'array',
      description: 'Array of person records',
    },
    pageInfo: {
      type: 'object',
      description: 'Pagination info with hasNextPage and endCursor',
    },
  },
  required: ['data'],
};

// =============================================================================
// Port Contracts (Schemas) - NOTES
// =============================================================================

/**
 * Create note input - data needed to create a note.
 */
const createNoteSchema: PortSchema = {
  type: 'object',
  description: 'Create a new note attached to a person or activity',
  properties: {
    body: {
      type: 'string',
      description: 'Note content (supports markdown)',
    },
    title: {
      type: 'string',
      description: 'Note title/subject',
    },
    personId: {
      type: 'string',
      format: 'uuid',
      description: 'Person ID to attach note to',
    },
    companyId: {
      type: 'string',
      format: 'uuid',
      description: 'Company ID to attach note to',
    },
    opportunityId: {
      type: 'string',
      format: 'uuid',
      description: 'Opportunity ID to attach note to',
    },
  },
  required: ['body'],
};

/**
 * Update note input - data to update an existing note.
 */
const updateNoteSchema: PortSchema = {
  type: 'object',
  description: 'Update an existing note',
  properties: {
    id: {
      type: 'string',
      format: 'uuid',
      description: 'Note ID to update',
    },
    body: {
      type: 'string',
      description: 'Note content',
    },
    title: {
      type: 'string',
      description: 'Note title',
    },
  },
  required: ['id'],
};

/**
 * List notes query input - filtering by person/company.
 */
const listNotesQuerySchema: PortSchema = {
  type: 'object',
  description: 'Query parameters for listing notes',
  properties: {
    personId: {
      type: 'string',
      format: 'uuid',
      description: 'Filter notes by person ID',
    },
    companyId: {
      type: 'string',
      format: 'uuid',
      description: 'Filter notes by company ID',
    },
    limit: {
      type: 'number',
      description: 'Maximum records to return',
    },
    cursor: {
      type: 'string',
      description: 'Pagination cursor',
    },
  },
};

/**
 * Note output - single note record.
 */
const noteSchema: PortSchema = {
  type: 'object',
  description: 'Note record from Twenty CRM',
  properties: {
    id: {
      type: 'string',
      format: 'uuid',
      description: 'Unique note identifier',
    },
    body: {
      type: 'string',
      description: 'Note content',
    },
    title: {
      type: 'string',
      description: 'Note title',
    },
    personId: {
      type: 'string',
      description: 'Associated person ID',
    },
    companyId: {
      type: 'string',
      description: 'Associated company ID',
    },
    createdAt: {
      type: 'string',
      format: 'date-time',
      description: 'When note was created',
    },
    updatedAt: {
      type: 'string',
      format: 'date-time',
      description: 'When note was last updated',
    },
    createdBy: {
      type: 'object',
      description: 'User who created the note',
    },
  },
  required: ['id', 'body'],
};

/**
 * Notes list output - paginated list of notes.
 */
const notesListSchema: PortSchema = {
  type: 'object',
  description: 'Paginated list of notes',
  properties: {
    data: {
      type: 'array',
      description: 'Array of note records',
    },
    pageInfo: {
      type: 'object',
      description: 'Pagination info',
    },
  },
  required: ['data'],
};

/**
 * Delete input - generic delete by ID.
 */
const deleteByIdSchema: PortSchema = {
  type: 'object',
  description: 'Delete a record by ID',
  properties: {
    id: {
      type: 'string',
      format: 'uuid',
      description: 'Record ID to delete',
    },
  },
  required: ['id'],
};

/**
 * Delete confirmation output.
 */
const deleteConfirmationSchema: PortSchema = {
  type: 'object',
  description: 'Confirmation of deletion',
  properties: {
    id: {
      type: 'string',
      description: 'ID of deleted record',
    },
    deletedAt: {
      type: 'string',
      format: 'date-time',
      description: 'When record was deleted',
    },
    success: {
      type: 'boolean',
      description: 'Whether deletion succeeded',
    },
  },
  required: ['id', 'success'],
};

// =============================================================================
// Port Definitions
// =============================================================================

const inputs: Port[] = [
  // People operations
  {
    id: 'create_person',
    name: 'Create Person',
    direction: 'input',
    contract: createPersonSchema,
    required: false,
    description: 'Create a new person/client in the CRM',
  },
  {
    id: 'update_person',
    name: 'Update Person',
    direction: 'input',
    contract: updatePersonSchema,
    required: false,
    description: 'Update an existing person',
  },
  {
    id: 'list_people',
    name: 'List People',
    direction: 'input',
    contract: listPeopleQuerySchema,
    required: false,
    description: 'Query and filter people records',
  },
  {
    id: 'delete_person',
    name: 'Delete Person',
    direction: 'input',
    contract: deleteByIdSchema,
    required: false,
    description: 'Delete a person by ID',
  },
  // Notes operations
  {
    id: 'create_note',
    name: 'Create Note',
    direction: 'input',
    contract: createNoteSchema,
    required: false,
    description: 'Create a note attached to a person or company',
  },
  {
    id: 'update_note',
    name: 'Update Note',
    direction: 'input',
    contract: updateNoteSchema,
    required: false,
    description: 'Update an existing note',
  },
  {
    id: 'list_notes',
    name: 'List Notes',
    direction: 'input',
    contract: listNotesQuerySchema,
    required: false,
    description: 'Query notes by person or company',
  },
  {
    id: 'delete_note',
    name: 'Delete Note',
    direction: 'input',
    contract: deleteByIdSchema,
    required: false,
    description: 'Delete a note by ID',
  },
];

const outputs: Port[] = [
  // People outputs
  {
    id: 'person_created',
    name: 'Person Created',
    direction: 'output',
    contract: personSchema,
    description: 'Fires when a person is created',
  },
  {
    id: 'person_updated',
    name: 'Person Updated',
    direction: 'output',
    contract: personSchema,
    description: 'Fires when a person is updated',
  },
  {
    id: 'people_list',
    name: 'People List',
    direction: 'output',
    contract: peopleListSchema,
    description: 'Returns filtered/paginated list of people',
  },
  {
    id: 'person_deleted',
    name: 'Person Deleted',
    direction: 'output',
    contract: deleteConfirmationSchema,
    description: 'Fires when a person is deleted',
  },
  // Notes outputs
  {
    id: 'note_created',
    name: 'Note Created',
    direction: 'output',
    contract: noteSchema,
    description: 'Fires when a note is created',
  },
  {
    id: 'note_updated',
    name: 'Note Updated',
    direction: 'output',
    contract: noteSchema,
    description: 'Fires when a note is updated',
  },
  {
    id: 'notes_list',
    name: 'Notes List',
    direction: 'output',
    contract: notesListSchema,
    description: 'Returns notes for a person or company',
  },
  {
    id: 'note_deleted',
    name: 'Note Deleted',
    direction: 'output',
    contract: deleteConfirmationSchema,
    description: 'Fires when a note is deleted',
  },
];

// =============================================================================
// Integration Definition
// =============================================================================

export const twentyIntegration: IntegrationDefinition = {
  type: 'hubspot' as IntegrationDefinition['type'], // Deprecated: Twenty CRM has been replaced by foundational data layer
  name: 'Twenty CRM',
  description: 'Open-source CRM for managing clients, contacts, and notes',
  category: 'crm',
  ports: { inputs, outputs },
  requiredConfig: ['apiKeyEnvVar', 'baseUrl'],
  docsUrl: 'https://docs.twenty.com/developers/extend/capabilities/apis',
  icon: 'twenty',
};
