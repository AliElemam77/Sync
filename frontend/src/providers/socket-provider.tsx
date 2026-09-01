'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import Cookies from 'js-cookie';
import {
  Bell,
  AlertTriangle,
  CheckCircle2,
  MessageSquare,
  UserCheck,
  PlusCircle,
  ArrowRight,
  X,
} from 'lucide-react';

export interface InAppNotification {
  id: string;
  type: 'TASK_ASSIGNED' | 'STATUS_CHANGED' | 'NEW_COMMENT' | 'NEEDS_REVISION' | 'TASK_DONE' | 'NEW_TASK';
  title: string;
  message: string;
  taskId?: string;
  createdAt: string;
  read: boolean;
  actor?: {
    name: string;
    avatarUrl?: string;
  };
}

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  notifications: InAppNotification[];
  unreadCount: number;
  activeToast: InAppNotification | null;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  dismissToast: () => void;
  selectedTaskIdFromNotification: string | null;
  setSelectedTaskIdFromNotification: (taskId: string | null) => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  notifications: [],
  unreadCount: 0,
  activeToast: null,
  markAsRead: () => {},
  markAllAsRead: () => {},
  clearNotifications: () => {},
  dismissToast: () => {},
  selectedTaskIdFromNotification: null,
  setSelectedTaskIdFromNotification: () => {},
});

export const useSocket = () => useContext(SocketContext);

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:4000';

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [activeToast, setActiveToast] = useState<InAppNotification | null>(null);
  const [selectedTaskIdFromNotification, setSelectedTaskIdFromNotification] = useState<string | null>(null);

  // Play subtle in-app notification chime (Audio API)
  const playNotificationSound = useCallback(() => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    } catch {
      // Audio not permitted or supported in this context
    }
  }, []);

  const pushNotification = useCallback(
    (notif: InAppNotification) => {
      setNotifications((prev) => [notif, ...prev.slice(0, 49)]); // Keep latest 50
      setActiveToast(notif);
      playNotificationSound();
    },
    [playNotificationSound],
  );

  useEffect(() => {
    const token = Cookies.get('sync_access_token');
    if (!token) return;

    const s = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
    });

    s.on('connect', () => {
      setIsConnected(true);
    });

    s.on('disconnect', () => {
      setIsConnected(false);
    });

    // 1. Task Created Live Sync
    s.on('task:created', (createdTask) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks', 'backlog'] });
    });

    // 2. Task Updated Live Sync
    s.on('task:updated', (updatedTask) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks', 'backlog'] });
      if (updatedTask?.id) {
        queryClient.invalidateQueries({ queryKey: ['task', updatedTask.id] });
      }
    });

    // 3. Task Status Changed Live Sync
    s.on('task:status_changed', (payload) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks', 'backlog'] });
      if (payload?.taskId) {
        queryClient.invalidateQueries({ queryKey: ['task', payload.taskId] });
      }
    });

    // 4. Task Comment Added Live Sync
    s.on('task:comment_added', (payload) => {
      if (payload?.taskId) {
        queryClient.invalidateQueries({ queryKey: ['task', payload.taskId] });
      }
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    });

    // 5. Task Deleted Live Sync
    s.on('task:deleted', (payload) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks', 'backlog'] });
    });

    // 6. Direct In-App User Notifications
    s.on('notification:new', (notif: InAppNotification) => {
      pushNotification(notif);
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, [queryClient, pushNotification]);

  // Auto-dismiss active floating toast after 5 seconds
  useEffect(() => {
    if (!activeToast) return;
    const timer = setTimeout(() => {
      setActiveToast(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [activeToast]);

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const dismissToast = () => {
    setActiveToast(null);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        notifications,
        unreadCount,
        activeToast,
        markAsRead,
        markAllAsRead,
        clearNotifications,
        dismissToast,
        selectedTaskIdFromNotification,
        setSelectedTaskIdFromNotification,
      }}
    >
      {children}

      {/* Floating Real-Time Toast Alert */}
      {activeToast && (
        <div className="fixed bottom-5 right-5 z-[9999] max-w-sm w-full animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div
            onClick={() => {
              if (activeToast.taskId) {
                setSelectedTaskIdFromNotification(activeToast.taskId);
              }
              markAsRead(activeToast.id);
              dismissToast();
            }}
            className="flex items-start gap-3 p-4 rounded-2xl bg-slate-900/95 border border-indigo-500/40 text-white shadow-2xl backdrop-blur-xl cursor-pointer hover:border-indigo-400 transition-all group"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600/30 border border-indigo-500/30">
              {activeToast.type === 'NEEDS_REVISION' ? (
                <AlertTriangle className="h-5 w-5 text-rose-400" />
              ) : activeToast.type === 'TASK_DONE' ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              ) : activeToast.type === 'NEW_COMMENT' ? (
                <MessageSquare className="h-5 w-5 text-sky-400" />
              ) : activeToast.type === 'TASK_ASSIGNED' ? (
                <UserCheck className="h-5 w-5 text-indigo-400" />
              ) : activeToast.type === 'NEW_TASK' ? (
                <PlusCircle className="h-5 w-5 text-amber-400" />
              ) : (
                <Bell className="h-5 w-5 text-indigo-400" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-indigo-300 truncate">
                  {activeToast.title}
                </h4>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    dismissToast();
                  }}
                  className="text-slate-400 hover:text-white p-0.5"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5 line-clamp-2">
                {activeToast.message}
              </p>
              <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-800 text-[10px] text-slate-400">
                <span>{new Date(activeToast.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <span className="inline-flex items-center gap-1 text-indigo-400 group-hover:underline">
                  <span>Click to view</span>
                  <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </SocketContext.Provider>
  );
}
