import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, KeyRound, User as UserIcon, Mail, Phone, ShieldCheck, Loader2 } from "lucide-react";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Paramètres — HSBC BANK" }] }),
});

function SettingsPage() {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate({ to: "/auth", replace: true });
      return;
    }
    void loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  async function loadProfile() {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("full_name, phone, email")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) {
      toast.error("Impossible de charger le profil");
    } else if (data) {
      setFullName(data.full_name ?? "");
      setPhone(data.phone ?? "");
      setEmail(data.email ?? user.email ?? "");
      setNewEmail(data.email ?? user.email ?? "");
    }
    setLoading(false);
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim(), phone: phone.trim() })
      .eq("user_id", user.id);
    setSavingProfile(false);
    if (error) toast.error("Erreur de sauvegarde");
    else toast.success("Profil mis à jour");
  }

  async function handleChangeEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail.trim() || newEmail === email) return;
    setSavingEmail(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
    setSavingEmail(false);
    if (error) toast.error(error.message);
    else toast.success("Email mis à jour. Vérifiez votre boîte de réception pour confirmer.");
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("Le mot de passe doit contenir au moins 8 caractères");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }
    setSavingPassword(true);
    // Re-vérifier l'identité avec le mot de passe actuel
    if (currentPassword && user?.email) {
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (signInErr) {
        setSavingPassword(false);
        toast.error("Mot de passe actuel incorrect");
        return;
      }
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Mot de passe mis à jour");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex h-96 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Chargement...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-6 sm:pb-12 sm:pt-10">
      <div className="mb-6 flex items-center gap-3 hidden sm:flex">
        <Button asChild variant="ghost" size="icon">
          <Link to={role === "admin" ? "/admin" : "/dashboard"}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Paramètres</h1>
          <p className="text-sm text-muted-foreground">Gérez vos informations personnelles et votre sécurité</p>
        </div>
      </div>
      <div className="mb-6 sm:hidden">
        <h1 className="text-2xl font-bold tracking-tight">Paramètres</h1>
        <p className="text-sm text-muted-foreground">
                                   Gérez votre compte et votre sécurité
        </p>
      </div>

      {/* Profil */}
      <section className="rounded-2xl border border-border bg-card p-4 sm:p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <UserIcon className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold tracking-tight">Profil</h2>
        </div>
        <form onSubmit={handleSaveProfile} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="fullName">Nom complet</Label>
            <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-1.5 h-11" required />
          </div>
          <div>
            <Label htmlFor="phone">
              <Phone className="mr-1 inline h-3.5 w-3.5" /> Téléphone
            </Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1.5 h-11" placeholder="+33 6 12 34 56 78" />
          </div>
          <div>
            <Label>Email actuel</Label>
            <Input value={email} disabled className="mt-1.5 h-11 bg-muted/40" />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={savingProfile} className="w-full sm:w-auto">
              {savingProfile ? "Sauvegarde..." : "Enregistrer le profil"}
            </Button>
          </div>
        </form>
      </section>

      {/* Email */}
      <section className="mt-6 rounded-2xl border border-border bg-card p-4 sm:p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">Adresse email</h2>
        </div>
        <form onSubmit={handleChangeEmail} className="space-y-4">
          <div>
            <Label htmlFor="newEmail">Nouvelle adresse email</Label>
            <Input
              id="newEmail"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="mt-1.5 h-11"
              required
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Un email de confirmation sera envoyé à la nouvelle adresse.
            </p>
          </div>
          <Button type="submit" disabled={savingEmail || newEmail === email} className="w-full sm:w-auto" variant="secondary">
            {savingEmail ? "Envoi..." : "Mettre à jour l'email"}
          </Button>
        </form>
      </section>

      {/* Mot de passe */}
      <section className="mt-6 rounded-2xl border border-border bg-card p-4 sm:p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">Mot de passe</h2>
        </div>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <Label htmlFor="currentPassword">Mot de passe actuel</Label>
            <Input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="mt-1.5 h-11"
              autoComplete="current-password"
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="newPassword">Nouveau mot de passe</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1.5 h-11"
                minLength={8}
                autoComplete="new-password"
                required
              />
            </div>
            <div>
              <Label htmlFor="confirmPassword">Confirmer</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1.5 h-11"
                minLength={8}
                autoComplete="new-password"
                required
              />
            </div>
          </div>
          <Button type="submit" disabled={savingPassword} className="w-full sm:w-auto">
            {savingPassword ? "Mise à jour..." : "Changer le mot de passe"}
          </Button>
        </form>
      </section>

      {role === "admin" && (
        <section className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">Compte administrateur</h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Votre accès administrateur est protégé par des mesures de sécurité renforcées et une authentification sécurisée.
          </p>
          <Button asChild variant="outline" className="mt-4 w-full sm:w-auto">
            <Link to="/admin">Accéder au tableau de bord admin</Link>
          </Button>
        </section>
      )}
    </div>
  );
}
