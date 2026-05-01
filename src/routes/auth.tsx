import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ShieldCheck, Lock, Sparkles } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({
    meta: [{ title: "Connexion — HSC Bank" }],
  }),
});

const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "Nom trop court").max(100),
  phone: z.string().trim().min(6, "Téléphone invalide").max(20),
  email: z.string().trim().email("Email invalide").max(255),
  password: z.string().min(8, "8 caractères minimum").max(72),
});

const signInSchema = z.object({
  email: z.string().trim().email("Email invalide").max(255),
  password: z.string().min(1, "Mot de passe requis").max(72),
});

function AuthPage() {
  const { user, loading, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  async function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = signInSchema.safeParse({ email: fd.get("email"), password: fd.get("password") });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    const { error } = await signIn(parsed.data.email, parsed.data.password);
    setSubmitting(false);
    if (error) {
      toast.error(error.message === "Invalid login credentials" ? "Email ou mot de passe incorrect" : error.message);
    } else {
      toast.success("Connecté !");
      navigate({ to: "/dashboard" });
    }
  }

  async function handleSignUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = signUpSchema.safeParse({
      fullName: fd.get("fullName"),
      phone: fd.get("phone"),
      email: fd.get("email"),
      password: fd.get("password"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    const { error } = await signUp(parsed.data.email, parsed.data.password, parsed.data.fullName, parsed.data.phone);
    setSubmitting(false);
    if (error) {
      if (error.message.includes("already registered")) {
        toast.error("Cet email est déjà utilisé. Connectez-vous.");
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success("Compte créé ! Vous êtes connecté.");
      navigate({ to: "/dashboard" });
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-hero px-4 py-12">
      <div className="grid w-full max-w-5xl gap-10 lg:grid-cols-[1fr_440px]">
        {/* Left side – brand promise */}
        <div className="hidden flex-col justify-center lg:flex">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <Sparkles className="h-3 w-3 text-accent" /> Banque nouvelle génération
          </div>
          <h1 className="mt-6 font-serif text-5xl font-medium leading-[1.05] tracking-tight">
            Bienvenue sur<br /><span className="text-gradient">HSC Bank</span>
          </h1>
          <p className="mt-6 max-w-md text-lg text-muted-foreground">
            Connectez-vous pour suivre vos demandes de prêt, signer vos contrats et gérer vos virements en quelques secondes.
          </p>
          <ul className="mt-8 space-y-3 text-sm">
            <li className="flex items-center gap-3"><Lock className="h-4 w-4 text-accent" /> Authentification chiffrée TLS 1.3</li>
            <li className="flex items-center gap-3"><ShieldCheck className="h-4 w-4 text-accent" /> Conformité RGPD & DSP2</li>
            <li className="flex items-center gap-3"><Sparkles className="h-4 w-4 text-accent" /> Décision sous 24h</li>
          </ul>
        </div>

        {/* Right side – form */}
        <div>
          <div className="mb-8 text-center lg:hidden">
            <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-primary shadow-glow">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 17L9 11L13 15L21 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M15 7H21V13" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h1 className="font-serif text-3xl font-medium">HSC Bank</h1>
            <p className="mt-1 text-sm text-muted-foreground">Connectez-vous ou créez votre compte.</p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-elevated md:p-8">
            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Connexion</TabsTrigger>
                <TabsTrigger value="signup">Inscription</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="mt-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input id="signin-email" name="email" type="email" required autoComplete="email" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Mot de passe</Label>
                    <Input id="signin-password" name="password" type="password" required autoComplete="current-password" />
                  </div>
                  <Button type="submit" className="h-11 w-full shadow-glow" disabled={submitting}>
                    {submitting ? "Connexion..." : "Se connecter"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="mt-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="su-fullname">Nom complet</Label>
                    <Input id="su-fullname" name="fullName" required autoComplete="name" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-phone">Téléphone</Label>
                    <Input id="su-phone" name="phone" type="tel" required autoComplete="tel" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-email">Email</Label>
                    <Input id="su-email" name="email" type="email" required autoComplete="email" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="su-password">Mot de passe</Label>
                    <Input id="su-password" name="password" type="password" required autoComplete="new-password" minLength={8} />
                    <p className="text-xs text-muted-foreground">8 caractères minimum.</p>
                  </div>
                  <Button type="submit" className="h-11 w-full shadow-glow" disabled={submitting}>
                    {submitting ? "Création..." : "Créer mon compte"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            En continuant, vous acceptez les conditions d'utilisation et la politique de confidentialité.
          </p>
        </div>
      </div>
    </div>
  );
}
