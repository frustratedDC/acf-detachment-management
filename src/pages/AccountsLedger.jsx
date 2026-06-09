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
import AccountsSettingsPanel from "@/components/accounts/AccountsSettingsPanel";
import CSVImportPanel from "@/components/accounts/CSVImportPanel";

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
    return [
      e.Date, e.SerialNo, `"${(e.Details || "").replace(/"/g, '""')}"`,
      e.VoucherNo || "", pcCredit, pcDebit, pcBal.toFixed(2),
      bankCredit, bankDebit, bankBal.toFixed(2),
      e.AssignedPNumber || "", `"${(e.AssignedName || "").replace(/"/g, '""')}"`
    ].join(",");
  });

  const header = "DATE,SERIAL NO,DETAILS,VOUCHER OR CHEQUE NO,PETTY CASH CREDIT,PETTY CASH DEBIT,PETTY CASH BALANCE,BANK CREDIT,BANK DEBIT,BANK BALANCE,ASSIGNED PNUMBER,ASSIGNED NAME";
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `accounts_${startDate || "start"}_to_${endDate || "end"}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const PAGE_SIZE = 30;

export default function AccountsLedger() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [settings, setSettings] = useState({ pcBF: "0.00", bankBF: "0.00", rvStart: "1", pvStart: "1" });
  const [exportStart, setExportStart] = useState(format(new Date(new Date().getFullYear(), 0, 1), "yyyy-MM-dd"));
  const [exportEnd, setExportEnd] = useState(format(new Date(), "yyyy-MM-dd"));
  const [page, setPage] = useState(1);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => base44.entities.Accounts.list("Date", 2000),
  });

  const sorted = useMemo(() =>
    [...entries].sort((a, b) => a.Date.localeCompare(b.Date) || (a.SerialNo || "").localeCompare(b.SerialNo || "")),
    [entries]
  );

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated = useMemo(() => sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [sorted, page]);

  // Compute running balance up to start of current page so LedgerTable starts correctly
  const bfForPage = useMemo(() => {
    let pc = parseFloat(settings.pcBF) || 0;
    let bank = parseFloat(settings.bankBF) || 0;
    const prior = sorted.slice(0, (page - 1) * PAGE_SIZE);
    prior.forEach(e => {
      const isCredit = e.Type === "RV";
      if (e.AccountType === "PettyCash") pc += isCredit ? e.Amount : -e.Amount;
      if (e.AccountType === "Bank") bank += isCredit ? e.Amount : -e.Amount;
    });
    return { pc: pc.toFixed(2), bank: bank.toFixed(2) };
  }, [sorted, page, settings]);

  // Overall balances for summary cards (always from full sorted set)
  const { pc: pcBalance, bank: bankBalance } = useMemo(() => {
    let pc = parseFloat(settings.pcBF) || 0;
    let bank = parseFloat(settings.bankBF) || 0;
    sorted.forEach(e => {
      const isCredit = e.Type === "RV";
      if (e.AccountType === "PettyCash") pc += isCredit ? e.Amount : -e.Amount;
      if (e.AccountType === "Bank") bank += isCredit ? e.Amount : -e.Amount;
    });
    return { pc, bank };
  }, [sorted, settings]);

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

      {/* Opening Balances & Starting Serials */}
      <AccountsSettingsPanel onSettingsChange={setSettings} />

      {/* CSV Import */}
      <CSVImportPanel onImported={handleSaved} />

      {/* Export Controls */}
      <Card className="mb-6">
        <CardContent className="pt-4">
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
            <Button variant="outline" onClick={() => exportCSV(sorted, settings.pcBF, settings.bankBF, exportStart, exportEnd)}>
              <Download className="w-4 h-4 mr-1.5" />Export Selected Range
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Ledger */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <LedgerTable
            entries={paginated}
            pcBroughtForward={bfForPage.pc}
            bankBroughtForward={bfForPage.bank}
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-muted-foreground">
                Page {page} of {totalPages} &nbsp;·&nbsp; {sorted.length} total entries
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(1)}>First</Button>
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
                <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
                <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(totalPages)}>Last</Button>
              </div>
            </div>
          )}
        </>
      )}

      <TransactionModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        entries={sorted}
        onSaved={handleSaved}
        settings={settings}
      />
    </div>
  );
}