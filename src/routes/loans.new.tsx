import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Upload, X, FileCheck2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/loans/new")({
  component: NewLoan,
  head: () => ({ meta: [{ title: "Nouvelle demande — HSBC BANK" }] }),
});

const schema = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  amount: z.number().min(500, "Minimum 500 €").max(100000, "Maximum 100 000 €"),
  duration_months: z.number().int().min(3).max(120),
  monthly_income: z.number().min(0).max(1000000),
  purpose: z.string().trim().max(500).optional(),
});

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

function NewLoan() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [user, authLoading, navigate]);

  function onFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []);
    const valid = list.filter((f) => {
      if (f.size > MAX_FILE_SIZE) {
        toast.error(`${f.name} dépasse 5 Mo`);
        return false;
      }
      return true;
    });
    setFiles((prev) => [...prev, ...valid].slice(0, 5));
    e.target.value = "";
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse({
      fullName: fd.get("fullName"),
      email: fd.get("email"),
      amount: Number(fd.get("amount")),
      duration_months: Number(fd.get("duration_months")),
      monthly_income: Number(fd.get("monthly_income")),
      purpose: (fd.get("purpose") as string) || undefined,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    setSubmitting(true);

    // 1. Insert loan
    const { data: loan, error: loanErr } = await supabase
      .from("loans")
      .insert({
        user_id: user.id,
        full_name: parsed.data.fullName,
        email: parsed.data.email,
        amount: parsed.data.amount,
        duration_months: parsed.data.duration_months,
        monthly_income: parsed.data.monthly_income,
        purpose: parsed.data.purpose ?? null,
      })
      .select()
      .single();

    if (loanErr || !loan) {
      setSubmitting(false);
      toast.error("Erreur lors de la création de la demande");
      return;
    }

    // 2. Upload documents
    for (const file of files) {
      const safe = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const path = `${user.id}/${loan.id}/${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage.from("loan-documents").upload(path, file);
      if (upErr) {
        toast.error(`Upload échoué: ${file.name}`);
        continue;
      }
      await supabase.from("loan_documents").insert({
        loan_id: loan.id,
        user_id: user.id,
        file_path: path,
        file_name: file.name,
        file_size: file.size,
      });
    }

    const { notifyAllAdmins } = await import("@/lib/notifications");
    await notifyAllAdmins({
      title: "Nouvelle demande de prêt",
      message: `${parsed.data.fullName} demande ${parsed.data.amount} € sur ${parsed.data.duration_months} mois`,
      link: "/admin",
      category: "info",
    });

    setSubmitting(false);
    toast.success("Demande envoyée !");
    navigate({ to: "/loans/$loanId", params: { loanId: loan.id } });
  }

  if (authLoading || !user) return <div className="flex items-center justify-center h-96 text-muted-foreground">Chargement...</div>;

  return (
    <div className="mx-auto max-w-3xl px-4 pb-28 pt-8 sm:px-6 lg:px-8 lg:pb-10">
      <Button asChild variant="ghost" size="sm" className="mb-6">
        <Link to="/dashboard"><ArrowLeft className="mr-1.5 h-4 w-4" /> Retour</Link>
      </Button>

      <h1 className="text-3xl font-bold">Nouvelle demande de prêt</h1>
      <p className="mt-2 text-muted-foreground">Remplissez le formulaire et joignez vos justificatifs.</p>

      <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FileCheck2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold">Pièces requises pour l'étude</h2>
            <p className="mt-1 text-sm text-muted-foreground">Déposez des fichiers lisibles au format PDF, JPG ou PNG afin d'accélérer la validation.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          {[
            "Pièce d'identité valide recto-verso",
            "Justificatif de domicile récent",
            "Trois derniers bulletins de salaire ou justificatifs de revenus",
            "Dernier relevé bancaire ou RIB au nom du demandeur",
          ].map((item) => (
            <div key={item} className="flex gap-2 rounded-xl bg-secondary px-3 py-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5 rounded-2xl border border-border bg-card p-6 shadow-card">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="fullName">Nom complet</Label>
            <Input id="fullName" name="fullName" required defaultValue="" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required defaultValue={user.email ?? ""} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="amount">Montant souhaité (€)</Label>
            <Input id="amount" name="amount" type="number" min={500} max={100000} step={100} required placeholder="5000" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="duration_months">Durée (mois)</Label>
            <Input id="duration_months" name="duration_months" type="number" min={3} max={120} required placeholder="24" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="monthly_income">Revenus mensuels nets (€)</Label>
          <Input id="monthly_income" name="monthly_income" type="number" min={0} step={50} required placeholder="2500" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="purpose">Objet du prêt (optionnel)</Label>
          <Textarea id="purpose" name="purpose" rows={3} maxLength={500} placeholder="Travaux, voiture, projet personnel..." />
        </div>

        <div className="space-y-2">
          <Label>Justificatifs requis (max 5, 5 Mo chacun)</Label>
          <label className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-input/30 px-4 py-6 text-sm text-muted-foreground cursor-pointer hover:bg-input/50 transition">
            <Upload className="h-4 w-4" />
            <span>Cliquez pour ajouter (PDF, JPG, PNG)</span>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" multiple onChange={onFilesChange} className="hidden" />
          </label>
          {files.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {files.map((f, i) => (
                <li key={i} className="flex items-center justify-between rounded-md bg-secondary px-3 py-2 text-sm">
                  <span className="truncate">{f.name}</span>
                  <button type="button" onClick={() => removeFile(i)} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Button type="submit" className="w-full shadow-glow" size="lg" disabled={submitting}>
          {submitting ? "Envoi..." : "Soumettre la demande"}
        </Button>
      </form>
    </div>
  );
}
