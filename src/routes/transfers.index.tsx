import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import {
  ArrowUpRight,
  ArrowRight,
  Send,
  Wallet,
  Lock,
  CheckCircle2,
  Loader2,
  XCircle,
} from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/loan-helpers";

export const Route = createFileRoute("/transfers/")({
  component: TransfersIndex,
  head: () => ({ meta: [{ title: "Mes virements — HSBC BANK" }] }),
});

interface Withdrawal {
  id: string;
  loan_id: string;
  amount: number;
  beneficiary: string;
  iban: string;
  bank_name: string;
  reference: string | null;
  status: string;
  progress: number;
  current_step: number;
  created_at: string;
  processed_at: string | null;
  transfer_kind?: string;
}

function TransfersIndex() {
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [list, setList] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "blocked" | "done">("all");

  function statusInfo(w: Withdrawal) {
    if (w.status === "envoye" || w.current_step >= 3) {
      return { label: t("transfersPage.labelValidated"), icon: CheckCircle2, cls: "bg-success/15 text-success", isProcessing: false };
    }
    if (w.status === "rejete") {
      return { label: t("transfersPage.labelRejected"), icon: XCircle, cls: "bg-destructive/15 text-destructive", isProcessing: false };
    }
    const targets = [63, 88, 100];
    const target = targets[w.current_step] ?? 100;
    if (w.progress >= target && w.current_step < 3) {
      return { label: t("transfersPage.labelCompliance"), icon: Lock, cls: "bg-warning/15 text-warning", isProcessing: false };
    }
    return { label: t("transfersPage.labelProcessing"), icon: Loader2, cls: "bg-info/15 text-info", isProcessing: true };
  }

  useEffect(() => {
    if (!user) return;
    void load();
    const ch = supabase
      .channel("transfers-list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "withdrawals", filter: `user_id=eq.${user.id}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("withdrawals")
      .select("*")
      .order("created_at", { ascending: false });
    setList((data as Withdrawal[]) ?? []);
    setLoading(false);
  }

  if (authLoading || !user) {
    return (
      <div className="flex h-96 items-center justify-center text-muted-foreground">{t("transfersPage.loading")}</div>
    );
  }

  const filtered = list.filter((w) => {
    const targets = [63, 88, 100];
    const tgt = targets[w.current_step] ?? 100;
    const blocked = w.progress >= tgt && w.current_step < 3 && w.status === "en_traitement";
    if (filter === "all") return true;
    if (filter === "done") return w.status === "envoye" || w.current_step >= 3;
    if (filter === "blocked") return blocked;
    if (filter === "active") return w.status === "en_traitement" && w.current_step < 3 && !blocked;
    return true;
  });

  const filters: Array<{ k: typeof filter; l: string }> = [
    { k: "all", l: t("transfersPage.filterAll") },
    { k: "active", l: t("transfersPage.filterActive") },
    { k: "blocked", l: t("transfersPage.filterBlocked") },
    { k: "done", l: t("transfersPage.filterDone") },
  ];

  return (
    <div className="container mx-auto max-w-5xl space-y-6 px-4 pb-28 pt-8 sm:px-6 lg:px-8 lg:pb-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{t("transfersPage.bankingSpace")}</p>
          <h1 className="mt-0.5 font-serif text-3xl font-medium tracking-tight md:text-4xl">
            {t("transfersPage.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("transfersPage.subtitle")}
          </p>
        </div>
        <Button asChild className="shadow-glow">
          <Link to="/dashboard">
            <Send className="mr-2 h-4 w-4" /> {t("transfersPage.newTransfer")}
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.k}
            onClick={() => setFilter(f.k)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              filter === f.k
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:bg-secondary"
            }`}
          >
            {f.l}
          </button>
        ))}
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">{t("transfersPage.loading")}</CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Empty className="border bg-card shadow-card">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="bg-accent/10 text-accent">
              <Wallet className="h-6 w-6" />
            </EmptyMedia>
            <EmptyTitle>{t("transfersPage.empty")}</EmptyTitle>
            <EmptyDescription>
              {t("transfersPage.emptyDesc")}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-3">
          {filtered.map((w) => {
            const s = statusInfo(w);
            const Icon = s.icon;
            return (
              <Card
                key={w.id}
                className="cursor-pointer transition hover:border-accent/40 hover:shadow-elevated"
                onClick={() =>
                  navigate({ to: "/transfers/$transferId", params: { transferId: w.id } })
                }
              >
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xl font-semibold tabular-nums">
                          {formatCurrency(Number(w.amount))}
                        </span>
                        <Badge className={`${s.cls} border-0 gap-1`}>
                          <Icon className={`h-3 w-3 ${s.isProcessing ? "animate-spin" : ""}`} />
                          {s.label}
                        </Badge>
                      </div>
                      <p className="mt-1 truncate text-sm">
                        <span className="text-muted-foreground">{t("transfersPage.beneficiaryLabel")} </span>
                        <span className="font-medium">{w.beneficiary}</span>
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {w.bank_name} · {w.iban}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("transfersPage.issuedOn", { date: formatDateTime(w.created_at) })}
                        {w.reference ? t("transfersPage.refSuffix", { ref: w.reference }) : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <ArrowUpRight className="h-5 w-5 text-muted-foreground" />
                      <Button variant="outline" size="sm">
                        {t("transfersPage.detailsBtn")} <ArrowRight className="ml-1.5 h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full bg-gradient-accent transition-all duration-500"
                      style={{ width: `${Math.max(2, Math.min(100, w.progress || 0))}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
