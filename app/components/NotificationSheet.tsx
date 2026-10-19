'use client';

import { useNotifications, type Notification } from '../hooks/useNotifications';
import { Sheet } from './Sheet';
import { Bell, CheckCheck, MessageCircle, Heart, UsersRound, Gift, Calendar } from 'lucide-react';
import { timeAgo } from '../lib/city-store';

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

function NotificationItem({ notification, onMarkAsRead }: { notification: Notification; onMarkAsRead: (id: string) => void }) {
  const Icon = ICONS[notification.type] || Bell;
  return (
    <button
      className={`gsheet-row gsheet-notif${notification.read ? '' : ' is-unread'}`}
      onClick={() => !notification.read && onMarkAsRead(notification.id)}
    >
      <span className="gsheet-notif-icon"><Icon size={17} /></span>
      <div className="gsheet-copy">
        <strong>{notification.title}</strong>
        <span>{notification.body}</span>
        <small>{timeAgo(new Date(notification.createdAt).getTime())}</small>
      </div>
      {!notification.read && <span className="gsheet-notif-dot" />}
    </button>
  );
}

export function NotificationSheet({ open, userAddress, onClose }: NotificationSheetProps) {
  const { notifications, unreadCount, loading, error, markAsRead, markAllAsRead } = useNotifications(userAddress);

  return (
    <Sheet open={open} onClose={onClose} title="Notifications">
      <div className="gsheet">
        {unreadCount > 0 && (
          <div className="vault-room-head" style={{ padding: '2px 2px 6px' }}>
            <span className="gsheet-stat">{unreadCount} unread</span>
            <button className="gsheet-action" onClick={markAllAsRead}><CheckCheck size={14} /> Mark all read</button>
          </div>
        )}

        {loading && notifications.length === 0 ? (
          <div className="gsheet-loading">Checking the city for you…</div>
        ) : error ? (
          <div className="gsheet-error">{error}</div>
        ) : notifications.length === 0 ? (
          <div className="gsheet-empty">
            <strong>All quiet</strong>
            <p>We&apos;ll ping you when someone interacts.</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <NotificationItem key={notification.id} notification={notification} onMarkAsRead={markAsRead} />
          ))
        )}
      </div>
    </Sheet>
  );
}
