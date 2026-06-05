import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, Plus, Download, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import LedgerTable from "@/components/accounts/LedgerTable";
import TransactionModal from "@/components/accounts/TransactionModal";

function computeSummary(entries, pcBF, bankBF) {
  let pc = parseFloat(pcBF) || 0;
  let bank = parseFloat(bankBF) || 0;
  entries.forEach(e => {
    const isPettyCash = e.AccountType === "PettyCash";
    const isBank = e.AccountType === "Bank";
    const isCredit = e.Type === "RV";
    if (isPettyCash) pc += isCredit ? e.Amount : -e.Amount;
    if (isBank) bank += isCredit ? e.Amount : -e.Amount;
  });
  return { pc, bank };
}

function exportCSV(entries, pcBF, bankBF, startDate, endDate) {
  let pcBal = parseFloat(pcBF) || 0;
  let bankBal = parseFloat(bankBF) || 0;

  const filtered = entries.filter(e => {
    if (startDate && e.Date < startDate) return false;
    if (endDate && e.Date > endDate) return false;
    return true;
  });

  const rows = filtered.map(e => {
    const isPettyCash = e.AccountType === "PettyCash";
    const isBank = e.AccountType === "Bank";
    const isCredit = e.Type === "RV";
    const pcCredit = isPettyCash && isCredit ? e.Amount : "";
    const pcDebit = isPettyCash && !isCredit ? e.Amount : "";
    const bankCredit = isBank && isCredit ? e.Amount : "";
    const bankDebit = isBank && !isCredit ? e.Amount : "";
    if (isPettyCash) pcBal += (isPettyCash && isCredit ? e.Amount : 0) - (isPettyCash && !isCredit ? e.Amount : 0);
    if (isBank) bankBal += (isBank && isCredit ? e.Amount : 0) - (isBank && !isCredit ? e.Amount : 0);
    return [e.Date, e.SerialNo, `"${(e.Details || "").replace(/"/g, '""')}"`, e.VoucherNo || "", pcCredit, pcDebit, pcBal.toFixed(2), bankCredit, bankDebit, bankBal.toFixed(2)].join(",");
  });

  const header = "DATE,SERIAL NO,DETAILS,VOUCHER OR CHEQUE NO,PETTY CASH CREDIT,PETTY CASH DEBIT,PETTY CASH BALANCE,BANK CREDIT,BANK DEBIT,BANK BALANCE";
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `accounts_${startDate || "start"}_to_${endDate || "end"}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AccountsLedger() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [pcBroughtForward, setPcBroughtForward] = useState("0.00");
  const [bankBroughtForward, setBankBroughtForward] = useState("0.00");
  const [exportStart, setExportStart] = useState(format(new Date(new Date().getFullYear(), 0, 1), "yyyy-MM-dd"));
  const [exportEnd, setExportEnd] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => base44.entities.Accounts.list("Date", 500),
  });

  const sorted = useMemo(() => [...entries].sort((a, b) => a.Date.localeCompare(b.Date) || a.SerialNo.localeCompare(b.SerialNo)), [entries]);

  const { pc: pcBalance, bank: bankBalance } = useMemo(() => computeSummary(sorted, pcBroughtForward, bankBroughtForward), [sorted, pcBroughtForward, bankBroughtForward]);

  function handleSaved() {
    queryClient.invalidateQueries({ queryKey: ["accounts"] });
  }

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Detachment Accounts"
        description="Cash & Bank ledger with double-entry running balances"
        icon={BookOpen}
        actions={
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />New Transaction
          </Button>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Petty Cash Balance</p>
            <p className={`text-2xl font-bold ${pcBalance < 0 ? "text-red-600" : "text-green-700"}`}>
              £{pcBalance.toFixed(2)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Bank Balance</p>
            <p className={`text-2xl font-bold ${bankBalance < 0 ? "text-red-600" : "text-green-700"}`}>
              £{bankBalance.toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Brought Forward + Export Controls */}
      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-6 items-end">
            <div>
              <p className="text-sm font-semibold mb-2">Balances Brought Forward</p>
              <div className="flex gap-3">
                <div>
                  <Label className="text-xs">Petty Cash (£)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={pcBroughtForward}
                    onChange={e => setPcBroughtForward(e.target.value)}
                    className="mt-1 w-28"
                  />
                </div>
                <div>
                  <Label className="text-xs">Bank (£)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={bankBroughtForward}
                    onChange={e => setBankBroughtForward(e.target.value)}
                    className="mt-1 w-28"
                  />
                </div>
              </div>
            </div>

            <div className="border-l pl-6">
              <p className="text-sm font-semibold mb-2">Export to CSV</p>
              <div className="flex gap-2 items-end flex-wrap">
                <div>
                  <Label className="text-xs">Start Date</Label>
                  <Input type="date" value={exportStart} onChange={e => setExportStart(e.target.value)} className="mt-1 w-36" />
                </div>
                <div>
                  <Label className="text-xs">End Date</Label>
                  <Input type="date" value={exportEnd} onChange={e => setExportEnd(e.target.value)} className="mt-1 w-36" />
                </div>
                <Button variant="outline" onClick={() => exportCSV(sorted, pcBroughtForward, bankBroughtForward, exportStart, exportEnd)}>
                  <Download className="w-4 h-4 mr-1.5" />Export Selected Range to CSV
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ledger */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <LedgerTable
          entries={sorted}
          pcBroughtForward={pcBroughtForward}
          bankBroughtForward={bankBroughtForward}
        />
      )}

      <TransactionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        entries={sorted}
        onSaved={handleSaved}
      />
    </div>
  );
}