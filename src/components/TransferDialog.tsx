import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft, Send, Zap, Clock, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/loan-helpers";
import { notifyAllAdmins } from "@/lib/notifications";
import { z } from "zod";

interface LoanLite {
  id: string;
  amount: number;
  disbursed_amount: number;
  status: string;
}

interface TransferDialogProps {
  open: boolean;
  onClose: () => void;
  /** Pré-sélection éventuelle du prêt */
  initialLoanId?: string | null;
  loans: LoanLite[];
  /** Callback après création réussie */
  onSuccess?: () => void;
  defaultBeneficiary?: string;
}

const ibanRe = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/;
const bicRe = /^[A-Z0-9]{8}([A-Z0-9]{3})?$/;

export function TransferDialog({
  open,
  onClose,
  initialLoanId,
  loans,
  onSuccess,
  defaultBeneficiary,
}: TransferDialogProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const eligibleLoans = useMemo(
    () =>
      loans.filter(
        (l) =>
          l.status === "fonds_disponibles" &&
          Number(l.amount) - Number(l.disbursed_amount ?? 0) > 0,
      ),
    [loans],
  );

  const [kind, setKind] = useState<"instantane" | "classique">("instantane");
  const [loanId, setLoanId] = useState<string>(initialLoanId ?? eligibleLoans[0]?.id ?? "");
  const [amount, setAmount] = useState<string>("");
  const [beneficiary, setBeneficiary] = useState<string>(defaultBeneficiary ?? "");
  const [iban, setIban] = useState("");
  const [bic, setBic] = useState("");
  const [bankName, setBankName] = useState("");
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [busy, setBusy] = useState(false);
  

  // Reset SEULEMENT à l'ouverture du dialog. Sinon les champs se vident
  // dès qu'un parent re-render (Realtime, etc.) car `eligibleLoans` change de référence.
  useEffect(() => {
    if (!open) return;
    setLoanId(initialLoanId ?? eligibleLoans[0]?.id ?? "");
    setKind("instantane");
    setAmount("");
    setIban("");
    setBic("");
    setBankName("");
    setReference("");
    setReason("");
    setScheduledFor("");
    setBeneficiary(defaultBeneficiary ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const selectedLoan = loans.find((l) => l.id === loanId);
  const remaining = selectedLoan
    ? Number(selectedLoan.amount) - Number(selectedLoan.disbursed_amount ?? 0)
    : 0;

  if (!open) return null;

  async function submit() {
    if (!user) return;
    if (!loanId) {
      toast.error("Aucun prêt sélectionné");
      return;
    }
    const schema = z.object({
      amount: z.coerce
        .number()
        .positive("Montant invalide")
        .max(remaining, `Maximum ${formatCurrency(remaining)}`),
      beneficiary: z.string().trim().min(2, "Bénéficiaire requis").max(120),
      iban: z
        .string()
        .trim()
        .transform((v) => v.replace(/\s/g, "").toUpperCase())
        .pipe(z.string().regex(ibanRe, "IBAN invalide")),
      bic: z
        .string()
        .trim()
        .transform((v) => v.replace(/\s/g, "").toUpperCase())
        .pipe(z.string().regex(bicRe, "BIC/SWIFT invalide")),
      bankName: z.string().trim().min(2, "Banque requise").max(120),
    });
    const parsed = schema.safeParse({ amount, beneficiary, iban, bic, bankName });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    if (kind === "classique" && scheduledFor) {
      const sch = new Date(scheduledFor);
      if (isNaN(sch.getTime()) || sch.getTime() < Date.now() - 60_000) {
        toast.error("La date programmée doit être dans le futur");
        return;
      }
    }

    setBusy(true);
const ref = reference.trim() || `VIR-${Date.now().toString(36).toUpperCase()}`;

// On crée TOUJOURS le virement en attente de la procédure 3 étapes.
const payload: Record<string, unknown> = {
loan_id: loanId,
user_id: user.id,
amount: parsed.data.amount,
beneficiary: parsed.data.beneficiary,
iban: parsed.data.iban,
bic: parsed.data.bic,
bank_name: parsed.data.bankName,
reference: ref,
transfer_kind: kind,
initiated_by: "client",
status: "en_traitement",
progress: 0,
current_step: 0,
processed_at: null,
scheduled_for:
kind === "classique" && scheduledFor ? new Date(scheduledFor).toISOString() : null,
admin_notes: reason.trim() || null,
};

const { data: inserted, error } = await (supabase.from("withdrawals") as any)
.insert(payload)
.select("id")
.single();

setBusy(false);

if (error || !inserted) {
toast.error(error?.message || "Erreur lors de l'émission");
return;
}

await notifyAllAdmins({
title:
kind === "instantane"
? "Nouveau virement instantané — étape 1/3"
: "Nouveau virement classique — étape 1/3",
message: `${formatCurrency(parsed.data.amount)} → ${parsed.data.beneficiary} (réf. ${ref})`,
link: "/admin",
category: "info",
});

toast.success("Virement initié — suivi disponible dans Mes virements");
onSuccess?.();
onClose();
navigate({ to: "/transfers/$transferId", params: { transferId: (inserted as { id: string }).id } });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="sm" onClick={onClose}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Retour
          </Button>
        </div>
        <h3 className="font-serif text-2xl text-primary">Effectuer un virement</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Choisissez le type, renseignez les coordonnées du bénéficiaire et confirmez.
        </p>

        {/* Kind */}
        <Card className="mt-5">
          <CardContent className="p-4">
            <RadioGroup
              value={kind}
              onValueChange={(v) => setKind(v as "instantane" | "classique")}
              className="grid sm:grid-cols-2 gap-3"
            >
              <label
                htmlFor="kind-instant"
                className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition ${kind === "instantane" ? "border-primary bg-primary/5 shadow-glow" : "border-border hover:border-primary/40"}`}
              >
                <RadioGroupItem value="instantane" id="kind-instant" className="mt-1" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 font-semibold">
                    <Zap className="h-4 w-4 text-warning" /> Instantané (SEPA Instant)
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Crédité immédiatement chez le bénéficiaire (24/7).
                  </p>
                </div>
              </label>
              <label
                htmlFor="kind-classic"
                className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition ${kind === "classique" ? "border-primary bg-primary/5 shadow-glow" : "border-border hover:border-primary/40"}`}
              >
                <RadioGroupItem value="classique" id="kind-classic" className="mt-1" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 font-semibold">
                    <Clock className="h-4 w-4 text-info" /> Classique (SEPA standard)
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Crédité sous 1 jour ouvré · programmation possible.
                  </p>
                </div>
              </label>
            </RadioGroup>
          </CardContent>
        </Card>

        <div className="mt-5 space-y-4">
          {eligibleLoans.length > 1 && (
            <div>
              <Label>Prêt source</Label>
              <Select value={loanId} onValueChange={setLoanId}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {eligibleLoans.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {formatCurrency(Number(l.amount))} · {l.id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Montant (€) *</Label>
              <Input
                type="number"
                min={1}
                step="0.01"
                max={remaining}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1.5"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Solde disponible : {formatCurrency(remaining)}
              </p>
            </div>
            <div>
              <Label>Bénéficiaire *</Label>
              <Input
                value={beneficiary}
                onChange={(e) => setBeneficiary(e.target.value)}
                className="mt-1.5"
                placeholder="Nom et prénom"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-[2fr_1fr] gap-4">
            <div>
              <Label>IBAN *</Label>
              <Input
                value={iban}
                onChange={(e) => setIban(e.target.value.toUpperCase())}
                className="mt-1.5 font-mono"
                placeholder="FR76 1234 …"
              />
            </div>
            <div>
              <Label>BIC / SWIFT *</Label>
              <Input
                value={bic}
                onChange={(e) => setBic(e.target.value.toUpperCase())}
                className="mt-1.5 font-mono"
                placeholder="HSBCFR…"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Banque *</Label>
              <Input
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="mt-1.5"
                placeholder="Nom de la banque"
              />
            </div>
            <div>
              <Label>Référence</Label>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="mt-1.5"
                placeholder="Auto-générée si vide"
              />
            </div>
          </div>

          {kind === "classique" && (
            <div>
              <Label>Programmer (optionnel)</Label>
              <Input
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                className="mt-1.5"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Laissez vide pour exécution dès le prochain jour ouvré.
              </p>
            </div>
          )}

          <div>
            <Label>Motif (optionnel)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={500}
              className="mt-1.5"
              placeholder="Loyer, achat, remboursement…"
            />
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-success" />
          {kind === "instantane"
            ? "Coordonnées chiffrées · exécution immédiate"
            : "Coordonnées chiffrées · délai bancaire 1 jour ouvré"}
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={busy} className="shadow-glow">
            {busy ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-1.5" />
            )}
            {kind === "instantane" ? "Exécuter le virement" : "Confirmer le virement"}
          </Button>
        </div>

      </div>
    </div>
  );
}
