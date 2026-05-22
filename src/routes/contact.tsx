import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Mail, Phone, MapPin, Send, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import hsbcLogo from "@/assets/hsbc-logo.png";

export const Route = createFileRoute("/contact")({
  component: ContactPage,
  head: () => ({
    meta: [
      { title: "Contact — Service client HSBC BANK" },
      {
        name: "description",
        content:
          "Contactez le service client HSBC BANK pour toute question sur votre compte, vos prêts ou vos virements.",
      },
    ],
  }),
});

const SUBJECTS = [
  "Question sur mon compte",
  "Question sur un prêt",
  "Problème de virement",
  "Réclamation",
  "Demande de rendez-vous",
  "Autre",
];

function ContactPage() {
  const { user } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    setEmail(user.email ?? "");
    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data?.full_name) setFullName(data.full_name);
    })();
  }, [user]);

  async function submit() {
    const schema = z.object({
      full_name: z.string().trim().min(2, "Nom requis").max(120),
      email: z.string().trim().email("Email invalide").max(180),
      subject: z.string().trim().min(2).max(180),
      message: z.string().trim().min(10, "Message trop court (10 caractères min)").max(4000),
    });
    const parsed = schema.safeParse({ full_name: fullName, email, subject, message });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    const { error } = await ((supabase as any).from("contact_messages")).insert({
      user_id: user?.id ?? null,
      full_name: parsed.data.full_name,
      email: parsed.data.email,
      subject: parsed.data.subject,
      message: parsed.data.message,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message || "Échec de l'envoi");
      return;
    }
    toast.success("Message envoyé · le service client vous répondra sous 24h");
    setMessage("");
  }

  return (
    <div className="container mx-auto px-4 py-6 sm:py-10 max-w-5xl pb-28 lg:pb-10">
      <div className="mb-4 hidden sm:block">
        <Button asChild variant="ghost" size="sm">
          <Link to={user ? "/dashboard" : "/"}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Retour
          </Link>
        </Button>
      </div>

      <div className="flex items-start gap-4 mb-8">
        <img src={hsbcLogo} alt="HSBC BANK" width={56} height={56} className="h-11 w-11 sm:h-14 sm:w-14 rounded-md bg-white p-1 shadow-sm" />
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-serif text-primary">Contactez le service client</h1>
          <p className="text-muted-foreground mt-1">
            Notre équipe vous répond sous 24h ouvrées · confidentialité garantie.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1 h-fit">
          <CardHeader>
            <CardTitle className="text-base">Coordonnées</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-start gap-3">
              <Phone className="h-4 w-4 mt-0.5 text-primary shrink-0" />
              <div>
                <p className="font-medium">Service client</p>
                <a
                  href="https://wa.me/447529529674"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary hover:underline transition cursor-pointer">+44 7529 529674</a>
                <p className="text-xs text-muted-foreground">Lun-Ven · 8h-20h</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Mail className="h-4 w-4 mt-0.5 text-primary shrink-0" />
              <div>
                <p className="font-medium">Email</p>
                <a
                 href="mailto:info@hsbc-bank" 
                 className="text-muted-foreground hover:text-primary hover:underline transition break-all cursor-pointer">info@hsbc-bank.fr</a>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="h-4 w-4 mt-0.5 text-primary shrink-0" />
              <div>
                <p className="font-medium">Siège social</p>
                <a 
                  href="https://www.google.com/maps/search/?api=1&query=103+avenue+des+Champs-Élysées+75008+Paris"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary hover:underline transition cursor-pointer">103 avenue des Champs-Élysées<br />75008 Paris, France</a>
              </div>
            </div>
            <div className="rounded-lg bg-secondary p-3 text-xs text-muted-foreground flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 text-success shrink-0 mt-0.5" />
              <p>
                Vos messages sont chiffrés et traités confidentiellement par notre service conformité.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Envoyer un message</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Nom complet *</Label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1.5"
                  placeholder="Jean Dupont"
                />
              </div>
              <div>
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5"
                  placeholder="vous@exemple.fr"
                />
              </div>
            </div>
            <div>
              <Label>Sujet *</Label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUBJECTS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Message *</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={7}
                maxLength={4000}
                className="mt-1.5"
                placeholder="Décrivez votre demande en détail…"
              />
              <p className="mt-1 text-xs text-muted-foreground text-right">
                {message.length} / 4000
              </p>
            </div>
            <div className="pt-2 flex justify-stretch sm:justify-end">
              <Button onClick={submit} disabled={busy} className="w-full sm:w-auto shadow-glow">
                {busy ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-1.5" />
                )}
                Envoyer le message
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
