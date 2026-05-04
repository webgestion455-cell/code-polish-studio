import { supabase } from "@/integrations/supabase/client";

export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  link: string | null;
  category: string;
  read: boolean;
  created_at: string;
}

export async function notifyUser(params: {
  userId: string;
  title: string;
  message: string;
  link?: string;
  category?: "info" | "success" | "warning" | "danger";
}) {
  await supabase.from("notifications").insert({
    user_id: params.userId,
    title: params.title,
    message: params.message,
    link: params.link ?? null,
    category: params.category ?? "info",
  });
}

export async function notifyAllAdmins(params: {
  title: string;
  message: string;
  link?: string;
  category?: "info" | "success" | "warning" | "danger";
}) {
  const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
  if (!admins) return;
  await Promise.all(
    admins.map((a) =>
      notifyUser({
        userId: a.user_id,
        title: params.title,
        message: params.message,
        link: params.link,
        category: params.category,
      }),
    ),
  );
}

export function ensureBrowserPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return Promise.resolve("unsupported" as const);
  if (Notification.permission === "granted") return Promise.resolve("granted" as const);
  if (Notification.permission === "denied") return Promise.resolve("denied" as const);
  return Notification.requestPermission().then((p) => p as "granted" | "denied" | "default");
}

export function showBrowserNotification(n: Pick<AppNotification, "title" | "message" | "link">) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    const notif = new Notification(n.title, {
      body: n.message,
      icon: "/icon-512.png",
      badge: "/icon-512.png",
      tag: n.title,
    });
    if (n.link) {
      notif.onclick = () => {
        window.focus();
        window.location.href = n.link!;
      };
    }
  } catch {
    // ignore
  }
}

/**
 * Joue un son de notification bancaire discret (sinusoïdal généré via WebAudio,
 * aucune dépendance externe, fonctionne immédiatement après une 1re interaction).
 */
let _audioCtx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const W = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  const Ctor = W.AudioContext ?? W.webkitAudioContext;
  if (!Ctor) return null;
  if (!_audioCtx) _audioCtx = new Ctor();
  return _audioCtx;
}

export function playNotificationSound() {
  try {
    const ctx = getCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();
    const now = ctx.currentTime;

    // Deux notes courtes type "ding-dong" bancaire (E5 -> A5)
    [
      { f: 659.25, t: 0 },
      { f: 880.0, t: 0.14 },
    ].forEach(({ f, t }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.0001, now + t);
      gain.gain.exponentialRampToValueAtTime(0.18, now + t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + t);
      osc.stop(now + t + 0.4);
    });
  } catch {
    // ignore
  }
}
