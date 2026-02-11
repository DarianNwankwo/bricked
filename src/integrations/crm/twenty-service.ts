/**
 * Twenty CRM Service
 *
 * HTTP client for interacting with Twenty CRM's REST API.
 * Handles authentication, requests, and response parsing.
 *
 * API Documentation: https://docs.twenty.com/developers/extend/capabilities/apis
 * Rate Limit: 100 calls/minute
 */

// =============================================================================
// Types
// =============================================================================

export interface TwentyConfig {
  apiKey: string;
  baseUrl: string; // e.g., 'https://api.twenty.com' or self-hosted URL
}

export interface TwentyPerson {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  city?: string;
  companyId?: string;
  jobTitle?: string;
  linkedinUrl?: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TwentyNote {
  id: string;
  body: string;
  title?: string;
  personId?: string;
  companyId?: string;
  opportunityId?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: {
    id: string;
    name: string;
  };
}

export interface PageInfo {
  hasNextPage: boolean;
  endCursor?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pageInfo: PageInfo;
}

export interface CreatePersonInput {
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  city?: string;
  companyId?: string;
  jobTitle?: string;
  linkedinUrl?: string;
  avatarUrl?: string;
}

export interface UpdatePersonInput {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  city?: string;
  jobTitle?: string;
}

export interface CreateNoteInput {
  body: string;
  title?: string;
  personId?: string;
  companyId?: string;
  opportunityId?: string;
}

export interface UpdateNoteInput {
  id: string;
  body?: string;
  title?: string;
}

export interface ListQueryOptions {
  limit?: number;
  cursor?: string;
  filter?: Record<string, unknown>;
  orderBy?: string;
}

export interface ListNotesOptions extends ListQueryOptions {
  personId?: string;
  companyId?: string;
}

// =============================================================================
// Twenty CRM Service Class
// =============================================================================

export class TwentyService {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: TwentyConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
  }

  /**
   * Create a TwentyService from environment variables.
   */
  static fromEnv(apiKeyEnvVar = 'TWENTY_API_KEY', baseUrlEnvVar = 'TWENTY_BASE_URL'): TwentyService {
    const apiKey = process.env[apiKeyEnvVar];
    const baseUrl = process.env[baseUrlEnvVar] || 'https://api.twenty.com';

    if (!apiKey) {
      throw new Error(`Missing Twenty API key. Set ${apiKeyEnvVar} environment variable.`);
    }

    return new TwentyService({ apiKey, baseUrl });
  }

  /**
   * Make an authenticated request to Twenty API.
   */
  private async request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    endpoint: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}/rest${endpoint}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body && (method === 'POST' || method === 'PATCH')) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      throw new TwentyApiError(
        `Twenty API error: ${response.status} ${response.statusText}`,
        response.status,
        errorText
      );
    }

    // DELETE may return empty body
    if (method === 'DELETE') {
      return { success: true } as T;
    }

    return (await response.json()) as T;
  }

  // ===========================================================================
  // People Operations
  // ===========================================================================

  /**
   * Create a new person in Twenty CRM.
   */
  async createPerson(input: CreatePersonInput): Promise<TwentyPerson> {
    return this.request<TwentyPerson>('POST', '/people', input);
  }

  /**
   * Get a person by ID.
   */
  async getPerson(id: string): Promise<TwentyPerson> {
    return this.request<TwentyPerson>('GET', `/people/${id}`);
  }

  /**
   * Update an existing person.
   */
  async updatePerson(input: UpdatePersonInput): Promise<TwentyPerson> {
    const { id, ...data } = input;
    return this.request<TwentyPerson>('PATCH', `/people/${id}`, data);
  }

  /**
   * Delete a person by ID.
   */
  async deletePerson(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('DELETE', `/people/${id}`);
  }

  /**
   * List people with optional filtering and pagination.
   */
  async listPeople(options: ListQueryOptions = {}): Promise<PaginatedResponse<TwentyPerson>> {
    const params = new URLSearchParams();

    if (options.limit) {
      params.set('limit', String(Math.min(options.limit, 60))); // Max 60 per Twenty docs
    }
    if (options.cursor) {
      params.set('cursor', options.cursor);
    }
    if (options.orderBy) {
      params.set('orderBy', options.orderBy);
    }
    if (options.filter) {
      params.set('filter', JSON.stringify(options.filter));
    }

    const queryString = params.toString();
    const endpoint = queryString ? `/people?${queryString}` : '/people';

    return this.request<PaginatedResponse<TwentyPerson>>('GET', endpoint);
  }

  /**
   * Find a person by email.
   */
  async findPersonByEmail(email: string): Promise<TwentyPerson | null> {
    const result = await this.listPeople({
      filter: { email: { eq: email } },
      limit: 1,
    });
    return result.data[0] || null;
  }

  /**
   * Upsert a person (create if not exists, update if exists).
   * Uses email as the unique identifier.
   */
  async upsertPerson(input: CreatePersonInput): Promise<TwentyPerson> {
    const existing = await this.findPersonByEmail(input.email);

    if (existing) {
      return this.updatePerson({ id: existing.id, ...input });
    }

    return this.createPerson(input);
  }

  // ===========================================================================
  // Notes Operations
  // ===========================================================================

  /**
   * Create a new note.
   */
  async createNote(input: CreateNoteInput): Promise<TwentyNote> {
    return this.request<TwentyNote>('POST', '/notes', input);
  }

  /**
   * Get a note by ID.
   */
  async getNote(id: string): Promise<TwentyNote> {
    return this.request<TwentyNote>('GET', `/notes/${id}`);
  }

  /**
   * Update an existing note.
   */
  async updateNote(input: UpdateNoteInput): Promise<TwentyNote> {
    const { id, ...data } = input;
    return this.request<TwentyNote>('PATCH', `/notes/${id}`, data);
  }

  /**
   * Delete a note by ID.
   */
  async deleteNote(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('DELETE', `/notes/${id}`);
  }

  /**
   * List notes with optional filtering.
   */
  async listNotes(options: ListNotesOptions = {}): Promise<PaginatedResponse<TwentyNote>> {
    const params = new URLSearchParams();

    if (options.limit) {
      params.set('limit', String(Math.min(options.limit, 60)));
    }
    if (options.cursor) {
      params.set('cursor', options.cursor);
    }

    // Build filter for person/company
    const filter: Record<string, unknown> = options.filter || {};
    if (options.personId) {
      filter.personId = { eq: options.personId };
    }
    if (options.companyId) {
      filter.companyId = { eq: options.companyId };
    }

    if (Object.keys(filter).length > 0) {
      params.set('filter', JSON.stringify(filter));
    }

    const queryString = params.toString();
    const endpoint = queryString ? `/notes?${queryString}` : '/notes';

    return this.request<PaginatedResponse<TwentyNote>>('GET', endpoint);
  }

  /**
   * Get all notes for a person.
   */
  async getNotesForPerson(personId: string, limit = 50): Promise<TwentyNote[]> {
    const result = await this.listNotes({ personId, limit });
    return result.data;
  }

  /**
   * Add a session note for a person.
   * Convenience method for coaching use case.
   */
  async addSessionNote(
    personId: string,
    sessionTitle: string,
    notes: string,
    sessionDate?: Date
  ): Promise<TwentyNote> {
    const dateStr = sessionDate
      ? sessionDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    return this.createNote({
      personId,
      title: `${sessionTitle} - ${dateStr}`,
      body: notes,
    });
  }

  // ===========================================================================
  // Coaching-Specific Helpers
  // ===========================================================================

  /**
   * Convert a Brick CRM Client to Twenty Person format.
   */
  static clientToTwentyPerson(client: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    metadata?: Record<string, unknown>;
  }): CreatePersonInput {
    return {
      firstName: client.firstName,
      lastName: client.lastName,
      email: client.email,
      phone: client.phone,
      // Map any additional metadata fields as needed
      city: client.metadata?.city as string | undefined,
      jobTitle: client.metadata?.jobTitle as string | undefined,
    };
  }

  /**
   * Convert a Twenty Person to Brick CRM Client format.
   */
  static twentyPersonToClient(person: TwentyPerson): {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    createdAt: string;
    updatedAt: string;
    metadata: Record<string, unknown>;
  } {
    return {
      id: person.id,
      firstName: person.firstName || '',
      lastName: person.lastName || '',
      email: person.email,
      phone: person.phone,
      createdAt: person.createdAt,
      updatedAt: person.updatedAt,
      metadata: {
        city: person.city,
        jobTitle: person.jobTitle,
        linkedinUrl: person.linkedinUrl,
        companyId: person.companyId,
        twentyId: person.id, // Keep reference to Twenty ID
      },
    };
  }
}

// =============================================================================
// Error Class
// =============================================================================

export class TwentyApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public responseBody: string
  ) {
    super(message);
    this.name = 'TwentyApiError';
  }
}
