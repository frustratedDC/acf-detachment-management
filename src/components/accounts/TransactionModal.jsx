import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

function nextSerial(entries, type) {
  const matching = entries.filter(e => e.Type === type && e.SerialNo?.startsWith(type + "-"));
  if (matching.length === 0) return `${type}-001`;
  const nums = matching.map(e => {
    const n = parseInt(e.SerialNo.split("-")[1] || "0", 10);
    return isNaN(n) ? 0 : n;
  });
  const next = Math.max(...nums) + 1;
  return `${type}-${String(next).padStart(3, "0")}`;
}

export default function TransactionModal({ open, onClose, entries, onSaved }) {
  const [type, setType] = useState("RV");
  const [accountType, setAccountType] = useState("PettyCash");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [amount, setAmount] = useState("");
  const [details, setDetails] = useState("");
  const [voucherNo, setVoucherNo] = useState("");
  const [isNAAFI, setIsNAAFI] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedEntry, setSavedEntry] = useState(null);

  const serialNo = nextSerial(entries, type);

  useEffect(() => {
    if (!open) { setSavedEntry(null); }
  }, [open]);

  useEffect(() => {
    if (isNAAFI) {
      setDetails("Canteen / NAAFI Receipts");
      setVoucherNo("NAAFI");
      setType("RV");
    } else {
      if (details === "Canteen / NAAFI Receipts") setDetails("");
      if (voucherNo === "NAAFI") setVoucherNo("");
    }
  }, [isNAAFI]);

  async function handleSubmit() {
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount.");
      return;
    }
    if (!details.trim()) { toast.error("Details are required."); return; }
    if (!voucherNo.trim() && !isNAAFI) { toast.error("Voucher / Cheque number is required for non-NAAFI entries."); return; }

    setSaving(true);
    const record = {
      Date: date,
      SerialNo: serialNo,
      Details: details.trim(),
      VoucherNo: voucherNo.trim() || "NAAFI",
      Type: type,
      AccountType: accountType,
      Amount: parseFloat(parseFloat(amount).toFixed(2)),
      IsNAAFI: isNAAFI,
    };
    const saved = await base44.entities.Accounts.create(record);
    setSaving(false);
    toast.success(`${serialNo} saved.`);
    onSaved(saved);
    setSavedEntry({ ...record, id: saved.id });
    if (isNAAFI) { handleClose(); }
  }

  function handleClose() {
    setType("RV"); setAccountType("PettyCash");
    setDate(format(new Date(), "yyyy-MM-dd"));
    setAmount(""); setDetails(""); setVoucherNo("");
    setIsNAAFI(false); setSavedEntry(null);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Transaction</DialogTitle>
        </DialogHeader>

        {savedEntry && !isNAAFI ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-sm text-green-800">
              Entry <strong>{savedEntry.SerialNo}</strong> saved successfully.
            </div>
            <VoucherPreview entry={savedEntry} />
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setSavedEntry(null)}>Add Another</Button>
              <Button className="flex-1" onClick={handleClose}>Done</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* NAAFI Toggle */}
            <div className="flex items-center justify-between rounded-lg border bg-amber-50 border-amber-200 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-amber-900">Internal NAAFI Tuck Shop Entry Only</p>
                <p className="text-xs text-amber-700">Bypasses receipt generation</p>
              </div>
              <Switch checked={isNAAFI} onCheckedChange={setIsNAAFI} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Transaction Type</Label>
                <Select value={type} onValueChange={setType} disabled={isNAAFI}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RV">RV — Receipt (Income)</SelectItem>
                    <SelectItem value="PV">PV — Payment (Expense)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Account</Label>
                <Select value={accountType} onValueChange={setAccountType}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PettyCash">Petty Cash</SelectItem>
                    <SelectItem value="Bank">Bank</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date</Label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Amount (£)</Label>
                <Input type="number" min="0" step="0.01" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} className="mt-1" />
              </div>
            </div>

            <div>
              <Label>Details</Label>
              <Input value={details} onChange={e => setDetails(e.target.value)} placeholder="Description of transaction" className="mt-1" readOnly={isNAAFI} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Voucher / Cheque No.</Label>
                <Input value={voucherNo} onChange={e => setVoucherNo(e.target.value)} placeholder="e.g. 0042 or CHQ-123" className="mt-1" readOnly={isNAAFI} />
              </div>
              <div>
                <Label>Serial No. (auto)</Label>
                <Input value={serialNo} readOnly className="mt-1 bg-muted text-muted-foreground" />
              </div>
            </div>

            <Button className="w-full" onClick={handleSubmit} disabled={saving}>
              {saving ? "Saving…" : "Save Transaction"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function VoucherPreview({ entry }) {
  function handlePrint() {
    const html = buildVoucherHtml(entry);
    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
    win.print();
  }

  return (
    <div className="border rounded-lg p-4 text-sm space-y-3">
      <div className="text-center border-b pb-2">
        <p className="font-bold text-base uppercase tracking-widest">Detachment Accounts</p>
        <p className="text-muted-foreground text-xs">{entry.Type === "RV" ? "RECEIPT VOUCHER" : "PAYMENT VOUCHER"}</p>
      </div>
      <table className="w-full text-xs">
        <tbody>
          <tr><td className="font-semibold w-28">Serial No.</td><td>{entry.SerialNo}</td></tr>
          <tr><td className="font-semibold">Date</td><td>{entry.Date}</td></tr>
          <tr><td className="font-semibold">Account</td><td>{entry.AccountType === "PettyCash" ? "Petty Cash" : "Bank"}</td></tr>
          <tr><td className="font-semibold">Voucher No.</td><td>{entry.VoucherNo}</td></tr>
        </tbody>
      </table>
      <div className="border rounded p-2 bg-muted/30">
        <p className="text-xs text-muted-foreground">Particulars</p>
        <p className="font-medium">{entry.Details}</p>
      </div>
      <div className="text-right font-bold text-lg">£{entry.Amount.toFixed(2)}</div>
      <div className="grid grid-cols-2 gap-4 pt-2 border-t text-xs">
        <div><p className="text-muted-foreground">Handled by</p><div className="border-b mt-5 border-foreground" /></div>
        <div><p className="text-muted-foreground">Witnessed by</p><div className="border-b mt-5 border-foreground" /></div>
      </div>
      <Button size="sm" variant="outline" className="w-full" onClick={handlePrint}>Download / Print Voucher Sheet</Button>
    </div>
  );
}

function buildVoucherHtml(entry) {
  return `<!DOCTYPE html><html><head><title>Voucher ${entry.SerialNo}</title>
  <style>body{font-family:Arial,sans-serif;margin:40px;font-size:13px}
  .header{text-align:center;border-bottom:2px solid #000;padding-bottom:10px;margin-bottom:20px}
  .header h2{margin:0;font-size:18px;letter-spacing:2px}
  .header p{margin:4px 0;color:#555}
  table{width:100%;border-collapse:collapse;margin-bottom:16px}
  td{padding:4px 8px}td:first-child{font-weight:bold;width:140px}
  .particulars{border:1px solid #ccc;padding:12px;margin-bottom:16px;min-height:50px}
  .amount{text-align:right;font-size:22px;font-weight:bold;border-top:2px solid #000;padding-top:8px}
  .sigs{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:40px}
  .sig-line{border-bottom:1px solid #000;margin-top:40px}
  </style></head><body>
  <div class="header"><h2>DETACHMENT ACCOUNTS</h2>
  <p>${entry.Type === "RV" ? "RECEIPT VOUCHER" : "PAYMENT VOUCHER"}</p></div>
  <table>
  <tr><td>Serial No.</td><td>${entry.SerialNo}</td></tr>
  <tr><td>Date</td><td>${entry.Date}</td></tr>
  <tr><td>Account</td><td>${entry.AccountType === "PettyCash" ? "Petty Cash" : "Bank"}</td></tr>
  <tr><td>Voucher / Cheque No.</td><td>${entry.VoucherNo}</td></tr>
  </table>
  <div class="particulars"><strong>Particulars:</strong><br/>${entry.Details}</div>
  <div class="amount">TOTAL: £${entry.Amount.toFixed(2)}</div>
  <div class="sigs">
  <div><p>Handled by</p><div class="sig-line"></div></div>
  <div><p>Witnessed by</p><div class="sig-line"></div></div>
  </div></body></html>`;
}