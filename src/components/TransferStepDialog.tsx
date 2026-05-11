import { useEffect, useRef, useState } from "react";
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
} from "lucide-react";
import { formatCurrency } from "@/lib/loan-helpers";
import { notifyAllAdmins } from "@/lib/notifications";

interface UnlockCodeRow {
  id: string;
  loan_id: string;
  step: number;
  fee_amount: number;
  payment_address: string | null;
  code: string | null;
  released: boolean;
  used: boolean;
  receipt_path: string | null;
  receipt_status: "pending" | "approved" | "rejected" | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  withdrawalId: string;
  loanId: string;
  currentProgress: number;
  currentStep: number;
  onAdvanced?: () => void;
}

const STEPS = [63, 88, 100] as const;

export function TransferStepDialog({
  open,
  onClose,
  withdrawalId,
  loanId,
  currentProgress,
  currentStep,
  onAdvanced,
}: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [codes, setCodes] = useState<UnlockCodeRow[]>([]);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    void load();
    const ch = supabase
      .channel(`unlock-${loanId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "loan_unlock_codes", filter: `loan_id=eq.${loanId}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
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

  const isFinal = currentProgress >= 100;
  const nextStepIdx = currentStep;
  const nextProgress: number | null = isFinal ? null : STEPS[nextStepIdx];
  const nextRow = nextProgress ? codes.find((c) => c.step === nextProgress) : undefined;

  async function handleUpload(file: File) {
    if (!user || !nextRow) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t("transferSteps.fileTooBig", "Fichier trop volumineux (10 Mo max)"));
      return;
    }
    setUploading(true);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${user.id}/${loanId}/${nextRow.step}/${Date.now()}-${safeName}`;
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
      .eq("id", nextRow.id);
    setUploading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await notifyAllAdmins({
      title: t("transferSteps.notifAdminTitle", "Reçu reçu — étape {{p}}%", { p: nextRow.step }),
      message: t("transferSteps.notifAdminMsg", "Un client a téléversé un reçu pour validation."),
      link: "/admin",
      category: "info",
    });
    toast.success(t("transferSteps.receiptSent", "Reçu envoyé pour validation"));
    void load();
  }

  async function submitCode() {
    if (!nextRow || !nextProgress) return;
    setBusy(true);
    const { data, error } = await (supabase as any).rpc("consume_unlock_code", {
      _loan_id: loanId,
      _step: nextProgress,
      _code: code.trim(),
    });
    if (error || !data) {
      setBusy(false);
      toast.error(t("transferSteps.invalidCode", "Code invalide"));
      return;
    }
    const newProgress = nextProgress;
    const newStep = nextStepIdx + 1;
    const upd: any = { progress: newProgress, current_step: newStep };
    if (newProgress >= 100) {
      upd.status = "envoye";
      upd.processed_at = new Date().toISOString();
    }
    await supabase.from("withdrawals").update(upd).eq("id", withdrawalId);
    setBusy(false);
    setCode("");
    toast.success(
      newProgress >= 100
        ? t("transferSteps.successFinal", "Virement complété avec succès")
        : t("transferSteps.advanced", "Étape {{p}}% débloquée", { p: newProgress }),
    );
    onAdvanced?.();
    if (newProgress >= 100) onClose();
    void load();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h3 className="font-serif text-xl">
            {t("transferSteps.title", "Virement sécurisé")}
          </h3>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("transferSteps.subtitle", "Progression bancaire en 3 étapes : 63% · 88% · 100%.")}
        </p>

        <div className="mt-6">
          <div className="flex justify-between text-xs font-semibold mb-1">
            <span>{t("transferSteps.progress", "Progression")}</span>
            <span className="tabular-nums">{currentProgress}%</span>
          </div>
          <Progress value={currentProgress} className="h-3" />
          <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
            {STEPS.map((s) => (
              <span key={s} className={currentProgress >= s ? "text-success font-semibold" : ""}>
                {s}%
              </span>
            ))}
          </div>
        </div>

        {isFinal ? (
          <Card className="mt-6 border-success/40 bg-success/5">
            <CardContent className="p-5 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-success mt-0.5" />
              <div>
                <p className="font-semibold text-success">
                  {t("transferSteps.completed", "Virement terminé")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t(
                    "transferSteps.completedDesc",
                    "Les fonds ont été crédités au bénéficiaire.",
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="mt-6">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-start gap-3 rounded-xl bg-warning/10 p-3 text-sm text-warning">
                <Lock className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">
                    {t("transferSteps.blockedTitle", "Virement bloqué à {{p}}%", { p: nextProgress })}
                  </p>
                  <p className="text-xs mt-1 text-warning/80">
                    {t(
                      "transferSteps.blockedDesc",
                      "Pour des raisons de conformité bancaire, le déblocage de l'étape {{p}}% nécessite le règlement de frais et la validation de votre reçu.",
                      { p: nextProgress },
                    )}
                  </p>
                </div>
              </div>

              {!nextRow ? (
                <div className="flex items-start gap-3 rounded-xl border border-dashed p-4 text-sm">
                  <Hourglass className="h-4 w-4 mt-0.5 text-info" />
                  <div>
                    <p className="font-semibold">
                      {t("transferSteps.awaitingConfig", "Configuration en cours")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t(
                        "transferSteps.awaitingConfigDesc",
                        "Notre équipe finalise les paramètres de cette étape. Vous serez notifié.",
                      )}
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Frais */}
                  <div className="rounded-xl bg-secondary p-3">
                    <p className="text-xs text-muted-foreground">
                      {t("transferSteps.feeFor", "Frais étape {{p}}%", { p: nextProgress })}
                    </p>
                    <p className="font-semibold text-2xl tabular-nums text-primary">
                      {formatCurrency(Number(nextRow.fee_amount))}
                    </p>
                  </div>

                  {/* Adresse de paiement */}
                  {nextRow.payment_address && (
                    <div className="rounded-xl border border-border p-3 space-y-1">
                      <Label className="text-xs flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5" />
                        {t("transferSteps.paymentAddress", "Adresse de paiement")}
                      </Label>
                      <code className="block font-mono text-sm break-all bg-secondary/60 rounded px-2 py-1.5">
                        {nextRow.payment_address}
                      </code>
                      <p className="text-[11px] text-muted-foreground">
                        {t(
                          "transferSteps.paymentHelp",
                          "Effectuez le règlement sur cette adresse, puis téléversez votre reçu.",
                        )}
                      </p>
                    </div>
                  )}

                  {/* Upload reçu */}
                  <div className="space-y-2">
                    <Label className="text-xs flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5" />
                        {t("transferSteps.receipt", "Reçu de paiement")}
                      </span>
                      {nextRow.receipt_status === "pending" && (
                        <Badge className="bg-warning/15 text-warning">
                          {t("transferSteps.receiptPending", "En attente de validation")}
                        </Badge>
                      )}
                      {nextRow.receipt_status === "approved" && (
                        <Badge className="bg-success/15 text-success">
                          {t("transferSteps.receiptApproved", "Approuvé")}
                        </Badge>
                      )}
                      {nextRow.receipt_status === "rejected" && (
                        <Badge className="bg-destructive/15 text-destructive">
                          {t("transferSteps.receiptRejected", "Refusé — renvoyez")}
                        </Badge>
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
                      {nextRow.receipt_path
                        ? t("transferSteps.replaceReceipt", "Remplacer le reçu")
                        : t("transferSteps.uploadReceipt", "Téléverser le reçu")}
                    </Button>
                  </div>

                  {/* Code (visible uniquement si admin l'a envoyé) */}
                  {nextRow.released && nextRow.code && !nextRow.used ? (
                    <div className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
                      <Label className="flex items-center gap-2 text-xs">
                        <KeyRound className="h-4 w-4" />
                        {t("transferSteps.enterCode", "Saisissez votre code de déblocage")}
                      </Label>
                      <Input
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        placeholder="XXXX-XXXX"
                        className="font-mono uppercase tracking-wider"
                      />
                      <Button
                        className="w-full shadow-glow"
                        onClick={submitCode}
                        disabled={busy || !code.trim()}
                      >
                        {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        {t("transferSteps.unlock", "Débloquer l'étape {{p}}%", { p: nextProgress })}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3 rounded-xl border border-dashed p-3 text-sm">
                      <AlertCircle className="h-4 w-4 mt-0.5 text-info" />
                      <div>
                        <p className="font-semibold">
                          {t("transferSteps.awaitingCode", "En attente du code")}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t(
                            "transferSteps.awaitingCodeDesc",
                            "Le code sera envoyé après validation de votre reçu par un administrateur.",
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        <div className="mt-6 flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            {t("common.close", "Fermer")}
          </Button>
        </div>
      </div>
    </div>
  );
}
