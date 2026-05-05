import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
// Input/Label moved into TransferDialog
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty";
import { StatusBadge } from "@/components/StatusBadge";
import { TransferDialog } from "@/components/TransferDialog";
import { formatCurrency, formatDate, formatDateTime, STATUS_DESCRIPTIONS, STATUS_PROGRESS, type LoanStatus } from "@/lib/loan-helpers";
import {
  Plus, Wallet, ArrowUpRight, FileText, History,
  Eye, EyeOff, Sparkles, Send, TrendingUp, ArrowRight, Mail,
} from "lucide-react";
import { toast } from "sonner";
import { useInactivityLogout } from "@/lib/use-inactivity";
// notifyAllAdmins handled in TransferDialog

export const Route = createFileRoute("/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Mon tableau de bord — HSBC BANK" }] }),
});

interface Loan {
  id: string;
  amount: number;
  duration_months: number;
  status: LoanStatus;
  created_at: string;
  funds_available_at: string | null;
  withdrawn: boolean;
  disbursed_amount: number;
}

interface Withdrawal {
  id: string;
  loan_id: string;
  amount: number;
  beneficiary: string;
  iban: string;
  bank_name: string;
  reference: string | null;
  status: string;
  created_at: string;
  processed_at: string | null;
}

const STATUS_PILL: Record<string, string> = {
  en_traitement: "bg-warning/15 text-warning",
  envoye: "bg-success/15 text-success",
  rejete: "bg-destructive/15 text-destructive",
};

const STATUS_LABEL: Record<string, string> = {
  en_traitement: "En traitement",
  envoye: "Envoyé",
  rejete: "Rejeté",
};

function Dashboard() {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [hideBalance, setHideBalance] = useState(false);
  const [withdrawLoanId, setWithdrawLoanId] = useState<string | null>(null);
  // withdrawing state moved into TransferDialog
  const [profileName, setProfileName] = useState<string>("");

  useInactivityLogout(async () => {
    await signOut();
    toast.warning("Session expirée pour inactivité");
    navigate({ to: "/auth" });
  });

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    void load();
    const interval = setInterval(() => void simulateProgress(), 30_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function load() {
    if (!user) return;
    setLoading(true);
    const [lRes, wRes, pRes] = await Promise.all([
      supabase.from("loans").select("id, amount, duration_months, status, created_at, funds_available_at, withdrawn, disbursed_amount").order("created_at", { ascending: false }),
      supabase.from("withdrawals").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle(),
    ]);
    if (lRes.error) toast.error("Erreur de chargement");
    else {
      setLoans(lRes.data as Loan[]);
      setWithdrawals((wRes.data as Withdrawal[]) ?? []);
      setProfileName(pRes.data?.full_name ?? "");
    }
    setLoading(false);
  }

  async function simulateProgress() {
    if (!user) return;
    const { data } = await supabase
      .from("loans")
      .select("id, status, updated_at")
      .eq("user_id", user.id)
      .eq("status", "en_traitement");
    if (!data) return;
    for (const l of data) {
      const ageMs = Date.now() - new Date(l.updated_at).getTime();
      if (ageMs > 30_000) {
        await supabase.from("loans").update({ status: "fonds_disponibles", funds_available_at: new Date().toISOString() }).eq("id", l.id);
      }
    }
    void load();
  }

  const withdrawLoan = loans.find((l) => l.id === withdrawLoanId) ?? null;
  // remaining balance computed inside TransferDialog
  const totalAvailable = loans
    .filter((l) => l.status === "fonds_disponibles")
    .reduce((s, l) => s + (Number(l.amount) - Number(l.disbursed_amount ?? 0)), 0);
  const totalRequested = loans.reduce((s, l) => s + Number(l.amount), 0);
  const totalWithdrawn = loans.reduce((s, l) => s + Number(l.disbursed_amount ?? 0), 0);
  const activeLoanCount = loans.filter((l) => l.status !== "refuse").length;
  const recentWithdrawals = withdrawals.slice(0, 5);
  const firstName = profileName.split(" ")[0] || user?.email?.split("@")[0] || "";

  // Virements gérés via TransferDialog

  if (authLoading || !user) {
    return <div className="flex items-center justify-center h-96"><div className="text-muted-foreground">Chargement...</div></div>;
  }

  return (
    <div className="container mx-auto max-w-6xl space-y-8 px-4 pb-28 pt-8 sm:px-6 lg:px-8 lg:pb-10">
      {/* Greeting */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-muted-foreground">Bienvenue{firstName ? `, ${firstName}` : ""}</p>
          <h1 className="mt-0.5 font-serif text-3xl font-medium tracking-tight md:text-4xl">Mon tableau de bord</h1>
        </div>
        <Button asChild size="lg" className="shadow-glow">
          <Link to="/loans/new">
            <Plus className="mr-2 h-4 w-4" />
            Nouvelle demande
          </Link>
        </Button>
      </div>

      {/* Wallet Hero */}
      <Card className="relative overflow-hidden border-0 bg-gradient-wallet text-white shadow-elevated">
        <div aria-hidden className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-accent/30 blur-3xl" />
        <div aria-hidden className="absolute -bottom-32 -left-10 h-72 w-72 rounded-full bg-success/20 blur-3xl" />
        <CardContent className="relative p-8 md:p-10">
          <div className="mb-2 flex items-start justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-white/70">
              <Wallet className="h-4 w-4" /> Solde total disponible
            </div>
            <button
              onClick={() => setHideBalance(!hideBalance)}
              className="rounded-md p-1 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
              aria-label={hideBalance ? "Afficher le solde" : "Masquer le solde"}
            >
              {hideBalance ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <div className="font-serif text-5xl font-medium tracking-tight tabular-nums md:text-6xl">
            {hideBalance ? "•••••• €" : formatCurrency(totalAvailable)}
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-sm text-white/70">
            <span>sur {formatCurrency(totalRequested)} financés</span>
            {totalWithdrawn > 0 && (
              <>
                <span className="opacity-30">•</span>
                <span>{formatCurrency(totalWithdrawn)} retirés</span>
              </>
            )}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            {totalAvailable > 0 && (
              <Button
                size="lg"
                onClick={() => {
                  const target = loans.find((l) => l.status === "fonds_disponibles" && Number(l.amount) - Number(l.disbursed_amount ?? 0) > 0);
                  if (target) setWithdrawLoanId(target.id);
                }}
                className="bg-white font-semibold text-primary shadow-md hover:bg-white/90"
              >
                <Send className="mr-2 h-4 w-4" />
                Effectuer un virement
              </Button>
            )}
            <Button asChild size="lg" variant="ghost" className="border border-white/20 text-white hover:bg-white/10">
              <Link to="/loans/new">
                <Plus className="mr-2 h-4 w-4" />
                Nouveau prêt
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="border border-white/20 text-white hover:bg-white/10">
              <Link to="/contact">
                <Mail className="mr-2 h-4 w-4" />
                Contacter le service client
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard icon={<FileText className="h-5 w-5" />} label="Prêts actifs" value={activeLoanCount.toString()} tone="info" />
        <StatCard icon={<TrendingUp className="h-5 w-5" />} label="Total financé" value={formatCurrency(totalRequested)} tone="primary" />
        <StatCard icon={<ArrowUpRight className="h-5 w-5" />} label="Virements" value={withdrawals.length.toString()} tone="success" />
      </div>

      {/* Loans + Activity */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-xl font-medium">Mes prêts</h2>
            {loans.length > 0 && (
              <Button variant="ghost" size="sm" asChild>
                <Link to="/loans/new">+ Nouveau</Link>
              </Button>
            )}
          </div>

          {loading ? (
            <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground shadow-card">Chargement...</div>
          ) : loans.length === 0 ? (
            <Empty className="border bg-card shadow-card">
              <EmptyHeader>
                <EmptyMedia variant="icon" className="bg-accent/10 text-accent">
                  <Sparkles className="h-6 w-6" />
                </EmptyMedia>
                <EmptyTitle>Commencez votre première demande</EmptyTitle>
                <EmptyDescription>
                  Financez vos projets en quelques minutes : auto, travaux, trésorerie ou tout autre besoin.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button asChild className="shadow-glow">
                  <Link to="/loans/new">Faire une demande</Link>
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="space-y-3">
              {loans.map((loan) => {
                const remaining = Number(loan.amount) - Number(loan.disbursed_amount ?? 0);
                const canWithdraw = loan.status === "fonds_disponibles" && remaining > 0;
                return (
                  <Card key={loan.id} className="transition-all hover:border-accent/40 hover:shadow-elevated">
                    <CardContent className="p-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-2xl font-semibold tabular-nums">{formatCurrency(Number(loan.amount))}</span>
                            <StatusBadge status={loan.status} />
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {loan.duration_months} mois · Demande du {formatDate(loan.created_at)}
                          </p>
                          {Number(loan.disbursed_amount ?? 0) > 0 && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Décaissé : {formatCurrency(Number(loan.disbursed_amount))} · Restant : {formatCurrency(remaining)}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {canWithdraw && (
                            <Button onClick={() => setWithdrawLoanId(loan.id)} size="sm" className="shadow-glow">
                              <ArrowUpRight className="mr-1.5 h-4 w-4" /> Retirer
                            </Button>
                          )}
                          <Button asChild variant="outline" size="sm">
                            <Link to="/loans/$loanId" params={{ loanId: loan.id }}>
                              Détails <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                      <div className="mt-4">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                          <div
                            className={`h-full transition-all duration-500 ${loan.status === "refuse" ? "bg-destructive" : "bg-gradient-accent"}`}
                            style={{ width: `${STATUS_PROGRESS[loan.status]}%` }}
                          />
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">{STATUS_DESCRIPTIONS[loan.status]}</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Activity sidebar */}
        <div className="space-y-4">
          <h2 className="font-serif text-xl font-medium flex items-center gap-2">
            <History className="h-4 w-4" /> Activité récente
          </h2>
          <Card>
            <CardContent className="p-0">
              {recentWithdrawals.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  <Wallet className="mx-auto mb-2 h-6 w-6 opacity-40" />
                  Aucun virement pour le moment
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {recentWithdrawals.map((w) => (
                    <li key={w.id} className="hover-elevate flex items-start gap-3 p-4">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${STATUS_PILL[w.status] ?? "bg-secondary"}`}>
                        <ArrowUpRight className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate text-sm font-medium">{w.beneficiary}</p>
                          <span className="shrink-0 text-sm font-semibold tabular-nums">{formatCurrency(Number(w.amount))}</span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 flex-wrap">
                          <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${STATUS_PILL[w.status] ?? "bg-secondary"}`}>
                            {STATUS_LABEL[w.status] ?? w.status}
                          </span>
                          <span className="text-xs text-muted-foreground">{formatDateTime(w.created_at)}</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Transfer dialog (instantané/classique riche) */}
      <TransferDialog
        open={!!withdrawLoan}
        onClose={() => setWithdrawLoanId(null)}
        initialLoanId={withdrawLoanId}
        loans={loans.map((l) => ({ id: l.id, amount: Number(l.amount), disbursed_amount: Number(l.disbursed_amount ?? 0), status: l.status }))}
        defaultBeneficiary={profileName}
        onSuccess={() => void load()}
      />
    </div>
  );
}

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: "info" | "primary" | "success" }) {
  const TONE_BG: Record<string, string> = {
    info: "bg-info/10 text-info",
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
  };
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${TONE_BG[tone]}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="truncate text-xl font-semibold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
