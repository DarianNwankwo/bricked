/**
 * Twenty CRM Service
 *
 * HTTP client for interacting with Twenty CRM's REST API.
 * Handles authentication, requests, and response parsing.
 *
 * API Documentation: https://docs.twenty.com/developers/extend/capabilities/apis
 * Rate Limit: 100 calls/minute
 */
export interface TwentyConfig {
    apiKey: string;
    baseUrl: string;
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
export declare class TwentyService {
    private apiKey;
    private baseUrl;
    constructor(config: TwentyConfig);
    /**
     * Create a TwentyService from environment variables.
     */
    static fromEnv(apiKeyEnvVar?: string, baseUrlEnvVar?: string): TwentyService;
    /**
     * Make an authenticated request to Twenty API.
     */
    private request;
    /**
     * Create a new person in Twenty CRM.
     */
    createPerson(input: CreatePersonInput): Promise<TwentyPerson>;
    /**
     * Get a person by ID.
     */
    getPerson(id: string): Promise<TwentyPerson>;
    /**
     * Update an existing person.
     */
    updatePerson(input: UpdatePersonInput): Promise<TwentyPerson>;
    /**
     * Delete a person by ID.
     */
    deletePerson(id: string): Promise<{
        success: boolean;
    }>;
    /**
     * List people with optional filtering and pagination.
     */
    listPeople(options?: ListQueryOptions): Promise<PaginatedResponse<TwentyPerson>>;
    /**
     * Find a person by email.
     */
    findPersonByEmail(email: string): Promise<TwentyPerson | null>;
    /**
     * Upsert a person (create if not exists, update if exists).
     * Uses email as the unique identifier.
     */
    upsertPerson(input: CreatePersonInput): Promise<TwentyPerson>;
    /**
     * Create a new note.
     */
    createNote(input: CreateNoteInput): Promise<TwentyNote>;
    /**
     * Get a note by ID.
     */
    getNote(id: string): Promise<TwentyNote>;
    /**
     * Update an existing note.
     */
    updateNote(input: UpdateNoteInput): Promise<TwentyNote>;
    /**
     * Delete a note by ID.
     */
    deleteNote(id: string): Promise<{
        success: boolean;
    }>;
    /**
     * List notes with optional filtering.
     */
    listNotes(options?: ListNotesOptions): Promise<PaginatedResponse<TwentyNote>>;
    /**
     * Get all notes for a person.
     */
    getNotesForPerson(personId: string, limit?: number): Promise<TwentyNote[]>;
    /**
     * Add a session note for a person.
     * Convenience method for coaching use case.
     */
    addSessionNote(personId: string, sessionTitle: string, notes: string, sessionDate?: Date): Promise<TwentyNote>;
    /**
     * Convert a Brick CRM Client to Twenty Person format.
     */
    static clientToTwentyPerson(client: {
        firstName: string;
        lastName: string;
        email: string;
        phone?: string;
        metadata?: Record<string, unknown>;
    }): CreatePersonInput;
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
    };
}
export declare class TwentyApiError extends Error {
    statusCode: number;
    responseBody: string;
    constructor(message: string, statusCode: number, responseBody: string);
}
//# sourceMappingURL=twenty-service.d.ts.map