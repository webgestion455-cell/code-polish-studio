import { Link, useRouterState } from "@tanstack/react-router";
import { FilePlus2, Home, Settings as SettingsIcon, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export function MobileBottomNav() {
  const { user, role } = useAuth();
  const { location } = useRouterState();
  if (!user) return null;

  const isAdminArea = location.pathname.startsWith("/admin");
  const items = isAdminArea && role === "admin"
    ? [
        { to: "/admin" as const, label: "Admin", icon: ShieldCheck },
        { to: "/settings" as const, label: "Paramètres", icon: SettingsIcon },
      ]
    : [
        { to: "/dashboard" as const, label: "Accueil", icon: Home },
        { to: "/loans/new" as const, label: "Demande", icon: FilePlus2 },
        { to: "/settings" as const, label: "Paramètres", icon: SettingsIcon },
      ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur-xl sm:hidden"
      aria-label="Navigation principale"
    >
      <div className={`mx-auto grid max-w-md gap-1 ${items.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
        {items.map((item) => {
          const Icon = item.icon;
          const active = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] font-medium transition-colors ${
                active ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? "scale-110" : ""} transition-transform`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
