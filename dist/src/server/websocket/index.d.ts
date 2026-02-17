import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import * as Y from 'yjs';
declare const projectDocs: Map<string, Y.Doc>;
interface UserPresence {
    id: string;
    name: string;
    email: string;
    color: string;
    cursor?: {
        x: number;
        y: number;
    };
    selectedComponent?: string;
    lastSeen: Date;
}
declare const projectPresence: Map<string, Map<string, UserPresence>>;
export declare function setupWebSocket(httpServer: HttpServer): Server;
/**
 * Broadcast an event to all users in a project room.
 * Used by API routes to push real-time updates (feature changes, agent status, etc.)
 */
export declare function broadcastToProject(io: Server, projectId: string, event: string, data: unknown): void;
export { projectDocs, projectPresence };
//# sourceMappingURL=index.d.ts.map