import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function useSocket(projectId, handlers = {}) {
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = io(SOCKET_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      if (projectId) socket.emit('join:project', { projectId });
    });

    socket.on('round:started', (data) => handlers.onRoundStarted?.(data));
    socket.on('agent:thinking', (data) => handlers.onAgentThinking?.(data));
    socket.on('agent:complete', (data) => handlers.onAgentComplete?.(data));
    socket.on('summarizer:running', () => handlers.onSummarizerRunning?.());
    socket.on('summarizer:complete', (data) => handlers.onSummarizerComplete?.(data));
    socket.on('leader:running', () => handlers.onLeaderRunning?.());
    socket.on('leader:complete', (data) => handlers.onLeaderComplete?.(data));
    socket.on('stage:transition', (data) => handlers.onStageTransition?.(data));
    socket.on('project:complete', (data) => handlers.onProjectComplete?.(data));
    socket.on('round:failed', (data) => handlers.onRoundFailed?.(data));

    if (handlers.onRawEvent) {
      socket.onAny((event, data) => handlers.onRawEvent(event, data));
    }

    return () => { socket.disconnect(); };
  }, [projectId]);

  const emit = useCallback((event, data) => {
    socketRef.current?.emit(event, data);
  }, []);

  return { emit };
}
