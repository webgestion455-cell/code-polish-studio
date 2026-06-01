import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ShieldCheck, Zap, Clock, ArrowRight, Lock, TrendingUp, Wallet, FileSignature } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "HSBC BANK — Prêts en ligne instantanés" },
      { name: "description", content: "Financez vos projets avec confiance. Prêts personnels rapides de 1 000 € à 50 000 €. Décision en 24h, fonds sous 72h." },
      { property: "og:title", content: "HSBC BANK — Prêts en ligne instantanés" },
      { property: "og:description", content: "Décision en 24h. Fonds sous 72h. 100% en ligne." },
    ],
  }),
});

function Landing() {
  const { t } = useTranslation();
  const valueProps = [
    { Icon: Zap, title: t("landing.vp1Title"), desc: t("landing.vp1Desc") },
    { Icon: ShieldCheck, title: t("landing.vp2Title"), desc: t("landing.vp2Desc") },
    { Icon: CheckCircle2, title: t("landing.vp3Title"), desc: t("landing.vp3Desc") },
  ];
  const steps = [
    { Icon: FileSignature, title: t("landing.s1Title"), desc: t("landing.s1Desc") },
    { Icon: CheckCircle2, title: t("landing.s2Title"), desc: t("landing.s2Desc") },
    { Icon: ShieldCheck, title: t("landing.s3Title"), desc: t("landing.s3Desc") },
    { Icon: Wallet, title: t("landing.s4Title"), desc: t("landing.s4Desc") },
  ];
  const banks = [
    "BNP Paribas", "Société Générale", "Crédit Agricole", "ING", "Revolut", "N26",
    "Boursorama", "LCL", "Caisse d'Épargne", "Crédit Mutuel", "Deutsche Bank", "Santander",
  ];
  return (
    <div className="flex flex-col">
      <section className="relative overflow-hidden bg-hero">
        <div className="container relative z-10 mx-auto max-w-6xl px-4 py-24 text-center md:py-32">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
            {t("landing.decisionBadge")}
          </div>
          <h1 className="mx-auto mt-8 max-w-4xl font-serif text-5xl font-medium leading-[1.05] tracking-tight text-foreground md:text-7xl">
            {t("landing.heroTitle1")}<br />
            <span className="text-gradient">{t("landing.heroTitle2")}</span>
          </h1>
          <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
            {t("landing.heroDesc")}
          </p>
          <div className="mt-12 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-14 rounded-full px-8 text-base shadow-glow">
              <Link to="/auth">
                {t("landing.applyNow")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-14 rounded-full bg-card px-8 text-base">
              <Link to="/auth">{t("landing.haveAccount")}</Link>
            </Button>
          </div>
          <div className="mx-auto mt-12 flex max-w-2xl flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2"><Lock className="h-4 w-4 text-accent" /> {t("landing.encrypted")}</div>
            <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-accent" /> {t("landing.secure100")}</div>
            <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-accent" /> {t("landing.noHidden")}</div>
          </div>
        </div>
      </section>

      <section className="bg-card py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto grid max-w-5xl gap-12 md:grid-cols-3">
            {valueProps.map(({ Icon, title, desc }) => (
              <div key={title} className="space-y-4 text-center">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                  <Icon size={32} />
                </div>
                <h3 className="font-serif text-xl font-medium text-foreground">{title}</h3>
                <p className="leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-background py-24">
        <div className="container mx-auto max-w-4xl px-4">
          <h2 className="text-center font-serif text-4xl font-medium text-primary md:text-5xl">{t("landing.howTitle")}</h2>
          <div className="relative mt-16 space-y-8 before:absolute before:inset-0 before:ml-5 before:h-full before:w-0.5 before:-translate-x-px before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent md:before:mx-auto md:before:translate-x-0">
            {steps.map((step, i) => (
              <div key={i} className="group relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse">
                <div className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-4 border-background bg-primary font-bold text-primary-foreground shadow-md md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                  {i + 1}
                </div>
                <div className="w-[calc(100%-3rem)] rounded-2xl border border-border bg-card p-6 shadow-card transition-colors hover:border-accent/40 md:w-[calc(50%-2.5rem)]">
                  <div className="mb-2 flex items-center gap-2">
                    <step.Icon className="h-4 w-4 text-accent" />
                    <h4 className="font-semibold">{step.title}</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-surface py-20">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{t("landing.partners")}</p>
            <h2 className="mt-4 font-serif text-3xl font-medium text-foreground md:text-4xl">{t("landing.partnersTitle")}</h2>
            <p className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground">{t("landing.partnersDesc")}</p>
          </div>
          <div className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3 lg:grid-cols-6">
            {banks.map((bank) => (
              <div key={bank} className="flex items-center justify-center bg-card px-4 py-8 text-center text-sm font-semibold text-muted-foreground transition-colors hover:bg-surface hover:text-foreground">
                {bank}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gradient-wallet py-20 text-center text-white">
        <div className="container mx-auto px-4">
          <h2 className="font-serif text-3xl font-medium md:text-5xl">{t("landing.ctaTitle")}</h2>
          <p className="mx-auto mt-4 max-w-xl text-white/70">{t("landing.ctaDesc")}</p>
          <Button asChild size="lg" variant="secondary" className="mt-8 h-14 rounded-full bg-white px-8 text-base font-semibold text-primary hover:bg-white/90">
            <Link to="/auth">
              {t("landing.ctaButton")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border bg-card">
        <div className="container mx-auto max-w-6xl px-4 py-14">
          <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2 space-y-4">
              <div className="font-serif text-2xl font-medium text-primary">HSBC BANK</div>
              <p className="text-sm text-muted-foreground max-w-sm">{t("footer.tagline")}</p>
              <div className="flex flex-wrap gap-3 pt-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-medium"><Lock className="h-3 w-3 text-accent" /> {t("footer.ssl")}</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-medium"><ShieldCheck className="h-3 w-3 text-accent" /> {t("footer.iban")}</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-medium"><CheckCircle2 className="h-3 w-3 text-accent" /> {t("footer.fdic")}</span>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-foreground">{t("footer.products")}</p>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li><Link to="/loans/new" className="hover:text-foreground">{t("footer.loans")}</Link></li>
                <li><Link to="/dashboard" className="hover:text-foreground">{t("footer.transfers")}</Link></li>
                <li><Link to="/dashboard" className="hover:text-foreground">{t("footer.accounts")}</Link></li>
                <li><Link to="/dashboard" className="hover:text-foreground">{t("footer.cards")}</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-foreground">{t("footer.aboutCol")}</p>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li><Link to="/" className="hover:text-foreground">{t("footer.about")}</Link></li>
                <li><Link to="/" className="hover:text-foreground">{t("footer.careers")}</Link></li>
                <li><Link to="/" className="hover:text-foreground">{t("footer.press")}</Link></li>
                <li><Link to="/" className="hover:text-foreground">{t("footer.blog")}</Link></li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-foreground">{t("footer.legalCol")}</p>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li><Link to="/" className="hover:text-foreground">{t("footer.legal")}</Link></li>
                <li><Link to="/" className="hover:text-foreground">{t("footer.privacy")}</Link></li>
                <li><Link to="/" className="hover:text-foreground">{t("footer.cookies")}</Link></li>
                <li><Link to="/" className="hover:text-foreground">{t("footer.terms")}</Link></li>
                <li><Link to="/" className="hover:text-foreground">{t("footer.gdpr")}</Link></li>
              </ul>
            </div>
          </div>

          <div className="mt-12 grid gap-4 border-t border-border pt-6 sm:grid-cols-2 sm:items-center">
            <div>
              <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} HSBC BANK. {t("footer.rights")}</p>
              <p className="mt-1 text-[11px] text-muted-foreground/80">{t("footer.regulated")}</p>
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground sm:justify-end">
              <Link to="/contact" className="hover:text-foreground">{t("footer.contactUs")}</Link>
              <Link to="/" className="hover:text-foreground">{t("footer.help")}</Link>
              <Link to="/" className="hover:text-foreground">{t("footer.security")}</Link>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
