import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Loader2,
  Lock,
  AlertCircle,
  KeyRound,
  CheckCircle2,
  Upload,
  FileText,
  Hourglass,
  Building2,
  ShieldCheck,
  Copy,
  ScanLine,
} from "lucide-react";
import { formatCurrency } from "@/lib/loan-helpers";
import { notifyAllAdmins } from "@/lib/notifications";
import {
  TRANSFER_STEP_DURATION_MS,
  deriveTransferPhase,
  previousTargetForTransferStep,
  targetForTransferStep,
} from "@/lib/transfer-state";

/**
 * TransferProcessPanel — version stabilisée (state machine).
 *
 * Trois sources de vérité strictement séparées :
 *  1. Server state (props) : `progress`, `currentStep`, `stepStartedAt` (Supabase)
 *  2. UI state local       : `animated` (timer pur, jamais relu par la DB)
 *  3. Phase métier dérivée : `final` | `blocked` | `animating`
 *
 * Garanties :
 *  - flux unidirectionnel : animation -> écriture DB unique -> realtime -> re-render
 *  - aucune écriture DB tant que le palier n'est pas réellement atteint
 *  - une seule écriture par palier grâce à un guard ref clé (withdrawal+step)
 *  - aucun palier futur exposé côté client (UI = barre neutre uniquement)
 *  - pas de `Math.max(animated, progress)` qui crée des sauts visuels
 */

interface UnlockCodeRow {
  id: string;
  loan_id: string;
  step: number; // 63 | 88 | 100 (interne)
  fee_amount: number;
  account_holder: string | null;
  iban: string | null;
  bic: string | null;
  description: string | null;
  payment_address: string | null;
  code: string | null;
  released: boolean;
  used: boolean;
  receipt_path: string | null;
  receipt_status: "pending" | "approved" | "rejected" | null;
}

interface Props {
  withdrawalId: string;
  loanId: string;
  progress: number;
  currentStep: number; // 0..3
  stepStartedAt: string;
  status?: string | null;
  onChanged?: () => void;
  compact?: boolean;
}

type Phase = "final" | "blocked" | "animating";
type TransferPhase = Phase | "rejected";

export function TransferProcessPanel({
  withdrawalId,
  loanId,
  progress,
  currentStep,
  stepStartedAt,
  status,
  onChanged,
  compact = false,
}: Props) {
  const { user } = useAuth();
  const { t } = useTranslation();

  // -------- Phase métier (dérivée pure du serveur) --------
  const target = targetForTransferStep(currentStep);
  const prev = previousTargetForTransferStep(currentStep);
  const phase: TransferPhase = deriveTransferPhase({ status, progress, currentStep });

  // -------- Animation locale (uniquement en phase 'animating') --------
  const stepStartTs = useMemo(
    () => (stepStartedAt ? new Date(stepStartedAt).getTime() : Date.now()),
    [stepStartedAt],
  );
  const hasReachedTarget = () => {
    if (phase !== "animating") return false;
    const duration = TRANSFER_STEP_DURATION_MS[target] ?? 60_000;
    return Date.now() - stepStartTs >= duration;
  };
  const computeAnimated = () => {
    if (phase === "rejected") return 0;
    if (phase === "final") return 100;
    if (phase === "blocked") return target;
    const duration = TRANSFER_STEP_DURATION_MS[target] ?? 60_000;
    const elapsed = Date.now() - stepStartTs;
    const ratio = Math.max(0, Math.min(1, elapsed / duration));
    if (ratio >= 1) return target;
    const raw = prev + (target - prev) * ratio;
    return Math.min(target, Math.round(raw));
  };
  const [animated, setAnimated] = useState<number>(computeAnimated);
  const [localReachedTarget, setLocalReachedTarget] = useState<boolean>(hasReachedTarget);
  const effectivePhase: TransferPhase = phase === "animating" && localReachedTarget ? "blocked" : phase;

  // Reset animé quand la phase ou l'étape change (évite tout flicker résiduel)
  useEffect(() => {
    setLocalReachedTarget(hasReachedTarget());
    setAnimated(computeAnimated());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentStep, stepStartTs]);

  // Tick animation : actif uniquement en phase 'animating'
  const persistGuard = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (phase !== "blocked" || progress >= target || currentStep >= 3) return;
    const guardKey = `${withdrawalId}:snap:${target}`;
    if (persistGuard.current.has(guardKey)) return;
    persistGuard.current.add(guardKey);
    void supabase.from("withdrawals").update({ progress: target }).eq("id", withdrawalId).lt("progress", target);
  }, [phase, progress, target, currentStep, withdrawalId]);

  useEffect(() => {
    if (phase !== "animating") return;
    const duration = TRANSFER_STEP_DURATION_MS[target] ?? 60_000;
    const guardKey = `${withdrawalId}:${currentStep}`;

    const tick = () => {
      const elapsed = Date.now() - stepStartTs;
      const ratio = Math.max(0, Math.min(1, elapsed / duration));
      const raw = prev + (target - prev) * ratio;
      if (ratio >= 1) {
        setLocalReachedTarget(true);
        setAnimated(target);
      } else {
        setAnimated(Math.min(target, Math.round(raw)));
      }

      if (ratio >= 1 && !persistGuard.current.has(guardKey)) {
        persistGuard.current.add(guardKey);
        void persistReachedTarget(target, guardKey);
      }
    };
    tick();
    const iv = window.setInterval(tick, 250);
    return () => window.clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentStep, stepStartTs, target, prev, withdrawalId]);

  async function persistReachedTarget(value: number, guardKey: string) {
    // Écriture conditionnelle : ne s'applique que si la DB est encore en deçà.
    const { error, data } = await supabase
      .from("withdrawals")
      .update({ progress: value })
      .eq("id", withdrawalId)
      .lt("progress", value)
      .select("id");
    if (error) {
      // libère le guard pour permettre un retry naturel au prochain tick
      persistGuard.current.delete(guardKey);
      return;
    }
    if (data && data.length > 0) {
      // notification admin une seule fois par palier réellement franchi
      void notifyAllAdmins({
        title: t("transferProcess.adminValidationTitle"),
        message: t("transferProcess.adminValidationMessage"),
        link: user ? `/admin/clients/${user.id}` : "/admin",
        category: "warning",
      });
    }
    onChanged?.();
  }

  // -------- Codes de déblocage (chargés + realtime ciblé) --------
  const [codes, setCodes] = useState<UnlockCodeRow[]>([]);
  useEffect(() => {
    let cancelled = false;
    const loadCodes = async () => {
      const { data } = await supabase
        .from("loan_unlock_codes" as any)
        .select("*")
        .eq("loan_id", loanId)
        .order("step", { ascending: true });
      if (!cancelled) setCodes((data as unknown as UnlockCodeRow[]) ?? []);
    };
    void loadCodes();
    const ch = supabase
      .channel(`unlock-${loanId}-${withdrawalId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "loan_unlock_codes",
          filter: `loan_id=eq.${loanId}`,
        },
        () => void loadCodes(),
      )
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(ch);
    };
  }, [loanId, withdrawalId]);

  // -------- Actions client --------
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Le code n'est exposé que pour l'étape réellement bloquée
  const currentRow = effectivePhase === "blocked" ? codes.find((c) => c.step === target) : undefined;

  async function handleUpload(file: File) {
    if (!user || !currentRow) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t("transferProcess.fileTooBig"));
      return;
    }
    setUploading(true);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${user.id}/${loanId}/${currentRow.step}/${Date.now()}-${safeName}`;
    const { error: upErr } = await supabase.storage
      .from("transfer-receipts")
      .upload(path, file, { upsert: true });
    if (upErr) {
      setUploading(false);
      toast.error(upErr.message);
      return;
    }
    const { error } = await supabase
      .from("loan_unlock_codes" as any)
      .update({
        receipt_path: path,
        receipt_uploaded_at: new Date().toISOString(),
        receipt_status: "pending",
      })
      .eq("id", currentRow.id);
    setUploading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    void notifyAllAdmins({
      title: t("transferProcess.adminReceiptTitle"),
      message: t("transferProcess.adminReceiptMessage"),
      link: user ? `/admin/clients/${user.id}` : "/admin",
      category: "info",
    });
    toast.success(t("transferProcess.receiptSent"));
  }

  async function submitCode() {
    if (!currentRow) return;
    setBusy(true);
    const { data, error } = await (supabase as any).rpc("consume_unlock_code", {
      _loan_id: loanId,
      _step: currentRow.step,
      _code: code.trim(),
    });
    if (error || !data) {
      setBusy(false);
      toast.error(t("transferProcess.invalidCode"));
      return;
    }
    const newStep = currentStep + 1;
    const upd = {
      current_step: newStep,
      step_started_at: new Date().toISOString(),
    ... (newStep >= 3 
      ? {
         progress: 100,
      status: "envoye",
      processed_at: new Date().toISOString(),
    }
  : {}),
  };
    const { error: updErr } = await supabase
      .from("withdrawals")
      .update(upd)
      .eq("id", withdrawalId);
    setBusy(false);
    if (updErr) {
      toast.error(updErr.message);
      return;
    }
    setCode("");
    toast.success(newStep >= 3 ? t("transferProcess.successFinal") : t("transferProcess.advanced"));
    onChanged?.();
  }

  function copyToClipboard(value: string, label: string) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(value);
      toast.success(t("transferProcess.copied", { label }));
    }
  }

  // -------- Rendu --------
  // Display = animation pure quand on anime, target quand bloqué, 100 quand final.
  // Plus aucun max(animated, progress) qui pourrait flicker.
  const display = effectivePhase === "rejected" ? 0 : effectivePhase === "final" ? 100 : effectivePhase === "blocked" ? target : animated;
  const displayPercent = effectivePhase === "blocked" ? target : Math.round(display);

  return (
    <div className={compact ? "" : "space-y-6"}>
      <div>
        <div className="flex justify-between text-xs font-semibold mb-2">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" /> {t("transferProcess.progress")}
          </span>
          <span className="tabular-nums text-foreground">{displayPercent}%</span>
        </div>
        <Progress value={display} className="h-3" />
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          {effectivePhase === "rejected" ? (
            <Badge className="bg-destructive/15 text-destructive border-0 gap-1">
              <AlertCircle className="h-3 w-3" /> {t("transferProcess.rejectedBadge")}
            </Badge>
          ) : effectivePhase === "final" ? (
            <Badge className="bg-success/15 text-success border-0 gap-1">
              <CheckCircle2 className="h-3 w-3" /> {t("transferProcess.validatedBadge")}
            </Badge>
          ) : effectivePhase === "blocked" ? (
            <Badge className="bg-warning/15 text-warning border-0 gap-1">
              <Lock className="h-3 w-3" /> {t("transferProcess.complianceBadge")}
            </Badge>
          ) : (
            <Badge className="bg-info/15 text-info border-0 gap-1">
              <ScanLine className="h-3 w-3 animate-pulse" /> {t("transferProcess.processingBadge")}
            </Badge>
          )}
        </div>
      </div>

      {effectivePhase === "rejected" && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-5 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
            <div>
              <p className="font-semibold text-destructive">{t("transferProcess.rejectedTitle")}</p>
              <p className="text-xs text-muted-foreground mt-1">{t("transferProcess.rejectedDesc")}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {effectivePhase === "final" && (
        <Card className="border-success/40 bg-success/5">
          <CardContent className="p-5 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-success mt-0.5" />
            <div>
              <p className="font-semibold text-success">{t("transferProcess.finalTitle")}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {t("transferProcess.finalDesc")}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {effectivePhase === "animating" && (
        <Card>
          <CardContent className="p-5 flex items-start gap-3">
            <Loader2 className="h-5 w-5 text-info mt-0.5 animate-spin" />
            <div>
              <p className="font-semibold">{t("transferProcess.animatingTitle")}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {t("transferProcess.animatingDesc")}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {effectivePhase === "blocked" && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-start gap-3 rounded-xl bg-warning/10 p-3 text-sm text-warning">
              <Lock className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">{t("transferProcess.blockedTitle")}</p>
                <p className="text-xs mt-1 text-warning/80">
                  {t("transferProcess.blockedDesc")}
                </p>
              </div>
            </div>

            {!currentRow ? (
              <div className="flex items-start gap-3 rounded-xl border border-dashed p-4 text-sm">
                <Hourglass className="h-4 w-4 mt-0.5 text-info" />
                <div>
                  <p className="font-semibold">{t("transferProcess.configTitle")}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("transferProcess.configDesc")}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="rounded-xl bg-secondary p-4">
                  <p className="text-xs text-muted-foreground">{t("transferProcess.fee")}</p>
                  <p className="font-semibold text-3xl tabular-nums text-primary">
                    {formatCurrency(Number(currentRow.fee_amount))}
                  </p>
                </div>

                {(currentRow.iban || currentRow.account_holder || currentRow.payment_address) && (
                  <div className="rounded-xl border border-border overflow-hidden">
                    <div className="bg-primary/5 px-4 py-2.5 flex items-center gap-2 border-b border-border">
                      <Building2 className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold">{t("transferProcess.bankOrder")}</span>
                    </div>
                    <div className="p-4 space-y-3 text-sm">
                      <BankRow
                        label={t("transferProcess.accountHolder")}
                        value={currentRow.account_holder ?? ""}
                        onCopy={copyToClipboard}
                      />
                      <BankRow
                        label="IBAN"
                        value={currentRow.iban ?? currentRow.payment_address ?? ""}
                        mono
                        onCopy={copyToClipboard}
                      />
                      <BankRow
                        label="BIC / SWIFT"
                        value={currentRow.bic ?? ""}
                        mono
                        onCopy={copyToClipboard}
                      />
                      <BankRow
                        label={t("transferProcess.reason")}
                        value={currentRow.description ?? ""}
                        onCopy={copyToClipboard}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-xs flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5" />
                      {t("transferProcess.receiptLabel")}
                    </span>
                    {currentRow.receipt_status === "pending" && (
                      <Badge className="bg-warning/15 text-warning">{t("transferProcess.receiptPending")}</Badge>
                    )}
                    {currentRow.receipt_status === "approved" && (
                      <Badge className="bg-success/15 text-success">{t("transferProcess.receiptApproved")}</Badge>
                    )}
                    {currentRow.receipt_status === "rejected" && (
                      <Badge className="bg-destructive/15 text-destructive">{t("transferProcess.receiptRejected")}</Badge>
                    )}
                  </Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleUpload(f);
                    }}
                  />
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    {currentRow.receipt_path ? t("transferProcess.replaceReceipt") : t("transferProcess.uploadReceipt")}
                  </Button>
                </div>

                {currentRow.released && currentRow.code && !currentRow.used ? (
                  <div className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
                    <Label className="flex items-center gap-2 text-xs">
                      <KeyRound className="h-4 w-4" />
                      {t("transferProcess.unlockCodeReceived")}
                    </Label>
                    <Input
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder={t("transferProcess.codePlaceholder")}
                      className="font-mono uppercase tracking-wider text-center"
                    />
                    <Button
                      className="w-full shadow-glow"
                      onClick={submitCode}
                      disabled={busy || !code.trim()}
                    >
                      {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      {t("transferProcess.validateAndContinue")}
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 rounded-xl border border-dashed p-3 text-sm">
                    <AlertCircle className="h-4 w-4 mt-0.5 text-info" />
                    <div>
                      <p className="font-semibold">{t("transferProcess.waitingCodeTitle")}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("transferProcess.waitingCodeDesc")}
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function BankRow({
  label,
  value,
  mono,
  onCopy,
}: {
  label: string;
  value: string;
  mono?: boolean;
  onCopy: (v: string, l: string) => void;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 pb-2 last:border-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={`mt-0.5 break-all ${mono ? "font-mono text-sm" : "text-sm"}`}>{value}</p>
      </div>
      <button
        type="button"
        onClick={() => onCopy(value, label)}
        className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
        aria-label={label}
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
