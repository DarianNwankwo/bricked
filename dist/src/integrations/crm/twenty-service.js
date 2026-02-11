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
// Twenty CRM Service Class
// =============================================================================
export class TwentyService {
    apiKey;
    baseUrl;
    constructor(config) {
        this.apiKey = config.apiKey;
        this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    }
    /**
     * Create a TwentyService from environment variables.
     */
    static fromEnv(apiKeyEnvVar = 'TWENTY_API_KEY', baseUrlEnvVar = 'TWENTY_BASE_URL') {
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
    async request(method, endpoint, body) {
        const url = `${this.baseUrl}/rest${endpoint}`;
        const headers = {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
        };
        const options = {
            method,
            headers,
        };
        if (body && (method === 'POST' || method === 'PATCH')) {
            options.body = JSON.stringify(body);
        }
        const response = await fetch(url, options);
        if (!response.ok) {
            const errorText = await response.text();
            throw new TwentyApiError(`Twenty API error: ${response.status} ${response.statusText}`, response.status, errorText);
        }
        // DELETE may return empty body
        if (method === 'DELETE') {
            return { success: true };
        }
        return (await response.json());
    }
    // ===========================================================================
    // People Operations
    // ===========================================================================
    /**
     * Create a new person in Twenty CRM.
     */
    async createPerson(input) {
        return this.request('POST', '/people', input);
    }
    /**
     * Get a person by ID.
     */
    async getPerson(id) {
        return this.request('GET', `/people/${id}`);
    }
    /**
     * Update an existing person.
     */
    async updatePerson(input) {
        const { id, ...data } = input;
        return this.request('PATCH', `/people/${id}`, data);
    }
    /**
     * Delete a person by ID.
     */
    async deletePerson(id) {
        return this.request('DELETE', `/people/${id}`);
    }
    /**
     * List people with optional filtering and pagination.
     */
    async listPeople(options = {}) {
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
        return this.request('GET', endpoint);
    }
    /**
     * Find a person by email.
     */
    async findPersonByEmail(email) {
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
    async upsertPerson(input) {
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
    async createNote(input) {
        return this.request('POST', '/notes', input);
    }
    /**
     * Get a note by ID.
     */
    async getNote(id) {
        return this.request('GET', `/notes/${id}`);
    }
    /**
     * Update an existing note.
     */
    async updateNote(input) {
        const { id, ...data } = input;
        return this.request('PATCH', `/notes/${id}`, data);
    }
    /**
     * Delete a note by ID.
     */
    async deleteNote(id) {
        return this.request('DELETE', `/notes/${id}`);
    }
    /**
     * List notes with optional filtering.
     */
    async listNotes(options = {}) {
        const params = new URLSearchParams();
        if (options.limit) {
            params.set('limit', String(Math.min(options.limit, 60)));
        }
        if (options.cursor) {
            params.set('cursor', options.cursor);
        }
        // Build filter for person/company
        const filter = options.filter || {};
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
        return this.request('GET', endpoint);
    }
    /**
     * Get all notes for a person.
     */
    async getNotesForPerson(personId, limit = 50) {
        const result = await this.listNotes({ personId, limit });
        return result.data;
    }
    /**
     * Add a session note for a person.
     * Convenience method for coaching use case.
     */
    async addSessionNote(personId, sessionTitle, notes, sessionDate) {
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
    static clientToTwentyPerson(client) {
        return {
            firstName: client.firstName,
            lastName: client.lastName,
            email: client.email,
            phone: client.phone,
            // Map any additional metadata fields as needed
            city: client.metadata?.city,
            jobTitle: client.metadata?.jobTitle,
        };
    }
    /**
     * Convert a Twenty Person to Brick CRM Client format.
     */
    static twentyPersonToClient(person) {
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
    statusCode;
    responseBody;
    constructor(message, statusCode, responseBody) {
        super(message);
        this.statusCode = statusCode;
        this.responseBody = responseBody;
        this.name = 'TwentyApiError';
    }
}
//# sourceMappingURL=twenty-service.js.map