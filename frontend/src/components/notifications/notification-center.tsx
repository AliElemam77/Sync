import React, { useState, useRef, useEffect } from 'react';
import {
  Bell,
  AlertTriangle,
  CheckCircle2,
  MessageSquare,
  UserCheck,
  PlusCircle,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { useSocket, InAppNotification } from '../../providers/socket-provider';

export function NotificationCenter() {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearNotifications,
    setSelectedTaskIdFromNotification,
    isConnected,
  } = useSocket();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = (notif: InAppNotification) => {
    markAsRead(notif.id);
    if (notif.taskId) {
      setSelectedTaskIdFromNotification(notif.taskId);
    }
    setIsOpen(false);
  };

  const renderIcon = (type: InAppNotification['type']) => {
    switch (type) {
      case 'NEEDS_REVISION':
        return <AlertTriangle className="h-4 w-4 text-rose-400" />;
      case 'TASK_DONE':
        return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
      case 'NEW_COMMENT':
        return <MessageSquare className="h-4 w-4 text-sky-400" />;
      case 'TASK_ASSIGNED':
        return <UserCheck className="h-4 w-4 text-indigo-400" />;
      case 'NEW_TASK':
        return <PlusCircle className="h-4 w-4 text-amber-400" />;
      default:
        return <Bell className="h-4 w-4 text-indigo-400" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-800/80 text-slate-300 hover:border-slate-600 hover:bg-slate-700 hover:text-white transition-all shadow-sm"
        title="Real-time Notifications"
      >
        <Bell className="h-4 w-4" />

        {/* Live Socket Status Dot */}
        <span
          className={`absolute -top-0.5 -left-0.5 h-2 w-2 rounded-full border border-slate-900 ${
            isConnected ? 'bg-emerald-500' : 'bg-amber-500'
          }`}
          title={isConnected ? 'Real-time Live Sync Connected' : 'Connecting to Live Socket...'}
        />

        {/* Unread Count Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[9px] font-extrabold text-white animate-pulse shadow-md shadow-rose-600/40">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl backdrop-blur-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 p-3.5 bg-slate-900/90">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">Notifications</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold text-indigo-400 border border-indigo-500/30">
                  {unreadCount} unread
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-[11px]">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-indigo-400 hover:text-indigo-300 font-medium hover:underline"
                >
                  Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearNotifications}
                  className="text-slate-500 hover:text-slate-400"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-800/60">
            {notifications.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500 italic space-y-2">
                <Sparkles className="h-7 w-7 text-indigo-400/60 mx-auto" />
                <p className="font-semibold text-slate-400">All caught up!</p>
                <p className="text-[10px] text-slate-600">No new notifications.</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`flex items-start gap-3 p-3.5 transition-colors cursor-pointer hover:bg-slate-800/60 ${
                    !notif.read ? 'bg-indigo-950/20' : 'bg-transparent'
                  }`}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800 border border-slate-700">
                    {renderIcon(notif.type)}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-semibold text-white truncate">
                        {notif.title}
                      </p>
                      {!notif.read && (
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />
                      )}
                    </div>

                    <p className="text-[11px] text-slate-300 leading-snug line-clamp-2">
                      {notif.message}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                      <span>
                        {new Date(notif.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {notif.taskId && (
                        <span className="inline-flex items-center gap-1 text-indigo-400 font-medium hover:underline">
                          <span>View Task</span>
                          <ArrowRight className="h-3 w-3" />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
