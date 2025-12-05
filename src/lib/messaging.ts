import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { API_URL } from '@/lib/api';
import { getApps } from 'firebase/app';

const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

async function requestNotificationPermission(): Promise<NotificationPermission> {
  try {
    if (!('Notification' in window)) return 'denied';
    if (Notification.permission === 'granted') return 'granted';
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

export async function registerWebPushToken(uid: string): Promise<{ ok: boolean; token?: string; reason?: string }> {
  try {
    if (!uid) return { ok: false, reason: 'missing_uid' };
    if (!getApps().length) return { ok: false, reason: 'firebase_not_initialized' };
    if (!vapidKey || typeof vapidKey !== 'string' || !vapidKey.trim()) return { ok: false, reason: 'missing_vapid_key' };

    const supported = await isSupported();
    if (!supported) return { ok: false, reason: 'messaging_not_supported' };

    const permission = await requestNotificationPermission();
    if (permission !== 'granted') return { ok: false, reason: 'permission_denied' };

    const messaging = getMessaging();
    const swReg = 'serviceWorker' in navigator ? await navigator.serviceWorker.ready : undefined;
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: swReg });
    if (!token) return { ok: false, reason: 'no_token' };

    const res = await fetch(`${API_URL}/notifications/register-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': uid
      },
      body: JSON.stringify({ token, platform: 'web' })
    });

    if (!res.ok) {
      const msg = await res.text().catch(() => 'register_failed');
      return { ok: false, reason: msg };
    }

    return { ok: true, token };
  } catch (e: any) {
    return { ok: false, reason: e?.message || 'unknown_error' };
  }
}
