import { useEffect } from "react";
import { Outlet, Link, createRootRoute, HeadContent, Scripts, useRouter } from "@tanstack/react-router";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";
import { App } from "@capacitor/app";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";
import { Toaster } from "@/components/ui/sonner";
import { AppHeader } from "@/components/AppHeader";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { BlockedAccountGuard } from "@/components/BlockedAccountGuard";
import { LiveChat } from "@/components/LiveChat";
import "@/i18n";
import { useLocation } from "@tanstack/react-router";

import i18n from "@/i18n";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  const t = (k: string) => i18n.t(k);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">{t("common.notFound")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("common.notFoundDesc")}</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("common.backHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}

// Inline script to set theme class BEFORE first paint (no FOUC) + sets <html lang> from saved i18n choice
const themeInitScript = `(function(){try{var k='lendly-theme';var t=localStorage.getItem(k);if(t!=='light'&&t!=='dark'){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.classList.toggle('dark',t==='dark');document.documentElement.style.colorScheme=t;var lng=localStorage.getItem('hsbc.lang');if(lng){document.documentElement.lang=lng.split('-')[0];}}catch(e){}})();`;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "HSBC BANK — Prêts en ligne instantanés" },
      { name: "description", content: "Demandez votre prêt en ligne en 3 minutes. Décision rapide, fonds disponibles sous 72h." },
      { name: "author", content: "HSBC BANK" },
      { name: "theme-color", content: "#0a0a0a" },
      // PWA / iOS standalone
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "HSBC BANK" },
      { name: "application-name", content: "HSBC BANK" },
      { property: "og:title", content: "HSBC BANK — Prêts en ligne instantanés" },
      { property: "og:description", content: "Demandez votre prêt en ligne en 3 minutes. Décision rapide, fonds disponibles sous 72h." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "index, follow, max-image-preview:large" },
      { name: "referrer", content: "strict-origin-when-cross-origin" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", type: "image/png", href: "/icon-512.png" },
      { rel: "apple-touch-icon", href: "/icon-512.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..700&family=Inter:wght@400;500;600;700;800&display=swap" },
    ],
    scripts: [{ children: themeInitScript }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {

  const location = useLocation();
  const router = useRouter();

  const hideLayout = [
    "/auth",
    "/mobile-home",
  ].includes(location.pathname);

  useEffect(() => {
  if (Capacitor.isNativePlatform()) {

    StatusBar.setOverlaysWebView({ overlay: false });

    StatusBar.setStyle({ style: Style.Dark });

    StatusBar.setBackgroundColor({ color: "#000000" });

    SplashScreen.hide();

    // First-launch onboarding for the APK only — never affects the web site.
    try {
      const seen = localStorage.getItem("hsbc.mobileOnboarding.seen");
      if (!seen && location.pathname === "/") {
        router.navigate({ to: "/mobile-home", replace: true });
      }
    } catch {
      /* ignore */
    }

    App.addListener("backButton", ({ canGoBack }: { canGoBack: boolean }) => {
      if (!canGoBack) {
        App.exitApp();
      } else {
        window.history.back();
      }
    });
  }
}, [location.pathname, router]);

  return (
    <ThemeProvider>
      <AuthProvider>
        <div className="min-h-screen flex flex-col">
          {!hideLayout && <AppHeader />}

          <main className="flex-1">
            <BlockedAccountGuard>
              <Outlet />
            </BlockedAccountGuard>
          </main>

          {!hideLayout && <MobileBottomNav />}
        </div>

        {!hideLayout && <LiveChat />}
        <Toaster richColors closeButton />
      </AuthProvider>
    </ThemeProvider>
  );
}
