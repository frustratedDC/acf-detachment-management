import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard } from "lucide-react";
import { format } from "date-fns";

export default function MyPaymentsWidget({ pnum }) {
  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["my-payments", pnum],
    queryFn: () => base44.entities.Accounts.filter({ AssignedPNumber: pnum }),
    enabled: !!pnum,
  });

  if (isLoading) return null;
  if (!payments.length) return null;

  const sorted = [...payments].sort((a, b) => b.Date.localeCompare(a.Date));
  const total = payments.reduce((s, p) => s + (p.Amount || 0), 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-primary" />
          My Payments
          <Badge variant="secondary" className="ml-auto">{payments.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-sm text-muted-foreground mb-3">
          Total assigned: <span className="font-bold text-foreground">£{total.toFixed(2)}</span>
        </div>
        {sorted.map(p => (
          <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
              p.Type === "RV" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
            }`}>
              {p.Type}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{p.Details}</p>
              <p className="text-xs text-muted-foreground">
                {p.SerialNo} &nbsp;·&nbsp;
                {p.Date && format(new Date(p.Date + "T00:00:00"), "d MMM yyyy")}
                {p.VoucherNo && <> &nbsp;·&nbsp; Vchr: {p.VoucherNo}</>}
              </p>
            </div>
            <span className={`text-sm font-bold shrink-0 ${p.Type === "RV" ? "text-green-700" : "text-red-700"}`}>
              {p.Type === "RV" ? "+" : "-"}£{(p.Amount || 0).toFixed(2)}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}