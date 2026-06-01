import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Download,
  History,
  Lock,
  Loader2,
  XCircle,
  ShieldCheck,
  Printer,
} from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/loan-helpers";
import { TransferProcessPanel } from "@/components/TransferProcessPanel";

export const Route = createFileRoute("/transfers/$transferId")({
  component: TransferDetail,
  head: () => ({ meta: [{ title: "Détail du virement — HSBC BANK" }] }),
});

interface Withdrawal {
  id: string;
  loan_id: string;
  amount: number;
  beneficiary: string;
  iban: string;
  bic?: string | null;
  bank_name: string;
  reference: string | null;
  status: string;
  progress: number;
  current_step: number;
  step_started_at: string;
  created_at: string;
  processed_at: string | null;
  transfer_kind?: string;
  admin_notes?: string | null;
}

function TransferDetail() {
  const { t } = useTranslation();
  const { transferId } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [w, setW] = useState<Withdrawal | null>(null);
  const [loading, setLoading] = useState(true);

  function statusBadge(w: Withdrawal | null) {
    if (!w) return null;
    if (w.status === "envoye" || w.current_step >= 3) {
      return (
        <Badge className="bg-success/15 text-success border-0 gap-1">
          <CheckCircle2 className="h-3 w-3" /> {t("transferDetail.validated")}
        </Badge>
      );
    }
    if (w.status === "rejete") {
      return (
        <Badge className="bg-destructive/15 text-destructive border-0 gap-1">
          <XCircle className="h-3 w-3" /> {t("transferDetail.rejected")}
        </Badge>
      );
    }
    const targets = [63, 88, 100];
    const tgt = targets[w.current_step] ?? 100;
    if (w.progress >= tgt && w.current_step < 3) {
      return (
        <Badge className="bg-warning/15 text-warning border-0 gap-1">
          <Lock className="h-3 w-3" /> {t("transferDetail.complianceCheck")}
        </Badge>
      );
    }
    return (
      <Badge className="bg-info/15 text-info border-0 gap-1">
        <Loader2 className="h-3 w-3 animate-spin" /> {t("transferDetail.bankProcessing")}
      </Badge>
    );
  }

  useEffect(() => {
    if (!user) return;
    void load();
    const ch = supabase
      .channel(`wd-detail-${transferId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "withdrawals", filter: `id=eq.${transferId}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, transferId]);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("withdrawals")
      .select("*")
      .eq("id", transferId)
      .maybeSingle();
    if (error || !data) {
      setW(null);
    } else {
      setW(data as Withdrawal);
    }
    setLoading(false);
  }

  if (authLoading || loading) {
    return (
      <div className="flex h-96 items-center justify-center text-muted-foreground">{t("transferDetail.loading")}</div>
    );
  }
  if (!w) {
    return (
      <div className="container mx-auto max-w-3xl space-y-4 px-4 pb-28 pt-8 lg:pb-10">
        <Button variant="ghost" onClick={() => navigate({ to: "/transfers" })}>
          <ArrowLeft className="mr-2 h-4 w-4" /> {t("transferDetail.back")}
        </Button>
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            {t("transferDetail.notFound")}
          </CardContent>
        </Card>
      </div>
    );
  }

  const isFinal = w.status === "envoye" || w.current_step >= 3;

  return (
    <div className="container mx-auto max-w-3xl space-y-6 px-4 pb-28 pt-8 lg:pb-10">
      <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/transfers" })}>
        <ArrowLeft className="mr-2 h-4 w-4" /> {t("transferDetail.allTransfers")}
      </Button>

      <Card className="overflow-hidden border-0 bg-gradient-wallet text-white shadow-elevated">
        <CardContent className="p-6 md:p-8 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-white/70">
              <ShieldCheck className="h-3.5 w-3.5" /> {t("transferDetail.transferOrder")}
            </div>
            {statusBadge(w)}
          </div>
          <div>
            <p className="text-xs text-white/70">{t("transferDetail.amount")}</p>
            <p className="font-serif text-4xl font-medium tabular-nums md:text-5xl">
              {formatCurrency(Number(w.amount))}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
            <Field label={t("transferDetail.beneficiary")} value={w.beneficiary} />
            <Field label={t("transferDetail.bank")} value={w.bank_name} />
            <Field label={t("transferDetail.reference")} value={w.reference ?? "—"} />
            <Field label={t("transferDetail.iban")} value={w.iban} mono />
            {w.bic && <Field label={t("transferDetail.bic")} value={w.bic} mono />}
            <Field label={t("transferDetail.issuedOn")} value={formatDateTime(w.created_at)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="font-serif text-xl">{t("transferDetail.tracking")}</h2>
          <TransferProcessPanel
            withdrawalId={w.id}
            loanId={w.loan_id}
            progress={w.progress ?? 0}
            currentStep={w.current_step ?? 0}
            stepStartedAt={w.step_started_at ?? w.created_at}
            onChanged={() => void load()}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <h2 className="mb-4 flex items-center gap-2 font-serif text-xl">
            <History className="h-4 w-4" /> {t("transferDetail.history")}
          </h2>
          <ol className="relative space-y-4 border-l border-border pl-5">
            <TimelineItem
              when={formatDateTime(w.created_at)}
              title={t("transferDetail.evtIssued")}
              desc={t("transferDetail.evtIssuedDesc", { name: w.beneficiary, amount: formatCurrency(Number(w.amount)) })}
              done
            />
            {w.current_step >= 1 && (
              <TimelineItem
                when={formatDateTime(w.step_started_at)}
                title={t("transferDetail.evtCompliance")}
                desc={t("transferDetail.evtComplianceDesc")}
                done
              />
            )}
            {w.current_step >= 2 && (
              <TimelineItem
                when={formatDateTime(w.step_started_at)}
                title={t("transferDetail.evtReinforced")}
                desc={t("transferDetail.evtReinforcedDesc")}
                done
              />
            )}
            {isFinal && (
              <TimelineItem
                when={w.processed_at ? formatDateTime(w.processed_at) : t("transferDetail.rightNow")}
                title={t("transferDetail.evtExecuted")}
                desc={t("transferDetail.evtExecutedDesc")}
                done
              />
            )}
          </ol>
        </CardContent>
      </Card>

      {isFinal && (
        <Card>
          <CardContent className="p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-primary" />
              <div>
                <p className="font-semibold">{t("transferDetail.receiptAvailable")}</p>
                <p className="text-xs text-muted-foreground">
                  {t("transferDetail.receiptHint")}
                </p>
              </div>
            </div>
            <Button onClick={() => window.print()} className="shadow-glow">
              <Download className="mr-2 h-4 w-4" /> {t("transferDetail.downloadPrint")}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-white/60">{label}</p>
      <p className={`mt-0.5 truncate ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

function TimelineItem({
  when,
  title,
  desc,
  done,
}: {
  when: string;
  title: string;
  desc: string;
  done?: boolean;
}) {
  return (
    <li className="relative">
      <span
        className={`absolute -left-[27px] flex h-4 w-4 items-center justify-center rounded-full border-2 ${
          done ? "border-success bg-success/20" : "border-border bg-background"
        }`}
      >
        {done && <span className="h-1.5 w-1.5 rounded-full bg-success" />}
      </span>
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-xs text-muted-foreground">{desc}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground/70">{when}</p>
    </li>
  );
}

void Printer;
