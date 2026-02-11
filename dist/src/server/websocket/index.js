// WebSocket server for real-time collaboration
import { Server } from 'socket.io';
import { verifyToken } from '../middleware/auth.js';
import { getDatabase } from '../db/client.js';
import * as Y from 'yjs';
// Store active Yjs documents per project
const projectDocs = new Map();
const projectPresence = new Map();
// Generate a random color for user cursor
function generateUserColor() {
    const colors = [
        '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
        '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
        '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e',
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}
// Get or create Yjs document for a project
function getProjectDoc(projectId) {
    let doc = projectDocs.get(projectId);
    if (!doc) {
        doc = new Y.Doc();
        projectDocs.set(projectId, doc);
    }
    return doc;
}
export function setupWebSocket(httpServer) {
    const io = new Server(httpServer, {
        cors: {
            origin: '*',
            methods: ['GET', 'POST'],
        },
        path: '/socket.io',
    });
    // Authentication middleware
    io.use(async (socket, next) => {
        const token = socket.handshake.auth.token || socket.handshake.query.token;
        if (!token) {
            return next(new Error('Authentication required'));
        }
        const decoded = verifyToken(token);
        if (!decoded) {
            return next(new Error('Invalid token'));
        }
        const db = getDatabase();
        const user = await db.getUserById(decoded.userId);
        if (!user) {
            return next(new Error('User not found'));
        }
        // Attach user info to socket
        socket.data.user = {
            id: user.id,
            name: user.name,
            email: user.email,
            color: generateUserColor(),
        };
        next();
    });
    io.on('connection', (socket) => {
        console.log(`[WS] User connected: ${socket.data.user.email}`);
        // Handle joining a project room
        socket.on('join-project', async (projectId) => {
            const db = getDatabase();
            // Verify user has access to project
            const project = await db.getProjectById(projectId);
            if (!project) {
                socket.emit('error', { message: 'Project not found' });
                return;
            }
            // Check if user is owner or member
            const isOwner = project.userId === socket.data.user.id;
            const member = await db.getProjectMember(projectId, socket.data.user.id);
            if (!isOwner && !member) {
                socket.emit('error', { message: 'Not authorized to access this project' });
                return;
            }
            // Leave any previous project rooms
            const rooms = Array.from(socket.rooms).filter(r => r.startsWith('project:'));
            rooms.forEach(room => socket.leave(room));
            // Join the new project room
            const roomName = `project:${projectId}`;
            socket.join(roomName);
            socket.data.projectId = projectId;
            console.log(`[WS] ${socket.data.user.email} joined project ${projectId}`);
            // Initialize presence for this project
            if (!projectPresence.has(projectId)) {
                projectPresence.set(projectId, new Map());
            }
            // Add user to presence
            const presence = projectPresence.get(projectId);
            presence.set(socket.data.user.id, {
                id: socket.data.user.id,
                name: socket.data.user.name,
                email: socket.data.user.email,
                color: socket.data.user.color,
                lastSeen: new Date(),
            });
            // Send current presence to the joining user
            socket.emit('presence-init', Array.from(presence.values()));
            // Broadcast user joined to others in the room
            socket.to(roomName).emit('user-joined', {
                id: socket.data.user.id,
                name: socket.data.user.name,
                email: socket.data.user.email,
                color: socket.data.user.color,
            });
            // Get or create Yjs document for sync
            const doc = getProjectDoc(projectId);
            // Send initial Yjs state to the joining user
            const state = Y.encodeStateAsUpdate(doc);
            socket.emit('yjs-sync', {
                projectId,
                update: Array.from(state),
            });
        });
        // Handle leaving a project room
        socket.on('leave-project', (projectId) => {
            const roomName = `project:${projectId}`;
            socket.leave(roomName);
            // Remove from presence
            const presence = projectPresence.get(projectId);
            if (presence) {
                presence.delete(socket.data.user.id);
                // Broadcast user left
                socket.to(roomName).emit('user-left', { userId: socket.data.user.id });
            }
            socket.data.projectId = null;
            console.log(`[WS] ${socket.data.user.email} left project ${projectId}`);
        });
        // Handle cursor movement
        socket.on('cursor-move', ({ projectId, position }) => {
            const presence = projectPresence.get(projectId);
            if (presence && presence.has(socket.data.user.id)) {
                const userPresence = presence.get(socket.data.user.id);
                userPresence.cursor = position;
                userPresence.lastSeen = new Date();
                // Broadcast cursor update to others
                socket.to(`project:${projectId}`).emit('cursor-update', {
                    userId: socket.data.user.id,
                    position,
                    name: socket.data.user.name,
                    color: socket.data.user.color,
                });
            }
        });
        // Handle component selection
        socket.on('component-select', ({ projectId, componentId }) => {
            const presence = projectPresence.get(projectId);
            if (presence && presence.has(socket.data.user.id)) {
                const userPresence = presence.get(socket.data.user.id);
                userPresence.selectedComponent = componentId || undefined;
                userPresence.lastSeen = new Date();
                // Broadcast selection update to others
                socket.to(`project:${projectId}`).emit('component-selected', {
                    userId: socket.data.user.id,
                    componentId,
                    name: socket.data.user.name,
                    color: socket.data.user.color,
                });
            }
        });
        // Handle Yjs document updates (CRDT sync)
        socket.on('yjs-update', ({ projectId, update }) => {
            const doc = getProjectDoc(projectId);
            // Apply the update to the document
            Y.applyUpdate(doc, new Uint8Array(update));
            // Broadcast update to all other users in the project
            socket.to(`project:${projectId}`).emit('yjs-update', {
                projectId,
                update,
                from: socket.data.user.id,
            });
        });
        // Handle architecture changes (high-level events)
        socket.on('architecture-update', async ({ projectId, type, payload }) => {
            // Broadcast the change to other users
            socket.to(`project:${projectId}`).emit('architecture-update', {
                type,
                payload,
                from: {
                    id: socket.data.user.id,
                    name: socket.data.user.name,
                },
            });
        });
        // Handle disconnection
        socket.on('disconnect', () => {
            console.log(`[WS] User disconnected: ${socket.data.user.email}`);
            // Remove user from all project presence maps
            const projectId = socket.data.projectId;
            if (projectId) {
                const presence = projectPresence.get(projectId);
                if (presence) {
                    presence.delete(socket.data.user.id);
                    // Broadcast user left
                    socket.to(`project:${projectId}`).emit('user-left', { userId: socket.data.user.id });
                }
            }
        });
        // Handle ping for connection health
        socket.on('ping', () => {
            socket.emit('pong');
        });
    });
    // Cleanup stale presence periodically
    setInterval(() => {
        const now = new Date();
        const staleThreshold = 60000; // 1 minute
        for (const [projectId, presence] of projectPresence) {
            for (const [userId, user] of presence) {
                if (now.getTime() - user.lastSeen.getTime() > staleThreshold) {
                    presence.delete(userId);
                    io.to(`project:${projectId}`).emit('user-left', { userId });
                }
            }
            // Clean up empty project presence maps
            if (presence.size === 0) {
                projectPresence.delete(projectId);
            }
        }
    }, 30000); // Check every 30 seconds
    return io;
}
// Export for testing
export { projectDocs, projectPresence };
//# sourceMappingURL=index.js.map