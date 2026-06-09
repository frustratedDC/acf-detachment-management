import { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Download, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const TEMPLATE_HEADERS = "Date,SerialNo,Type,AccountType,Amount,Details,VoucherNo,IsNAAFI,AssignedPNumber,AssignedName";
const TEMPLATE_EXAMPLE = "2026-01-15,RV-001,RV,PettyCash,50.00,NAAFI takings,NAAFI,true,,\n2026-01-15,PV-001,PV,Bank,120.00,Training equipment,CHQ-001,false,P001234,Sgt Smith";

function downloadTemplate() {
  const csv = TEMPLATE_HEADERS + "\n" + TEMPLATE_EXAMPLE;
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "accounts_import_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function parseCSV(text) {
  const lines = text.trim().split("\n");
  if (lines.length < 2) throw new Error("File must have a header row and at least one data row.");
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/\s+/g, ""));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    // Handle quoted fields
    const cols = [];
    let cur = "", inQuote = false;
    for (const ch of line + ",") {
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === "," && !inQuote) { cols.push(cur.trim()); cur = ""; }
      else { cur += ch; }
    }
    const row = {};
    headers.forEach((h, idx) => { row[h] = cols[idx] ?? ""; });
    rows.push(row);
  }
  return rows;
}

const VALID_TYPES = new Set(["RV", "PV"]);
const VALID_ACCOUNTS = new Set(["PettyCash", "Bank"]);

function validateRow(row, idx) {
  const errors = [];
  if (!row.date) errors.push("Missing Date");
  if (!row.serialno) errors.push("Missing SerialNo");
  if (!VALID_TYPES.has(row.type)) errors.push(`Invalid Type '${row.type}' (must be RV or PV)`);
  if (!VALID_ACCOUNTS.has(row.accounttype)) errors.push(`Invalid AccountType '${row.accounttype}' (must be PettyCash or Bank)`);
  const amt = parseFloat(row.amount);
  if (isNaN(amt) || amt <= 0) errors.push(`Invalid Amount '${row.amount}'`);
  if (!row.details) errors.push("Missing Details");
  return errors;
}

function toRecord(row) {
  return {
    Date: row.date,
    SerialNo: row.serialno,
    Type: row.type,
    AccountType: row.accounttype,
    Amount: parseFloat(parseFloat(row.amount).toFixed(2)),
    Details: row.details,
    VoucherNo: row.voucherno || "",
    IsNAAFI: row.isnaafi?.toLowerCase() === "true",
    AssignedPNumber: row.assignedpnumber || "",
    AssignedName: row.assignedname || "",
  };
}

export default function CSVImportPanel({ onImported }) {
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(null); // { rows, errors }
  const [importing, setImporting] = useState(false);

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = parseCSV(ev.target.result);
        const errors = [];
        parsed.forEach((row, i) => {
          const errs = validateRow(row, i);
          if (errs.length) errors.push({ row: i + 2, errs });
        });
        setPreview({ rows: parsed, errors });
      } catch (err) {
        toast.error("CSV parse error: " + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  async function handleImport() {
    if (!preview || preview.errors.length > 0) return;
    setImporting(true);
    const records = preview.rows.map(toRecord);
    let success = 0;
    for (const rec of records) {
      await base44.entities.Accounts.create(rec);
      success++;
    }
    setImporting(false);
    setPreview(null);
    toast.success(`${success} transaction${success !== 1 ? "s" : ""} imported successfully.`);
    onImported?.();
  }

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Upload className="w-4 h-4 text-primary" />
          CSV Import
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-1.5">
            <Download className="w-3.5 h-3.5" />Download Import Template
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="gap-1.5">
            <Upload className="w-3.5 h-3.5" />Select CSV File
          </Button>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
        </div>

        {preview && (
          <div className="space-y-3">
            {preview.errors.length > 0 ? (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 space-y-1">
                <p className="text-sm font-semibold text-destructive flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />Validation errors — fix before importing
                </p>
                {preview.errors.map(e => (
                  <p key={e.row} className="text-xs text-destructive">Row {e.row}: {e.errs.join("; ")}</p>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-chart-2/40 bg-chart-2/5 p-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-chart-2" />
                <span className="text-sm text-chart-2 font-medium">
                  {preview.rows.length} row{preview.rows.length !== 1 ? "s" : ""} ready to import
                </span>
                <Button size="sm" className="ml-auto gap-1.5" onClick={handleImport} disabled={importing}>
                  <Upload className="w-3.5 h-3.5" />
                  {importing ? "Importing…" : "Import Now"}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}