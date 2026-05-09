import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { KeyRound, Send, CheckCircle2, Lock } from "lucide-react";
import { formatCurrency } from "@/lib/loan-helpers";
import { notifyUser } from "@/lib/notifications";

interface UnlockCodeRow {
  id: string; loan_id: string; user_id: string; step: number; fee_amount: number;
  code: string; used: boolean; released: boolean; released_at: string | null;
}
interface LoanLite { id: string; user_id: string; full_name: string; email: string; amount: number; }

const STEPS = [63, 88, 100] as const;
function rndCode() {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const pick = (n: number) => Array.from({ length: n }, () => a[Math.floor(Math.random() * a.length)]).join("");
  return `${pick(4)}-${pick(4)}`;
}

export function AdminUnlockCodes({ loan }: { loan: LoanLite }) {
  const { t } = useTranslation();
  const [codes, setCodes] = useState<UnlockCodeRow[]>([]);
  const [fees, setFees] = useState<Record<number, string>>({ 63: "", 88: "", 100: "" });
  const [busy, setBusy] = useState<number | null>(null);

  useEffect(() => {
    if (!loan?.id) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loan?.id]);

  async function load() {
    const { data } = await supabase.from("loan_unlock_codes" as any).select("*").eq("loan_id", loan.id).order("step");
    const rows = (data as unknown as UnlockCodeRow[]) ?? [];
    setCodes(rows);
    setFees((prev) => ({
      63: rows.find((r) => r.step === 63)?.fee_amount?.toString() ?? prev[63] ?? "",
      88: rows.find((r) => r.step === 88)?.fee_amount?.toString() ?? prev[88] ?? "",
      100: rows.find((r) => r.step === 100)?.fee_amount?.toString() ?? prev[100] ?? "",
    }));
  }

  async function generateAndSend(step: number) {
    const fee = Number(fees[step]);
    if (!Number.isFinite(fee) || fee < 0) { toast.error(t("adminCodes.invalidFee")); return; }
    setBusy(step);
    const newCode = rndCode();
    const existing = codes.find((c) => c.step === step);
    if (existing) {
      await supabase.from("loan_unlock_codes" as any).update({
        fee_amount: fee, code: newCode, used: false, released: true, released_at: new Date().toISOString(),
      }).eq("id", existing.id);
    } else {
      await supabase.from("loan_unlock_codes" as any).insert({
        loan_id: loan.id, user_id: loan.user_id, step, fee_amount: fee, code: newCode, released: true, released_at: new Date().toISOString(),
      });
    }
    await notifyUser({
      userId: loan.user_id,
      title: t("adminCodes.notifTitle", { p: step }),
      message: t("adminCodes.notifMsg", { code: newCode, fee: formatCurrency(fee) }),
      link: "/dashboard",
      category: "info",
    });
    setBusy(null);
    toast.success(t("adminCodes.sent"));
    void load();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <KeyRound className="h-4 w-4" /> {t("adminCodes.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">{t("adminCodes.help")}</p>
        {STEPS.map((s) => {
          const row = codes.find((c) => c.step === s);
          return (
            <div key={s} className="rounded-xl border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm">{t("adminCodes.step")} {s}%</span>
                {row?.used ? (
                  <span className="text-xs inline-flex items-center gap-1 text-success"><CheckCircle2 className="h-3 w-3"/> {t("adminCodes.used")}</span>
                ) : row?.released ? (
                  <span className="text-xs inline-flex items-center gap-1 text-info"><Lock className="h-3 w-3"/> {t("adminCodes.released")}</span>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">{t("adminCodes.fee")} (€)</Label>
                  <Input type="number" min={0} step="0.01" value={fees[s]} onChange={(e) => setFees((p) => ({ ...p, [s]: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">{t("adminCodes.code")}</Label>
                  <Input value={row?.code ?? ""} disabled className="font-mono uppercase bg-muted/30" placeholder="—" />
                </div>
              </div>
              <Button size="sm" className="w-full" disabled={busy === s} onClick={() => generateAndSend(s)}>
                <Send className="mr-2 h-3.5 w-3.5" />
                {row?.code ? t("adminCodes.regenerate") : t("adminCodes.generate")}
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
