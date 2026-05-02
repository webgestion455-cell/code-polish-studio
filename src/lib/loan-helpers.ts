import type { Database } from "@/integrations/supabase/types";

export type LoanStatus = Database["public"]["Enums"]["loan_status"];

export const STATUS_LABELS: Record<LoanStatus, string> = {
  en_attente: "En attente",
  accepte: "Accepté",
  refuse: "Refusé",
  contrat_envoye: "Contrat envoyé",
  contrat_signe: "Contrat signé",
  en_traitement: "En traitement",
  fonds_disponibles: "Fonds disponibles",
};

export const STATUS_DESCRIPTIONS: Record<LoanStatus, string> = {
  en_attente: "Votre demande est en cours d'examen par notre équipe.",
  accepte: "Bonne nouvelle ! Votre demande a été acceptée.",
  refuse: "Votre demande n'a pas pu être acceptée cette fois-ci.",
  contrat_envoye: "Votre contrat est prêt. Téléchargez, signez et renvoyez-le.",
  contrat_signe: "Contrat signé reçu. Traitement en cours sous 24-72h.",
  en_traitement: "Vos fonds sont en cours de transfert (24-72h).",
  fonds_disponibles: "Vos fonds sont disponibles. Vous pouvez les retirer.",
};

export const STATUS_VARIANTS: Record<LoanStatus, "default" | "success" | "warning" | "destructive" | "muted"> = {
  en_attente: "warning",
  accepte: "success",
  refuse: "destructive",
  contrat_envoye: "default",
  contrat_signe: "default",
  en_traitement: "warning",
  fonds_disponibles: "success",
};

export const STATUS_PROGRESS: Record<LoanStatus, number> = {
  en_attente: 15,
  accepte: 35,
  refuse: 100,
  contrat_envoye: 50,
  contrat_signe: 70,
  en_traitement: 85,
  fonds_disponibles: 100,
};

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(amount);
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(new Date(date));
}
