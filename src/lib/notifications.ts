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
      icon: "/favicon.ico",
      badge: "/favicon.ico",
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
