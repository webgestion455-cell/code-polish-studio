import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { LogOut, ShieldCheck, LayoutDashboard, Settings as SettingsIcon, Mail } from "lucide-react";
import hsbcLogo from "@/assets/hsbc-logo.png";

export function AppHeader() {
  const { t } = useTranslation();
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
          <img
            src={hsbcLogo}
            alt="HSBC BANK"
            width={36}
            height={36}
            className="h-9 w-9 rounded-md object-contain bg-white p-0.5 shadow-sm"
          />
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
              {t("header.myLoans")}
            </Link>
            <Link to="/loans/new" className={`transition-colors hover:text-foreground ${location.pathname === "/loans/new" ? "text-foreground" : "text-muted-foreground"}`}>
              {t("header.newLoan")}
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
                    {t("header.admin")}
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
                    {t("header.dashboard")}
                  </Link>
                </Button>
              )}
              <NotificationBell />
              {!isAdminArea && (
                <Button asChild variant="ghost" size="icon" aria-label="Contact" className="h-9 w-9">
                  <Link to="/contact">
                    <Mail className="h-4 w-4" />
                  </Link>
                </Button>
              )}
              <Button asChild variant="ghost" size="icon" aria-label={t("header.settings")} className="h-9 w-9">
                <Link to="/settings">
                  <SettingsIcon className="h-4 w-4" />
                </Link>
              </Button>
              <LanguageSwitcher />
              <ThemeToggle />
              <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label={t("header.signOut")} className="h-9 w-9">
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <LanguageSwitcher />
              <ThemeToggle />
              {!onApp && (
                <>
                  <Button asChild variant="ghost" size="sm">
                    <Link to="/auth">{t("header.signIn")}</Link>
                  </Button>
                  <Button asChild size="sm" className="shadow-glow">
                    <Link to="/auth">{t("header.newLoan")}</Link>
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
