'use client';

import { useEffect, useSyncExternalStore } from 'react';
import {
  dismissNotification,
  getNotifications,
  getServerNotifications,
  subscribeToNotifications,
  type Notification,
} from '@/lib/notifications';
import { Window } from './window';

/** How long a notification stays on screen. */
const SHOW_MS = 8000;

/** Shows notifications posted with `notify()`. Rendered once, in the root layout. */
export function Toaster() {
  const notifications = useSyncExternalStore(
    subscribeToNotifications,
    getNotifications,
    getServerNotifications,
  );

  return (
    <div
      aria-label="Notifications"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-20 z-50 flex flex-col items-center gap-2 px-4"
    >
      {notifications.map((notification) => (
        <Toast key={notification.id} notification={notification} />
      ))}
    </div>
  );
}

function Toast({ notification }: { readonly notification: Notification }) {
  const { id, message } = notification;
  useEffect(() => {
    const timer = setTimeout(() => {
      dismissNotification(id);
    }, SHOW_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [id]);

  return (
    <Window className="pointer-events-auto flex w-full max-w-sm items-center gap-3 px-4 py-3">
      <p className="flex-1 text-sm font-semibold text-cream">{message}</p>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          dismissNotification(id);
        }}
        className="rounded px-1.5 text-lg leading-none text-slate-300 hover:bg-white/10 hover:text-white"
      >
        ×
      </button>
    </Window>
  );
}
