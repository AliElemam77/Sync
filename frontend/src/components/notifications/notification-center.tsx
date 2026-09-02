import React, { useState, useRef, useEffect } from 'react';
import {
  FiBell,
  FiAlertTriangle,
  FiCheckCircle,
  FiMessageSquare,
  FiUserCheck,
  FiPlusCircle,
  FiCheck,
  FiTrash2,
  FiClock,
} from 'react-icons/fi';
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
        return <FiAlertTriangle className="h-4 w-4 text-rose-500" />;
      case 'TASK_DONE':
        return <FiCheckCircle className="h-4 w-4 text-emerald-500" />;
      case 'NEW_COMMENT':
        return <FiMessageSquare className="h-4 w-4 text-primary" />;
      case 'TASK_ASSIGNED':
        return <FiUserCheck className="h-4 w-4 text-brand-gold dark:text-brand-champagne" />;
      case 'NEW_TASK':
        return <FiPlusCircle className="h-4 w-4 text-amber-500" />;
      default:
        return <FiBell className="h-4 w-4 text-primary" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-surface hover:bg-surface-hover text-foreground-muted hover:text-foreground transition-all shadow-xs"
        title="مركز الإشعارات والتنبيهات"
      >
        <FiBell className="h-4.5 w-4.5" />

        {/* Live Socket Status Dot */}
        <span
          className={`absolute -top-0.5 -start-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-card ${
            isConnected ? 'bg-emerald-500' : 'bg-amber-500'
          }`}
          title={isConnected ? 'متصل لحظياً بالسيرفر' : 'جاري الاتصال...'}
        />

        {/* Unread Count Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -end-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-500 text-[9px] font-black text-white animate-pulse shadow-sm">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute start-0 md:start-auto md:end-0 mt-3 w-80 sm:w-96 rounded-3xl bg-card border border-border/40 shadow-luxury dark:shadow-luxury-dark backdrop-blur-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border/30 bg-surface-raised/40">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-foreground">مركز الإشعارات</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary font-mono">
                  {unreadCount} غير مقروء
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="text-primary hover:underline font-bold flex items-center gap-1"
                >
                  <FiCheck className="h-3.5 w-3.5" />
                  <span>تحديد كمقروء</span>
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={clearNotifications}
                  className="text-foreground-subtle hover:text-rose-500 p-1"
                  title="مسح الكل"
                >
                  <FiTrash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-border/20 no-scrollbar">
            {notifications.length === 0 ? (
              <div className="py-12 text-center text-xs text-foreground-muted space-y-2 p-6">
                <div className="h-12 w-12 rounded-2xl bg-surface-raised flex items-center justify-center text-foreground-subtle mx-auto shadow-inner">
                  <FiBell className="h-6 w-6 opacity-40" />
                </div>
                <p className="font-extrabold text-foreground">لا توجد إشعارات جديدة</p>
                <p className="text-[11px] text-foreground-subtle">
                  لقد اطلعت على كافة التحديثات والمهام الموجهة إليك.
                </p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`flex items-start gap-3 p-4 transition-all cursor-pointer hover:bg-surface/60 ${
                    !notif.read ? 'bg-primary/5' : 'bg-transparent'
                  }`}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-surface-raised shadow-inner">
                    {renderIcon(notif.type)}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-black text-foreground truncate">
                        {notif.title}
                      </p>
                      {!notif.read && (
                        <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                      )}
                    </div>

                    <p className="text-[11px] text-foreground-muted leading-relaxed line-clamp-2">
                      {notif.message}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-foreground-subtle pt-1 font-mono">
                      <span className="flex items-center gap-1">
                        <FiClock className="h-3 w-3" />
                        <span>
                          {new Date(notif.createdAt).toLocaleTimeString('ar-EG', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </span>
                      {notif.taskId && (
                        <span className="text-primary font-bold">عرض المهمة ←</span>
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
