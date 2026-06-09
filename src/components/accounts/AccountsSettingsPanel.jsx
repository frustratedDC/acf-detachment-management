import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Settings, Save } from "lucide-react";
import { toast } from "sonner";

const KEYS = {
  PC_BF: "accounts_pc_brought_forward",
  BANK_BF: "accounts_bank_brought_forward",
  RV_START: "accounts_rv_start",
  PV_START: "accounts_pv_start",
};

export default function AccountsSettingsPanel({ onSettingsChange }) {
  const [pcBF, setPcBF] = useState("0.00");
  const [bankBF, setBankBF] = useState("0.00");
  const [rvStart, setRvStart] = useState("1");
  const [pvStart, setPvStart] = useState("1");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const settings = await base44.entities.DetachmentSettings.filter({});
      const get = (key) => settings.find(s => s.Key === key)?.Value;
      const pc = get(KEYS.PC_BF) ?? "0.00";
      const bank = get(KEYS.BANK_BF) ?? "0.00";
      const rv = get(KEYS.RV_START) ?? "1";
      const pv = get(KEYS.PV_START) ?? "1";
      setPcBF(pc); setBankBF(bank); setRvStart(rv); setPvStart(pv);
      onSettingsChange?.({ pcBF: pc, bankBF: bank, rvStart: rv, pvStart: pv });
    }
    load();
  }, []);

  async function upsert(key, value, description) {
    const existing = await base44.entities.DetachmentSettings.filter({ Key: key });
    if (existing.length > 0) {
      await base44.entities.DetachmentSettings.update(existing[0].id, { Value: value });
    } else {
      await base44.entities.DetachmentSettings.create({ Key: key, Value: value, Description: description });
    }
  }

  async function handleSave() {
    setSaving(true);
    await Promise.all([
      upsert(KEYS.PC_BF, pcBF, "Petty cash opening balance (brought forward)"),
      upsert(KEYS.BANK_BF, bankBF, "Bank opening balance (brought forward)"),
      upsert(KEYS.RV_START, rvStart, "Starting RV serial number"),
      upsert(KEYS.PV_START, pvStart, "Starting PV serial number"),
    ]);
    setSaving(false);
    toast.success("Accounts settings saved.");
    onSettingsChange?.({ pcBF, bankBF, rvStart, pvStart });
  }

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Settings className="w-4 h-4 text-primary" />
          Opening Balances &amp; Starting Serials
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-6 items-end">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Opening Balances (Brought Forward)</p>
            <div className="flex gap-3">
              <div>
                <Label className="text-xs">Petty Cash (£)</Label>
                <Input type="number" step="0.01" value={pcBF} onChange={e => setPcBF(e.target.value)} className="mt-1 w-28" />
              </div>
              <div>
                <Label className="text-xs">Bank (£)</Label>
                <Input type="number" step="0.01" value={bankBF} onChange={e => setBankBF(e.target.value)} className="mt-1 w-28" />
              </div>
            </div>
          </div>
          <div className="border-l pl-6">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Starting Serial Numbers</p>
            <div className="flex gap-3">
              <div>
                <Label className="text-xs">RV starts at</Label>
                <Input type="number" min="1" step="1" value={rvStart} onChange={e => setRvStart(e.target.value)} className="mt-1 w-24" />
              </div>
              <div>
                <Label className="text-xs">PV starts at</Label>
                <Input type="number" min="1" step="1" value={pvStart} onChange={e => setPvStart(e.target.value)} className="mt-1 w-24" />
              </div>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5">
            <Save className="w-3.5 h-3.5" />
            {saving ? "Saving…" : "Save Settings"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export { KEYS };