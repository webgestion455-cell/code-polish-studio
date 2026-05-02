import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";
import { LogOut, ShieldCheck, LayoutDashboard, Settings as SettingsIcon } from "lucide-react";

export function AppHeader() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const { location } = useRouterState();

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/" });
  }

  const onApp =
    location.pathname.startsWith("/dashboard") ||
    location.pathname.startsWith("/admin") ||
    location.pathname.startsWith("/loans");

  const isAdminArea = location.pathname.startsWith("/admin");

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-primary shadow-md shadow-accent/30">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 17L9 11L13 15L21 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M15 7H21V13" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
          <div className="flex flex-col leading-tight">
            <span className="font-serif text-lg font-medium tracking-tight">HSBC BANK</span>
            {isAdminArea && role === "admin" && (
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">Espace sécurisé · Admin</span>
            )}
          </div>
        </Link>

        {user && !isAdminArea && (
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <Link to="/dashboard" className={`transition-colors hover:text-foreground ${location.pathname === "/dashboard" ? "text-foreground" : "text-muted-foreground"}`}>
              Mes prêts
            </Link>
            <Link to="/loans/new" className={`transition-colors hover:text-foreground ${location.pathname === "/loans/new" ? "text-foreground" : "text-muted-foreground"}`}>
              Demander un prêt
            </Link>
          </nav>
        )}

        <nav className="flex items-center gap-1.5">
          {user ? (
            <>
              {isAdminArea && role === "admin" && (
                <Button asChild variant="secondary" size="sm" className="hidden sm:inline-flex">
                  <Link to="/admin">
                    <ShieldCheck className="mr-1.5 h-4 w-4" />
                    Admin
                  </Link>
                </Button>
              )}
              {!isAdminArea && (
                <Button
                  asChild
                  variant={location.pathname === "/dashboard" ? "secondary" : "ghost"}
                  size="sm"
                  className="hidden sm:inline-flex"
                >
                  <Link to="/dashboard">
                    <LayoutDashboard className="mr-1.5 h-4 w-4" />
                    Dashboard
                  </Link>
                </Button>
              )}
              <NotificationBell />
              <Button asChild variant="ghost" size="icon" aria-label="Paramètres" className="h-9 w-9">
                <Link to="/settings">
                  <SettingsIcon className="h-4 w-4" />
                </Link>
              </Button>
              <ThemeToggle />
              <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Se déconnecter" className="h-9 w-9">
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <ThemeToggle />
              {!onApp && (
                <>
                  <Button asChild variant="ghost" size="sm">
                    <Link to="/auth">Connexion</Link>
                  </Button>
                  <Button asChild size="sm" className="shadow-glow">
                    <Link to="/auth">Demander un prêt</Link>
                  </Button>
                </>
              )}
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
