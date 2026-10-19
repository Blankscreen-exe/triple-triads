import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  dismissNotification,
  getNotifications,
  notify,
  subscribeToNotifications,
} from './notifications';

afterEach(() => {
  for (const { id } of getNotifications()) dismissNotification(id);
});

describe('notifications', () => {
  it('shows each message until it is dismissed, telling subscribers', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToNotifications(listener);

    notify('Alice left the room');
    notify('Bob left the room');
    const [first] = getNotifications();
    if (first) dismissNotification(first.id);

    expect(getNotifications().map(({ message }) => message)).toEqual(['Bob left the room']);
    expect(listener).toHaveBeenCalledTimes(3);
    unsubscribe();
    notify('Carol left the room');
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('does not show a message twice while it is showing', () => {
    notify('Alice left the room');
    notify('Alice left the room');

    expect(getNotifications()).toHaveLength(1);
  });
});
