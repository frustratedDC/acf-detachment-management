import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { usePersonnel } from "@/lib/usePersonnel";
import PageHeader from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, FileDown, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { generatePaymentReceiptPDF } from "@/lib/generatePaymentReceiptPDF";

export default function MyPayments() {
  const { personnel } = usePersonnel();
  const pnum = personnel?.PNumber;

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["my-payments", pnum],
    queryFn: () => base44.entities.Accounts.filter({ AssignedPNumber: pnum }),
    enabled: !!pnum,
  });

  // Fetch all personnel to find who created each receipt (created_by_id → LinkedEmailUID match)
  const { data: allPersonnel = [] } = useQuery({
    queryKey: ["personnel-all"],
    queryFn: () => base44.entities.PersonnelManager.list(),
  });

  // Fetch detachment settings for DC name/title
  const { data: settings = [] } = useQuery({
    queryKey: ["det-settings"],
    queryFn: () => base44.entities.DetachmentSettings.list(),
  });

  const sorted = useMemo(
    () => [...payments].sort((a, b) => b.Date.localeCompare(a.Date)),
    [payments]
  );

  const total = useMemo(
    () => payments.reduce((s, p) => s + (p.Amount || 0), 0),
    [payments]
  );

  function getSettingValue(key) {
    return settings.find(s => s.Key === key)?.Value || "";
  }

  function handleDownload(payment) {
    const dcRank = getSettingValue("dc_rank") || "";
    const dcName = getSettingValue("dc_name") || "";
    const dcTitle = getSettingValue("dc_title") || "Detachment Commander";

    // Find the creator by matching created_by_id to LinkedEmailUID
    const creator = allPersonnel.find(p => p.LinkedEmailUID === payment.created_by_id);
    const creatorName = creator
      ? `${creator.Rank ? creator.Rank + " " : ""}${creator.FirstName || ""} ${creator.Surname}`.trim()
      : "";

    generatePaymentReceiptPDF({
      payment,
      paidByName: payment.AssignedName || `${personnel?.Rank ? personnel.Rank + " " : ""}${personnel?.FirstName || ""} ${personnel?.Surname || ""}`.trim(),
      creatorName,
      dcRank,
      dcName,
      dcTitle,
    });
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="My Payments"
        description="A record of payments you have made to the detachment"
        icon={CreditCard}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : sorted.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CreditCard className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No payment records found for your account.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="inline-block px-4 py-2 rounded-lg bg-primary/10 text-primary font-semibold text-sm">
            Total Payments: £{total.toFixed(2)}
          </div>

          <div className="space-y-3">
            {sorted.map(p => (
              <Card key={p.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                    p.Type === "RV" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  }`}>
                    {p.Type}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{p.Details}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {p.SerialNo}
                      {p.Date && <> &nbsp;·&nbsp; {format(new Date(p.Date + "T00:00:00"), "d MMMM yyyy")}</>}
                      {p.VoucherNo && <> &nbsp;·&nbsp; Voucher: {p.VoucherNo}</>}
                    </p>
                  </div>

                  <span className={`text-base font-bold shrink-0 mr-3 ${p.Type === "RV" ? "text-green-700" : "text-red-700"}`}>
                    {p.Type === "RV" ? "+" : "-"}£{(p.Amount || 0).toFixed(2)}
                  </span>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownload(p)}
                    className="shrink-0"
                  >
                    <FileDown className="w-3.5 h-3.5 mr-1" />Receipt
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}