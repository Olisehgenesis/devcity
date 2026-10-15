'use client';

import { useNotifications, type Notification } from '../hooks/useNotifications';
import { Sheet } from './Sheet';
import { Bell, Check, CheckCheck, MessageCircle, Heart, UsersRound, Gift, Calendar } from 'lucide-react';
import { timeAgo } from '../lib/city-store';
import { avatarBackgroundForColor, dicebearAvatarUrl } from '../lib/avatars';

interface NotificationSheetProps {
  open: boolean;
  userAddress: string | null;
  onClose: () => void;
}

const ICONS: Record<string, any> = {
  message: MessageCircle,
  like: Heart,
  comment: MessageCircle,
  reaction: Heart,
  follow: UsersRound,
  event_update: Calendar,
  drop_claimed: Gift,
};

function NotificationItem({
  notification,
  onMarkAsRead,
}: {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
}) {
  const Icon = ICONS[notification.type] || Bell;
  const bgColor = notification.read ? 'bg-transparent' : 'bg-blue-50 dark:bg-blue-900/20';

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${bgColor}`}
      onClick={() => !notification.read && onMarkAsRead(notification.id)}
    >
      <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{notification.title}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">
          {notification.body}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          {timeAgo(new Date(notification.createdAt).getTime())}
        </p>
      </div>
      {!notification.read && (
        <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-2" />
      )}
    </div>
  );
}

export function NotificationSheet({ open, userAddress, onClose }: NotificationSheetProps) {
  const { notifications, unreadCount, loading, error, markAsRead, markAllAsRead } =
    useNotifications(userAddress);

  return (
    <Sheet open={open} onClose={onClose} title="Notifications">
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            <span className="font-semibold">Notifications</span>
            {unreadCount > 0 && (
              <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
            >
              <CheckCheck className="w-4 h-4" />
              Mark all read
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading && notifications.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
            </div>
          ) : error ? (
            <div className="p-4 text-center text-red-500">{error}</div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500">
              <Bell className="w-12 h-12 mb-2 opacity-50" />
              <p>No notifications yet</p>
              <p className="text-sm">We&apos;ll notify you when something happens</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={markAsRead}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </Sheet>
  );
}