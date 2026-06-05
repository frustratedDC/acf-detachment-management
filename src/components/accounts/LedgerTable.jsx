import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";

function fmt(val) {
  if (val === null || val === undefined || val === "") return "";
  return `£${Number(val).toFixed(2)}`;
}

function balanceClass(val) {
  if (val < 0) return "text-red-600 font-bold";
  return "font-semibold";
}

export default function LedgerTable({ entries, pcBroughtForward, bankBroughtForward }) {
  const rows = useMemo(() => {
    let pcBal = parseFloat(pcBroughtForward) || 0;
    let bankBal = parseFloat(bankBroughtForward) || 0;

    return entries.map(e => {
      const isPettyCash = e.AccountType === "PettyCash";
      const isBank = e.AccountType === "Bank";
      const isCredit = e.Type === "RV";

      const pcCredit = isPettyCash && isCredit ? e.Amount : null;
      const pcDebit = isPettyCash && !isCredit ? e.Amount : null;
      const bankCredit = isBank && isCredit ? e.Amount : null;
      const bankDebit = isBank && !isCredit ? e.Amount : null;

      if (isPettyCash) {
        pcBal += (pcCredit || 0) - (pcDebit || 0);
      }
      if (isBank) {
        bankBal += (bankCredit || 0) - (bankDebit || 0);
      }

      return {
        ...e,
        pcCredit,
        pcDebit,
        pcBalance: pcBal,
        bankCredit,
        bankDebit,
        bankBalance: bankBal,
      };
    });
  }, [entries, pcBroughtForward, bankBroughtForward]);

  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        No transactions recorded yet. Add your first entry using the button above.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-xs min-w-[900px]">
        <thead>
          <tr className="bg-slate-800 text-white">
            <th className="px-3 py-2 text-left font-semibold">Date</th>
            <th className="px-3 py-2 text-left font-semibold">Serial No.</th>
            <th className="px-3 py-2 text-left font-semibold">Details</th>
            <th className="px-3 py-2 text-left font-semibold">Vchr / Chq No.</th>
            <th className="px-3 py-2 text-right font-semibold bg-green-900">PC Credit</th>
            <th className="px-3 py-2 text-right font-semibold bg-red-900">PC Debit</th>
            <th className="px-3 py-2 text-right font-semibold bg-slate-700">PC Balance</th>
            <th className="px-3 py-2 text-right font-semibold bg-green-900">Bank Credit</th>
            <th className="px-3 py-2 text-right font-semibold bg-red-900">Bank Debit</th>
            <th className="px-3 py-2 text-right font-semibold bg-slate-700">Bank Balance</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id || i} className={`border-t ${i % 2 === 0 ? "bg-white" : "bg-slate-50"} hover:bg-blue-50 transition-colors`}>
              <td className="px-3 py-2 whitespace-nowrap">{row.Date}</td>
              <td className="px-3 py-2 whitespace-nowrap">
                <span className={`font-mono font-semibold ${row.Type === "RV" ? "text-green-700" : "text-red-700"}`}>
                  {row.SerialNo}
                </span>
                {row.IsNAAFI && <Badge className="ml-1 text-[10px] py-0 bg-amber-100 text-amber-800 border border-amber-300">NAAFI</Badge>}
              </td>
              <td className="px-3 py-2 max-w-[180px] truncate" title={row.Details}>{row.Details}</td>
              <td className="px-3 py-2 font-mono text-muted-foreground">{row.VoucherNo}</td>
              <td className="px-3 py-2 text-right text-green-700">{fmt(row.pcCredit)}</td>
              <td className="px-3 py-2 text-right text-red-700">{fmt(row.pcDebit)}</td>
              <td className={`px-3 py-2 text-right ${balanceClass(row.pcBalance)}`}>{fmt(row.pcBalance)}</td>
              <td className="px-3 py-2 text-right text-green-700">{fmt(row.bankCredit)}</td>
              <td className="px-3 py-2 text-right text-red-700">{fmt(row.bankDebit)}</td>
              <td className={`px-3 py-2 text-right ${balanceClass(row.bankBalance)}`}>{fmt(row.bankBalance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}