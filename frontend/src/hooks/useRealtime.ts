/**
 * useRealtime — Socket.IO hook for real-time project updates.
 *
 * Connects to the WebSocket server, joins the project room,
 * and dispatches events to handlers. Auto-reconnects and cleans up on unmount.
 */

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export interface RealtimeHandlers {
  onFeatureUpdate?: (data: { type: string; feature: unknown }) => void;
  onAgentStatus?: (data: { featureId: string; agentStatus: string; agentMessage?: string }) => void;
  onArchitectureUpdate?: (data: { type: string; payload: unknown; from: { id: string; name: string } }) => void;
  onPresenceInit?: (users: Array<{ id: string; name: string; email: string; color: string }>) => void;
  onUserJoined?: (user: { id: string; name: string; email: string; color: string }) => void;
  onUserLeft?: (data: { userId: string }) => void;
  onCursorUpdate?: (data: { userId: string; position: { x: number; y: number }; name: string; color: string }) => void;
  onComponentSelected?: (data: { userId: string; componentId: string | null; name: string; color: string }) => void;
}

export function useRealtime(projectId: string | undefined, handlers: RealtimeHandlers) {
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!projectId) return;

    const token = localStorage.getItem('brick-auth-token');
    if (!token) return;

    const socket = io(window.location.origin, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join-project', projectId);
    });

    // Feature board events
    socket.on('feature-update', (data) => {
      handlersRef.current.onFeatureUpdate?.(data);
    });

    // Agent status events
    socket.on('agent-status', (data) => {
      handlersRef.current.onAgentStatus?.(data);
    });

    // Architecture events (collaborative editing)
    socket.on('architecture-update', (data) => {
      handlersRef.current.onArchitectureUpdate?.(data);
    });

    // Presence events
    socket.on('presence-init', (users) => {
      handlersRef.current.onPresenceInit?.(users);
    });

    socket.on('user-joined', (user) => {
      handlersRef.current.onUserJoined?.(user);
    });

    socket.on('user-left', (data) => {
      handlersRef.current.onUserLeft?.(data);
    });

    socket.on('cursor-update', (data) => {
      handlersRef.current.onCursorUpdate?.(data);
    });

    socket.on('component-selected', (data) => {
      handlersRef.current.onComponentSelected?.(data);
    });

    return () => {
      if (projectId) {
        socket.emit('leave-project', projectId);
      }
      socket.disconnect();
      socketRef.current = null;
    };
  }, [projectId]);

  // Emit cursor movement
  const emitCursorMove = useCallback((position: { x: number; y: number }) => {
    if (socketRef.current?.connected && projectId) {
      socketRef.current.emit('cursor-move', { projectId, position });
    }
  }, [projectId]);

  // Emit component selection
  const emitComponentSelect = useCallback((componentId: string | null) => {
    if (socketRef.current?.connected && projectId) {
      socketRef.current.emit('component-select', { projectId, componentId });
    }
  }, [projectId]);

  return { emitCursorMove, emitComponentSelect, socket: socketRef };
}
