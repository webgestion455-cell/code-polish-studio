import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate, formatDateTime, type LoanStatus } from "@/lib/loan-helpers";
import { LoanStepper, LOAN_STATUS_META, TONE_CLASSES } from "@/lib/loan-stepper";
import { generateContractPdf } from "@/lib/contract-pdf.functions";
import {
  ArrowLeft, Download, Upload, FileText, AlertTriangle, Loader2, CheckCircle2, Check,
  History, Wallet, Send,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/loans/$loanId")({
  component: LoanDetail,
  head: () => ({ meta: [{ title: "Détails du prêt — HSBC BANK" }] }),
});

interface Loan {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  amount: number;
  duration_months: number;
  monthly_income: number;
  purpose: string | null;
  status: LoanStatus;
  admin_notes: string | null;
  contract_pdf_path: string | null;
  signed_contract_path: string | null;
  created_at: string;
  funds_available_at: string | null;
  disbursed_amount: number;
}

interface DocRow {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  created_at: string;
}

interface TimelineEvent {
  id: string;
  message: string;
  created_at: string;
}

function LoanDetail() {
  const { loanId } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loan, setLoan] = useState<Loan | null>(null);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loanId]);

  async function load() {
    setLoading(true);
    const { data: l } = await supabase.from("loans").select("*").eq("id", loanId).maybeSingle();
    const { data: d } = await supabase.from("loan_documents").select("id, file_name, file_path, file_size, created_at").eq("loan_id", loanId).order("created_at");
    setLoan(l as Loan | null);
    setDocs((d as DocRow[]) ?? []);
    setLoading(false);
  }

  async function downloadFile(bucket: string, path: string, name: string) {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60);
    if (error || !data) {
      toast.error("Téléchargement impossible");
      return;
    }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = name;
    a.click();
  }

  async function downloadContractPdf() {
    if (!loan || !user) return;
    const id = toast.loading("Génération du contrat PDF…");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Session expirée. Veuillez vous reconnecter.");
      const { base64, filename } = await generateContractPdf({ data: { loanId: loan.id, accessToken } });
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Contrat téléchargé", { id });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(`Génération impossible : ${msg}`, { id });
    }
  }

  async function handleSignedUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!user || !loan) return;
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Fichier trop lourd (max 10 Mo)");
      return;
    }
    setUploading(true);
    const safe = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const path = `${user.id}/${loan.id}/signed-${Date.now()}-${safe}`;
    const { error: upErr } = await supabase.storage.from("contracts").upload(path, file);
    if (upErr) {
      setUploading(false);
      toast.error("Upload échoué");
      return;
    }
    const { error: updateErr } = await supabase
      .from("loans")
      .update({ signed_contract_path: path, status: "contrat_signe" })
      .eq("id", loan.id);
    setUploading(false);
    if (updateErr) {
      toast.error("Erreur de mise à jour");
    } else {
      toast.success("Contrat signé envoyé !");
      const { notifyAllAdmins } = await import("@/lib/notifications");
      await notifyAllAdmins({
        title: "Contrat signé reçu",
        message: `${loan.full_name ?? "Un client"} a signé son contrat (demande ${loan.id.slice(0, 8)})`,
        link: "/admin",
        category: "success",
      });
      setTimeout(async () => {
        await supabase.from("loans").update({ status: "en_traitement" }).eq("id", loan.id);
        void load();
      }, 3000);
      void load();
    }
    e.target.value = "";
  }

  if (loading || authLoading)
    return <div className="flex items-center justify-center h-96 text-muted-foreground">Chargement...</div>;
  if (!loan)
    return <div className="text-center py-20 text-muted-foreground">Prêt introuvable</div>;

  const status = loan.status;
  const isRefused = status === "refuse";
  const meta = LOAN_STATUS_META[status];
  const tone = TONE_CLASSES[meta.tone];
  const monthlyPayment = Number(loan.amount) / Number(loan.duration_months);
  const remainingBalance = Number(loan.amount) - Number(loan.disbursed_amount ?? 0);

  // Timeline reconstruite à partir du statut courant
  const timeline: TimelineEvent[] = (() => {
    const events: TimelineEvent[] = [
      { id: "t-created", message: "Demande déposée", created_at: loan.created_at },
    ];
    const order: LoanStatus[] = ["accepte", "contrat_envoye", "contrat_signe", "en_traitement", "fonds_disponibles"];
    const currentIdx = order.indexOf(status);
    order.slice(0, currentIdx + 1).forEach((s) => {
      events.push({ id: `t-${s}`, message: LOAN_STATUS_META[s].description, created_at: loan.funds_available_at ?? loan.created_at });
    });
    if (isRefused) events.push({ id: "t-refuse", message: "Demande refusée", created_at: loan.created_at });
    return events;
  })();

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6 pb-28 lg:pb-10">
      <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Retour à mes prêts
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Dossier #{loan.id.slice(0, 8).toUpperCase()}</p>
          <h1 className="text-3xl font-serif tracking-tight mt-0.5">Détail du prêt</h1>
        </div>
        {!isRefused && (
          <div className={cn(
            "inline-flex items-center gap-2 px-4 py-2 rounded-full border font-medium text-sm shrink-0",
            tone.bg, tone.text, tone.border,
          )}>
            <meta.icon className={cn("h-4 w-4", status === "en_traitement" && "animate-spin")} />
            {meta.label}
          </div>
        )}
      </div>

      {/* Stepper */}
      <Card className="overflow-hidden">
        <CardContent className="p-6 md:p-8">
          {isRefused ? (
            <div className="flex flex-col items-center justify-center text-center p-4">
              <div className="h-16 w-16 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-4">
                <AlertTriangle className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold text-destructive mb-2">Demande refusée</h3>
              <p className="text-muted-foreground max-w-md">
                Après étude de votre dossier, nous ne pouvons malheureusement pas donner une suite favorable à votre demande de financement.
              </p>
              {loan.admin_notes && (
                <div className="mt-6 p-4 bg-destructive/5 border border-destructive/20 rounded-xl text-sm text-destructive text-left w-full max-w-md">
                  <strong>Motif :</strong> {loan.admin_notes}
                </div>
              )}
            </div>
          ) : (
            <LoanStepper currentStatus={status} />
          )}
          {!isRefused && (
            <p className="text-center text-sm text-muted-foreground mt-6">{meta.description}</p>
          )}
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Résumé de la demande</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                <SummaryItem label="Montant" value={formatCurrency(Number(loan.amount))} highlight />
                <SummaryItem label="Durée" value={`${loan.duration_months} mois`} highlight />
                <SummaryItem label="Mensualité estimée" value={formatCurrency(monthlyPayment)} />
                <SummaryItem label="Revenus mensuels" value={formatCurrency(Number(loan.monthly_income))} />
                {loan.purpose && (
                  <div className="sm:col-span-2">
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Motif</dt>
                    <dd className="text-sm mt-1">{loan.purpose}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          {docs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Documents fournis</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {docs.map((doc) => (
                    <li key={doc.id} className="flex items-center gap-3 p-3 border rounded-xl hover-elevate">
                      <div className="h-9 w-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{doc.file_name}</p>
                        <p className="text-xs text-muted-foreground">Ajouté le {formatDate(doc.created_at)}</p>
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => downloadFile("loan-documents", doc.file_path, doc.file_name)}>
                        <Download className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Side column */}
        <div className="space-y-6">
          {/* Wallet card if funds available */}
          {status === "fonds_disponibles" && (
            <Card className="border-0 shadow-elevated overflow-hidden bg-gradient-to-br from-success to-emerald-700 text-white relative">
              <div aria-hidden className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
              <CardContent className="p-6 relative">
                <div className="flex items-center gap-2 text-white/80 text-xs font-medium uppercase tracking-wider">
                  <Wallet className="h-4 w-4" /> Solde disponible
                </div>
                <div className="text-3xl md:text-4xl font-serif font-medium mt-1.5 tabular-nums">
                  {formatCurrency(remainingBalance)}
                </div>
                {Number(loan.disbursed_amount ?? 0) > 0 && (
                  <p className="text-xs text-white/70 mt-1">
                    Déjà retiré : {formatCurrency(Number(loan.disbursed_amount))} sur {formatCurrency(Number(loan.amount))}
                  </p>
                )}
                <Button asChild className="w-full mt-5 bg-white text-success hover:bg-white/95 font-semibold shadow-md" size="lg">
                  <Link to="/dashboard">
                    <Send className="mr-2 h-4 w-4" /> Effectuer un virement
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Contract card — disponible UNIQUEMENT si contrat_envoye, signé ou aval */}
          {(status === "contrat_envoye" || status === "contrat_signe" || status === "en_traitement" || status === "fonds_disponibles") && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-accent" /> Contrat
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Téléchargement strictement réservé à 'contrat_envoye' (à signer) */}
                {status === "contrat_envoye" && (
                  <Button variant="outline" className="w-full justify-between" onClick={downloadContractPdf}>
                    Télécharger le contrat
                    <Download className="h-4 w-4" />
                  </Button>
                )}

                {status === "contrat_envoye" && (
                  <div className="pt-4 border-t space-y-3">
                    <p className="text-sm">Veuillez signer le contrat puis l'envoyer ci-dessous pour validation.</p>
                    <input type="file" id="signedContract" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleSignedUpload} disabled={uploading} />
                    <Button asChild className="w-full shadow-glow" disabled={uploading}>
                      <label htmlFor="signedContract" className="cursor-pointer">
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                        Envoyer le contrat signé
                      </label>
                    </Button>
                  </div>
                )}

                {loan.signed_contract_path && (
                  <div className="flex items-center gap-2 text-sm text-success bg-success/5 p-3 rounded-lg border border-success/20">
                    <CheckCircle2 className="h-4 w-4" /> Contrat signé reçu
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-4 w-4" /> Historique des actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Aucune action encore.</p>
              ) : (
                <ol className="relative space-y-5 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-px before:bg-border">
                  {timeline.map((event) => (
                    <li key={event.id} className="relative pl-9">
                      <span className="absolute left-0 top-1 h-6 w-6 rounded-full bg-accent/10 border-2 border-background ring-2 ring-accent/30 flex items-center justify-center">
                        <Check className="h-3 w-3 text-accent" />
                      </span>
                      <p className="text-sm font-medium">{event.message}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatDateTime(event.created_at)}</p>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SummaryItem({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{label}</dt>
      <dd className={cn("mt-1 tabular-nums", highlight ? "text-2xl font-serif font-medium" : "text-base font-medium")}>
        {value}
      </dd>
    </div>
  );
}
