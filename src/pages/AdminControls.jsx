import React, { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { usePersonnel } from '@/lib/usePersonnel';
import AccessGate from '@/components/shared/AccessGate';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Upload, Trash2, AlertTriangle, Loader2, FileUp, Users, Save, Shield, ShieldCheck, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { ACCESS_LEVELS } from '@/lib/accessLevels';

// ─── Sys Admin Section (L6 only) ───────────────────────────────────────────
function SysAdminPanel({ queryClient }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [purging, setPurging] = useState(false);
  const [auditResults, setAuditResults] = useState(null);
  const [auditMode, setAuditMode] = useState(true);
  const [densityResults, setDensityResults] = useState(null);

  async function handleSyllabusCsvUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url,
      json_schema: {
        type: "array",
        items: {
          type: "object",
          properties: {
            LessonCode: { type: "string" },
            StarLevel: { type: "string" },
            SubjectName: { type: "string" },
            LessonName: { type: "string" },
            IsMandatory: { type: "boolean" }
          }
        }
      }
    });
    if (result.status === 'success' && result.output) {
      const records = Array.isArray(result.output) ? result.output : [result.output];
      const batch = records.filter(r => r.LessonCode && r.SubjectName && r.LessonName).map(r => ({
        LessonCode: r.LessonCode,
        StarLevel: r.StarLevel || 'Basic',
        SubjectName: r.SubjectName,
        LessonName: r.LessonName,
        IsMandatory: r.IsMandatory || false,
      }));
      if (batch.length > 0) {
        for (let i = 0; i < batch.length; i += 50) {
          await base44.entities.SyllabusMaster.bulkCreate(batch.slice(i, i + 50));
        }
        toast.success(`Uploaded ${batch.length} lessons to Master Syllabus`);
        queryClient.invalidateQueries({ queryKey: ['syllabus-master-all'] });
      } else {
        toast.error('No valid records found in CSV');
      }
    } else {
      toast.error('Failed to parse CSV: ' + (result.details || 'Unknown error'));
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function purgeSyllabus() {
    if (!window.confirm('This will permanently delete ALL Master Syllabus records. Are you sure?')) return;
    setPurging(true);
    const all = await base44.entities.SyllabusMaster.filter({});
    for (const record of all) {
      await base44.entities.SyllabusMaster.delete(record.id);
    }
    queryClient.invalidateQueries({ queryKey: ['syllabus-master-all'] });
    toast.success(`Purged ${all.length} records from Master Syllabus`);
    setPurging(false);
  }

  async function auditMay31Duplicates() {
    setPurging(true);
    const all = await base44.entities.PersonnelManager.filter({});
    const pNumberMap = {};
    const duplicates = [];
    
    // Sort oldest first
    const sorted = all.sort((a, b) => {
      const dateA = new Date(a.created_date || 0);
      const dateB = new Date(b.created_date || 0);
      return dateA - dateB;
    });
    
    sorted.forEach(record => {
      if (!pNumberMap[record.PNumber]) {
        pNumberMap[record.PNumber] = record;
      } else {
        // Check if created on May 31
        const recordDate = new Date(record.created_date);
        const isMay31 = recordDate.getUTCFullYear() === 2026 && 
                        recordDate.getUTCMonth() === 4 && 
                        recordDate.getUTCDate() === 31;
        if (isMay31) {
          duplicates.push(record);
        }
      }
    });
    
    setAuditResults(duplicates);
    setAuditMode(false);
    toast.success(`Audit complete: Found ${duplicates.length} May 31 duplicates`);
    setPurging(false);
  }

  async function executeMay31Purge() {
    if (!auditResults || auditResults.length === 0) return;
    if (!window.confirm(`Delete ${auditResults.length} duplicate records? This cannot be undone.`)) return;
    
    setPurging(true);
    try {
      for (const record of auditResults) {
        await base44.entities.PersonnelManager.delete(record.id);
      }
      queryClient.invalidateQueries({ queryKey: ['all-personnel'] });
      toast.success(`Purged ${auditResults.length} duplicate records`);
      setAuditResults(null);
      setAuditMode(true);
    } catch (e) {
      toast.error(`Purge failed: ${e.message}`);
    }
    setPurging(false);
  }

  async function purgeByDataDensity(executeDelete = false) {
    console.log("🚀 Initializing Elevated Service-Role Data Density Scan...");
    const response = await base44.asServiceRole.entities.PersonnelManager.list();
    const allRecords = Array.isArray(response) ? response : (response?.data || []);
    
    if (!allRecords || allRecords.length === 0) {
      toast.info("No personnel records found");
      return null;
    }

    const calculateDataWeight = (record) => {
      let score = 0;
      if (record.StatusNotes && record.StatusNotes.trim() !== "") score += 20;
      if (Array.isArray(record.QualifiedSubjects) && record.QualifiedSubjects.length > 0) {
        score += (record.QualifiedSubjects.length * 10);
      }
      if (record.PersonnelStatus && record.PersonnelStatus !== "Active") score += 15;
      Object.keys(record).forEach(key => {
        const val = record[key];
        if (val !== null && val !== undefined && val !== "" && val !== false) {
          score += 1;
        }
      });
      return score;
    };

    const groups = {};
    allRecords.forEach(record => {
      if (!record.PNumber) return;
      if (!groups[record.PNumber]) groups[record.PNumber] = [];
      groups[record.PNumber].push({
        raw: record,
        weight: calculateDataWeight(record)
      });
    });

    const recordsToPurge = [];
    Object.keys(groups).forEach(pNumber => {
      const group = groups[pNumber];
      if (group.length > 1) {
        group.sort((a, b) => {
          if (b.weight !== a.weight) return b.weight - a.weight;
          return (a.raw.id || 0) - (b.raw.id || 0);
        });
        for (let i = 1; i < group.length; i++) {
          recordsToPurge.push({
            duplicate: group[i].raw,
            masterId: group[0].raw.id,
            masterWeight: group[0].weight,
            dupWeight: group[i].weight
          });
        }
      }
    });

    if (recordsToPurge.length === 0) {
      toast.success("No data density duplicates found");
      return null;
    }

    if (!executeDelete) {
      console.log(`🔍 Found ${recordsToPurge.length} duplicates (RLS-bypass scan complete). Run with executeDelete=true to purge.`);
      console.table(recordsToPurge.map(item => ({
        "PNumber": item.duplicate.PNumber,
        "Name": `${item.duplicate.FirstName} ${item.duplicate.Surname}`,
        "Tossed ID": item.duplicate.id,
        "Tossed Score": item.dupWeight,
        "Preserved ID": item.masterId,
        "Preserved Score": item.masterWeight
      })));
      return recordsToPurge;
    }

    setPurging(true);
    try {
      for (const item of recordsToPurge) {
        await base44.asServiceRole.entities.PersonnelManager.delete(item.duplicate.id);
      }
      queryClient.invalidateQueries({ queryKey: ['all-personnel'] });
      toast.success(`Purged ${recordsToPurge.length} low-density duplicates (admin bypass)`);
      return null;
    } catch (e) {
      toast.error(`Density purge failed: ${e.message}`);
      return null;
    } finally {
      setPurging(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
        <Shield className="w-4 h-4 text-destructive shrink-0" />
        <p className="text-xs text-destructive font-medium">System Administrator actions only — L6 access required. These affect all detachments.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* May 31 Duplicate Purge */}
        {auditMode ? (
          <Card className="border-amber-300/50 bg-amber-50/30">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Audit May 31 Duplicates
              </CardTitle>
              <CardDescription>Scan for duplicates created on May 31 (safe audit mode)</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={auditMay31Duplicates} disabled={purging} className="w-full" variant="outline">
                {purging ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scanning...</> : <>🔍 Run Audit</>}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-destructive/30 md:col-span-2">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive" />
                {auditResults?.length > 0 ? `${auditResults.length} Duplicates Found` : 'No Duplicates'}
              </CardTitle>
              <CardDescription>May 31 audit results — verify before executing purge</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {auditResults && auditResults.length > 0 && (
                <div className="max-h-48 overflow-y-auto bg-muted/30 rounded p-3 border border-destructive/20">
                  <ul className="text-xs space-y-1">
                    {auditResults.slice(0, 20).map(r => (
                      <li key={r.id} className="text-muted-foreground">
                        {r.PNumber} — {r.Rank} {r.FirstName} {r.Surname}
                      </li>
                    ))}
                    {auditResults.length > 20 && <li className="text-muted-foreground italic">+{auditResults.length - 20} more...</li>}
                  </ul>
                </div>
              )}
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => { setAuditResults(null); setAuditMode(true); }} disabled={purging}>
                  Back to Audit
                </Button>
                <Button variant="destructive" onClick={executeMay31Purge} disabled={purging || !auditResults?.length}>
                  {purging ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Purging...</> : <>🔥 Execute Purge</>}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

         {/* Syllabus CSV Upload */}
         <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="w-4 h-4 text-accent" />
              Upload Master Syllabus
            </CardTitle>
            <CardDescription>
              CSV columns: LessonCode, StarLevel, SubjectName, LessonName, IsMandatory
            </CardDescription>
          </CardHeader>
          <CardContent>
            <input type="file" accept=".csv,.xlsx" ref={fileRef} onChange={handleSyllabusCsvUpload} className="hidden" />
            <Button onClick={() => fileRef.current?.click()} disabled={uploading} className="w-full" variant="outline">
              {uploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</> : <><FileUp className="w-4 h-4 mr-2" />Choose File</>}
            </Button>
          </CardContent>
        </Card>

        {/* Purge Syllabus */}
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-destructive" />
              Purge Master Syllabus
            </CardTitle>
            <CardDescription>
              Permanently remove ALL syllabus records. Cannot be undone.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={purgeSyllabus} disabled={purging} className="w-full">
              {purging ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Purging...</> : <><AlertTriangle className="w-4 h-4 mr-2" />Purge All Records</>}
            </Button>
          </CardContent>
        </Card>

        {/* Data Density Deduplication */}
        {!densityResults ? (
          <Card className="border-blue-300/50 bg-blue-50/30">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="w-4 h-4 text-blue-600" />
                Smart Deduplication
              </CardTitle>
              <CardDescription>Find duplicates by data density & quality (safe audit mode)</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => purgeByDataDensity(false).then(setDensityResults)} disabled={purging} className="w-full" variant="outline">
                {purging ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scanning...</> : <>🔍 Scan Duplicates</>}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-blue-300/50 md:col-span-2">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="w-4 h-4 text-blue-600" />
                {densityResults?.length > 0 ? `${densityResults.length} Low-Density Duplicates` : 'No Duplicates Found'}
              </CardTitle>
              <CardDescription>Preserve high-data-weight records, remove low-density shells</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {densityResults && densityResults.length > 0 && (
                <div className="max-h-48 overflow-y-auto bg-muted/30 rounded p-3 border border-blue-300/30 text-xs">
                  <ul className="space-y-1">
                    {densityResults.slice(0, 20).map(r => (
                      <li key={r.duplicate.id} className="text-muted-foreground">
                        {r.duplicate.PNumber} — {r.duplicate.Rank} {r.duplicate.FirstName} {r.duplicate.Surname}
                        <span className="text-xs ml-2">(ID:{r.duplicate.id} Score:{r.dupWeight} → Keep ID:{r.masterId} Score:{r.masterWeight})</span>
                      </li>
                    ))}
                    {densityResults.length > 20 && <li className="text-muted-foreground italic">+{densityResults.length - 20} more...</li>}
                  </ul>
                </div>
              )}
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setDensityResults(null)} disabled={purging}>
                  Back to Scan
                </Button>
                <Button variant="destructive" onClick={() => purgeByDataDensity(true)} disabled={purging || !densityResults?.length}>
                  {purging ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Purging...</> : <>🔥 Execute Purge</>}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        </div>
        </div>
        );
}

// ─── Detachment Commander Section (L5+) ────────────────────────────────────
function DetCommanderPanel({ queryClient }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [purgingPersonnel, setPurgingPersonnel] = useState(false);
  const [detName, setDetName] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  const { data: settings = [] } = useQuery({
    queryKey: ['det-settings'],
    queryFn: () => base44.entities.DetachmentSettings.filter({}),
  });

  useEffect(() => {
    const name = settings.find(s => s.Key === 'detachment_name');
    if (name) setDetName(name.Value);
  }, [settings]);

  async function saveDetachmentName() {
    setSavingSettings(true);
    const existing = settings.find(s => s.Key === 'detachment_name');
    if (existing) {
      await base44.entities.DetachmentSettings.update(existing.id, { Value: detName });
    } else {
      await base44.entities.DetachmentSettings.create({ Key: 'detachment_name', Value: detName, Description: 'Detachment display name for exports' });
    }
    queryClient.invalidateQueries({ queryKey: ['det-settings'] });
    toast.success('Detachment name saved');
    setSavingSettings(false);
  }

  async function handlePersonnelCsvUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url,
      json_schema: {
        type: "array",
        items: {
          type: "object",
          properties: {
            PNumber: { type: "string" },
            Rank: { type: "string" },
            FirstName: { type: "string" },
            Surname: { type: "string" },
            Type: { type: "string" },
            AccessLevel: { type: "number" },
            RoleName: { type: "string" },
            CurrentStarLevel: { type: "string" }
          }
        }
      }
    });
    if (result.status === 'success' && result.output) {
      const records = Array.isArray(result.output) ? result.output : [result.output];
      const batch = records.filter(r => r.PNumber && r.Surname).map(r => ({
        PNumber: r.PNumber,
        Rank: r.Rank || '',
        FirstName: r.FirstName || '',
        Surname: r.Surname,
        Type: r.Type || 'Cadet',
        AccessLevel: parseInt(r.AccessLevel) || 0,
        RoleName: r.RoleName || '',
        CurrentStarLevel: r.CurrentStarLevel || 'Basic',
        PersonnelStatus: 'Active',
        IsLinked: false,
      }));
      
      if (batch.length > 0) {
        // DEFENSIVE FIX: Check for existing PNumbers to prevent duplicate imports
        const existing = await base44.entities.PersonnelManager.filter({});
        const existingPNumbers = new Set(existing.map(r => r.PNumber));
        const uniqueRecords = batch.filter(r => {
          if (existingPNumbers.has(r.PNumber)) {
            console.warn(`Skipping duplicate PNumber: ${r.PNumber}`);
            return false;
          }
          return true;
        });
        
        if (uniqueRecords.length === 0) {
          toast.error('All records in this CSV already exist in the database');
          setUploading(false);
          if (fileRef.current) fileRef.current.value = '';
          return;
        }
        
        for (let i = 0; i < uniqueRecords.length; i += 50) {
          await base44.entities.PersonnelManager.bulkCreate(uniqueRecords.slice(i, i + 50));
        }
        const skipped = batch.length - uniqueRecords.length;
        const msg = skipped > 0 
          ? `Imported ${uniqueRecords.length} records (${skipped} duplicates skipped)`
          : `Imported ${uniqueRecords.length} personnel records`;
        toast.success(msg);
        queryClient.invalidateQueries({ queryKey: ['all-personnel'] });
      } else {
        toast.error('No valid records found');
      }
    } else {
      toast.error('Failed to parse CSV: ' + (result.details || 'Unknown error'));
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function purgePersonnel() {
    if (!window.confirm('This will permanently delete ALL personnel records (except your own). Are you sure?')) return;
    setPurgingPersonnel(true);
    const user = await base44.auth.me();
    const all = await base44.entities.PersonnelManager.filter({});
    // Never delete the currently linked admin's own record
    const toDelete = all.filter(r => r.LinkedEmailUID !== user?.email);
    for (const record of toDelete) {
      await base44.entities.PersonnelManager.delete(record.id);
    }
    queryClient.invalidateQueries({ queryKey: ['all-personnel'] });
    toast.success(`Purged ${toDelete.length} personnel records (your own record was preserved)`);
    setPurgingPersonnel(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
        <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
        <p className="text-xs text-primary font-medium">Detachment Commander actions — manage your detachment's personnel roster and data.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Detachment Name */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="w-4 h-4 text-primary" />
              Detachment Name
            </CardTitle>
            <CardDescription>Display name used in exports and reports</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 max-w-md">
              <div className="flex-1">
                <Input value={detName} onChange={e => setDetName(e.target.value)} placeholder="e.g. 123 (City) Sqn ACF" />
              </div>
              <Button onClick={saveDetachmentName} disabled={savingSettings}>
                {savingSettings ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Personnel CSV Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-chart-2" />
              Import Personnel Roster
            </CardTitle>
            <CardDescription>
              Upload your detachment roster CSV. Columns: PNumber, Rank, FirstName, Surname, Type, AccessLevel, RoleName, CurrentStarLevel
            </CardDescription>
          </CardHeader>
          <CardContent>
            <input type="file" accept=".csv,.xlsx" ref={fileRef} onChange={handlePersonnelCsvUpload} className="hidden" />
            <Button onClick={() => fileRef.current?.click()} disabled={uploading} className="w-full" variant="outline">
              {uploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</> : <><FileUp className="w-4 h-4 mr-2" />Choose File</>}
            </Button>
          </CardContent>
        </Card>

        {/* Purge Personnel */}
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-destructive" />
              Purge Personnel Roster
            </CardTitle>
            <CardDescription>
              Remove all personnel records from this detachment. Cannot be undone.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={purgePersonnel} disabled={purgingPersonnel} className="w-full">
              {purgingPersonnel ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Purging...</> : <><AlertTriangle className="w-4 h-4 mr-2" />Purge All Personnel</>}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function AdminControls() {
  const queryClient = useQueryClient();
  const { personnel: me } = usePersonnel();
  const myLevel = me?.AccessLevel ?? 0;
  const isSysAdmin = myLevel >= ACCESS_LEVELS.SYSTEM_ADMIN;

  return (
    <AccessGate level={ACCESS_LEVELS.DET_2IC}>
      <PageHeader
        title="Admin Controls"
        description={isSysAdmin ? 'System Administrator & Detachment Commander' : 'Detachment Commander'}
        icon={isSysAdmin ? Shield : ShieldCheck}
      />

      {isSysAdmin ? (
        <Tabs defaultValue="det-commander">
          <TabsList className="mb-4">
            <TabsTrigger value="det-commander" className="gap-2">
              <ShieldCheck className="w-4 h-4" />
              Det Commander
            </TabsTrigger>
            <TabsTrigger value="sys-admin" className="gap-2">
              <Shield className="w-4 h-4" />
              System Admin
            </TabsTrigger>
          </TabsList>
          <TabsContent value="det-commander">
            <DetCommanderPanel queryClient={queryClient} />
          </TabsContent>
          <TabsContent value="sys-admin">
            <SysAdminPanel queryClient={queryClient} />
          </TabsContent>
        </Tabs>
      ) : (
        <DetCommanderPanel queryClient={queryClient} />
      )}
    </AccessGate>
  );
}