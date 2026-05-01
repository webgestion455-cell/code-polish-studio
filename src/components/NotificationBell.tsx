import { useEffect, useState } from "react";
import { Bell, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ensureBrowserPermission, showBrowserNotification, type AppNotification } from "@/lib/notifications";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

export function NotificationBell() {
  const { user } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    void ensureBrowserPermission();
    void load();
    const channel = supabase
      .channel(`notif-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n = payload.new as AppNotification;
          setItems((prev) => [n, ...prev].slice(0, 50));
          showBrowserNotification(n);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function load() {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);
    if (data) setItems(data as AppNotification[]);
  }

  async function markAllRead() {
    if (!user) return;
    await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  if (!user) return null;
  const unread = items.filter((n) => !n.read).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative h-9 w-9">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-semibold">Notifications</span>
          {unread > 0 && (
            <button onClick={markAllRead} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              <Check className="h-3.5 w-3.5" /> Tout lire
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">Aucune notification</div>
          ) : (
            items.map((n) => (
              <a
                key={n.id}
                href={n.link ?? "#"}
                onClick={() => setOpen(false)}
                className={`block border-b border-border/50 px-4 py-3 text-sm transition-colors hover:bg-secondary ${n.read ? "" : "bg-primary/5"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium">{n.title}</span>
                  {!n.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{n.message}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: fr })}
                </p>
              </a>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
