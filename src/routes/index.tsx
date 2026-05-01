import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ShieldCheck, Zap, Clock, ArrowRight, Lock, TrendingUp, Wallet, FileSignature } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "HSC Bank — Prêts en ligne instantanés" },
      { name: "description", content: "Financez vos projets avec confiance. Prêts personnels rapides de 1 000 € à 50 000 €. Décision en 24h, fonds sous 72h." },
      { property: "og:title", content: "HSC Bank — Prêts en ligne instantanés" },
      { property: "og:description", content: "Décision en 24h. Fonds sous 72h. 100% en ligne." },
    ],
  }),
});

function Landing() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden bg-hero">
        <div className="container relative z-10 mx-auto max-w-6xl px-4 py-24 text-center md:py-32">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
            Décision en moins de 24 heures
          </div>
          <h1 className="mx-auto mt-8 max-w-4xl font-serif text-5xl font-medium leading-[1.05] tracking-tight text-foreground md:text-7xl">
            Financer vos projets<br />
            <span className="text-gradient">avec confiance.</span>
          </h1>
          <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
            HSC Bank est la nouvelle génération de banque européenne offrant des prêts personnels rapides, transparents et sécurisés.
          </p>
          <div className="mt-12 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-14 rounded-full px-8 text-base shadow-glow">
              <Link to="/auth">
                Demander un prêt
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-14 rounded-full bg-card px-8 text-base">
              <Link to="/auth">J'ai déjà un compte</Link>
            </Button>
          </div>

          <div className="mx-auto mt-12 flex max-w-2xl flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2"><Lock className="h-4 w-4 text-accent" /> Données chiffrées</div>
            <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-accent" /> 100% sécurisé</div>
            <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-accent" /> Sans frais cachés</div>
          </div>
        </div>
      </section>

      {/* Value Props */}
      <section className="bg-card py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto grid max-w-5xl gap-12 md:grid-cols-3">
            {[
              { Icon: Zap, title: "Réponse en 24h", desc: "Notre équipe d'experts analyse votre dossier rapidement. Fini les semaines d'attente interminables." },
              { Icon: ShieldCheck, title: "100% Sécurisé", desc: "Vos données sont chiffrées de bout en bout. Nous respectons les standards bancaires les plus stricts." },
              { Icon: CheckCircle2, title: "Sans frais cachés", desc: "Le taux affiché est le taux appliqué. Aucune surprise sur vos mensualités." },
            ].map(({ Icon, title, desc }) => (
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

      {/* How it works — Timeline */}
      <section className="bg-background py-24">
        <div className="container mx-auto max-w-4xl px-4">
          <h2 className="text-center font-serif text-4xl font-medium text-primary md:text-5xl">Comment ça marche ?</h2>

          <div className="relative mt-16 space-y-8 before:absolute before:inset-0 before:ml-5 before:h-full before:w-0.5 before:-translate-x-px before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent md:before:mx-auto md:before:translate-x-0">
            {[
              { Icon: FileSignature, title: "Simulez votre prêt", desc: "Choisissez le montant et la durée qui vous conviennent. Nous calculons immédiatement votre mensualité estimée." },
              { Icon: CheckCircle2, title: "Complétez votre dossier", desc: "Remplissez le formulaire en 5 minutes et téléchargez vos justificatifs (pièce d'identité, justificatif de domicile, fiches de paie)." },
              { Icon: ShieldCheck, title: "Signez votre contrat", desc: "Dès acceptation par notre équipe, signez votre contrat électroniquement en toute sécurité." },
              { Icon: Wallet, title: "Recevez vos fonds", desc: "Une fois le délai légal passé, les fonds sont disponibles dans votre portefeuille HSC Bank, prêts à être retirés." },
            ].map((step, i) => (
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

      {/* Partner banks */}
      <section className="border-t border-border bg-surface py-20">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Nos banques partenaires</p>
            <h2 className="mt-4 font-serif text-3xl font-medium text-foreground md:text-4xl">Un réseau bancaire de confiance</h2>
            <p className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground">
              Nous collaborons avec les principales institutions financières européennes pour vous garantir des transferts rapides et sécurisés.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3 lg:grid-cols-6">
            {[
              "BNP Paribas", "Société Générale", "Crédit Agricole", "ING", "Revolut", "N26",
              "Boursorama", "LCL", "Caisse d'Épargne", "Crédit Mutuel", "Deutsche Bank", "Santander",
            ].map((bank) => (
              <div
                key={bank}
                className="flex items-center justify-center bg-card px-4 py-8 text-center text-sm font-semibold text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
              >
                {bank}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust CTA */}
      <section className="bg-gradient-wallet py-20 text-center text-white">
        <div className="container mx-auto px-4">
          <h2 className="font-serif text-3xl font-medium md:text-5xl">Prêt à concrétiser vos projets ?</h2>
          <p className="mx-auto mt-4 max-w-xl text-white/70">
            Créez votre compte et déposez votre première demande en quelques minutes.
          </p>
          <Button asChild size="lg" variant="secondary" className="mt-8 h-14 rounded-full bg-white px-8 text-base font-semibold text-primary hover:bg-white/90">
            <Link to="/auth">
              Commencer ma demande
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border bg-card py-10 text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} HSC Bank. Tous droits réservés.</p>
        <p className="mt-2 text-xs">Un crédit vous engage et doit être remboursé. Vérifiez vos capacités de remboursement avant de vous engager.</p>
      </footer>
    </div>
  );
}
