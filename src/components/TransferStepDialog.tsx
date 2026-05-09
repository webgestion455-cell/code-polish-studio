import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Loader2, Lock, AlertCircle, KeyRound, CheckCircle2 } from "lucide-react";
import { formatCurrency } from "@/lib/loan-helpers";

interface UnlockCodeRow {
  id: string;
  loan_id: string;
  step: number;
  fee_amount: number;
  code: string;
  used: boolean;
  released: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  withdrawalId: string;
  loanId: string;
  currentProgress: number; // 0,63,88,100
  currentStep: number;     // 0,1,2,3
  onAdvanced?: () => void;
}

const STEPS = [63, 88, 100] as const;

export function TransferStepDialog({ open, onClose, withdrawalId, loanId, currentProgress, currentStep, onAdvanced }: Props) {
  const { t } = useTranslation();
  const [codes, setCodes] = useState<UnlockCodeRow[]>([]);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    void load();
    const ch = supabase.channel(`unlock-${loanId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "loan_unlock_codes", filter: `loan_id=eq.${loanId}` }, load)
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loanId]);

  async function load() {
    const { data } = await supabase
      .from("loan_unlock_codes" as any)
      .select("*")
      .eq("loan_id", loanId)
      .order("step", { ascending: true });
    setCodes((data as unknown as UnlockCodeRow[]) ?? []);
  }

  if (!open) return null;

  const nextStepIdx = currentStep; // 0..2
  const nextProgress = STEPS[nextStepIdx];
  const nextCode = codes.find((c) => c.step === nextProgress);
  const isFinal = currentProgress >= 100;

  async function submitCode() {
    if (!nextCode) {
      toast.error(t("transferSteps.codeNotIssued"));
      return;
    }
    setBusy(true);
    const { data, error } = await (supabase as any).rpc("consume_unlock_code", {
      _loan_id: loanId, _step: nextProgress, _code: code.trim(),
    });
    if (error || !data) {
      setBusy(false);
      toast.error(t("transferSteps.invalidCode"));
      return;
    }
    const newProgress = nextProgress;
    const newStep = nextStepIdx + 1;
    const upd: any = { progress: newProgress, current_step: newStep };
    if (newProgress >= 100) { upd.status = "envoye"; upd.processed_at = new Date().toISOString(); }
    await supabase.from("withdrawals").update(upd).eq("id", withdrawalId);
    setBusy(false);
    setCode("");
    toast.success(newProgress >= 100 ? t("transferSteps.successFinal") : t("transferSteps.advanced", { p: newProgress }));
    onAdvanced?.();
    if (newProgress >= 100) onClose();
    void load();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-elevated" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-serif text-xl">{t("transferSteps.title")}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t("transferSteps.subtitle")}</p>

        <div className="mt-6">
          <div className="flex justify-between text-xs font-semibold mb-1">
            <span>{t("transferSteps.progress")}</span><span>{currentProgress}%</span>
          </div>
          <Progress value={currentProgress} className="h-3" />
          <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
            {STEPS.map((s) => <span key={s}>{s}%</span>)}
          </div>
        </div>

        {isFinal ? (
          <Card className="mt-6 border-success/40 bg-success/5">
            <CardContent className="p-5 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-success mt-0.5" />
              <div>
                <p className="font-semibold text-success">{t("transferSteps.completed")}</p>
                <p className="text-xs text-muted-foreground mt-1">{t("transferSteps.completedDesc")}</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="mt-6">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-start gap-3 rounded-xl bg-warning/10 p-3 text-sm text-warning">
                <Lock className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">{t("transferSteps.blockedTitle", { p: nextProgress })}</p>
                  <p className="text-xs mt-1 text-warning/80">{t("transferSteps.blockedDesc", { p: nextProgress })}</p>
                </div>
              </div>

              {nextCode ? (
                <>
                  <div className="rounded-xl bg-secondary p-3 text-sm">
                    <p className="text-xs text-muted-foreground">{t("transferSteps.feeFor", { p: nextProgress })}</p>
                    <p className="font-semibold text-lg tabular-nums">{formatCurrency(Number(nextCode.fee_amount))}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t("transferSteps.feeHelp")}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <KeyRound className="h-4 w-4" /> {t("transferSteps.enterCode")}
                    </Label>
                    <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="XXXX-XXXX" className="font-mono uppercase" />
                  </div>
                  <Button className="w-full shadow-glow" onClick={submitCode} disabled={busy || !code.trim()}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {t("transferSteps.unlock", { p: nextProgress })}
                  </Button>
                </>
              ) : (
                <div className="flex items-start gap-3 rounded-xl border border-dashed p-4 text-sm">
                  <AlertCircle className="h-4 w-4 mt-0.5 text-info" />
                  <div>
                    <p className="font-semibold">{t("transferSteps.awaitingCode")}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t("transferSteps.awaitingCodeDesc")}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="mt-6 flex justify-end">
          <Button variant="ghost" onClick={onClose}>{t("common.close")}</Button>
        </div>
      </div>
    </div>
  );
}
