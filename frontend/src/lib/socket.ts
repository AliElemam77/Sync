import { io, Socket } from 'socket.io-client';
import { getAuthToken } from './cookies';

let socket: Socket | null = null;

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export function getSocket(): Socket {
  if (!socket && typeof window !== 'undefined') {
    const token = getAuthToken();
    socket = io(SOCKET_URL, {
      auth: { token },
      extraHeaders: {
        Authorization: token ? `Bearer ${token}` : '',
      },
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
  }
  return socket as Socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
