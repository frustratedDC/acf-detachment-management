import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { usePersonnel } from '@/lib/usePersonnel';
import AccessGate from '@/components/shared/AccessGate';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Upload, Trash2, AlertTriangle, Loader2, FileUp, Users, Save, Shield, ShieldCheck, Zap, Download, AlertCircle, Plus } from 'lucide-react';
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

  async function purgeAllDataExceptAdmin(executeDelete = false) {
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      toast.error('Only L6 System Admins can execute this operation');
      return;
    }

    setPurging(true);
    try {
      const allPersonnel = await base44.entities.PersonnelManager.filter({});
      const myRecord = allPersonnel.find(p => p.LinkedEmailUID === user.email);
      const toDelete = allPersonnel.filter(p => p.LinkedEmailUID !== user.email);

      if (!executeDelete) {
        console.log(`🔍 Dry run: Would purge ${toDelete.length} personnel records (keeping your account)`);
        toast.info(`Found ${toDelete.length} records to purge. Run with confirmation to execute.`);
        return;
      }

      console.log(`🔥 PURGING ${toDelete.length} personnel records...`);
      for (const record of toDelete) {
        await base44.entities.PersonnelManager.delete(record.id);
      }

      queryClient.invalidateQueries({ queryKey: ['all-personnel'] });
      toast.success(`Purged ${toDelete.length} personnel records. Your account (${myRecord?.PNumber}) preserved.`);
    } catch (e) {
      toast.error(`Purge failed: ${e.message}`);
      console.error("❌ Admin purge error:", e);
    } finally {
      setPurging(false);
    }
  }

  async function purgeByDataDensity(executeDelete = false) {
    console.log("🚀 Starting Safe Client-Side Base44 Scan...");
    const response = await base44.entities.PersonnelManager.list();
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

    console.log(`🔍 Analysis Complete. Found ${recordsToPurge.length} duplicate rows.`);

    if (recordsToPurge.length === 0) {
      toast.success("No data density duplicates found");
      return null;
    }

    if (!executeDelete) {
      console.log("⚠️ DRY RUN MODE. Check browser console logs for the table map.");
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
      console.log(`🔥 Commencing deletion sequence on ${recordsToPurge.length} records...`);
      let successCount = 0;
      
      for (const item of recordsToPurge) {
        const targetId = item.duplicate.id;
        console.log(`Attempting removal for Ghost ID: ${targetId}`);
        
        try {
          const result = await base44.entities.PersonnelManager.delete(targetId);
          console.log(`Target ID [${targetId}] deletion response:`, result);
          successCount++;
        } catch (innerErr) {
          console.warn(`Standard delete failed for ID ${targetId}, trying object-payload fallback...`);
          try {
            const fallbackResult = await base44.entities.PersonnelManager.delete({ id: targetId });
            console.log(`Fallback target ID [${targetId}] response:`, fallbackResult);
            successCount++;
          } catch (fallbackErr) {
            console.error(`❌ Both deletion formats failed for ID ${targetId}:`, fallbackErr);
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ['all-personnel'] });
      toast.success(`Purged ${successCount}/${recordsToPurge.length} low-density duplicates`);
      return null;
    } catch (e) {
      toast.error(`Density purge failed: ${e.message}`);
      console.error("❌ Global script execution error:", e);
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

        {/* Nuclear Option: Purge All Except Admin */}
        <Card className="border-red-400/50 bg-red-50/30 md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Nuclear Option: Reset Everything
            </CardTitle>
            <CardDescription>Permanently purge all personnel except your L6 account. Cannot be undone.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-red-700">
              ⚠️ This will delete every personnel record in the system except your own account. All associated data (inspections, qualifications, sessions, etc.) will be orphaned.
            </p>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => purgeAllDataExceptAdmin(false)} 
                disabled={purging}
                className="flex-1"
              >
                {purging ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Checking...</> : <>📋 Audit Only</>}
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => {
                  if (window.confirm('FINAL WARNING: This will DELETE ALL personnel except your account. Type "PURGE ALL" to confirm.')) {
                    const response = prompt('Type PURGE ALL to confirm:');
                    if (response === 'PURGE ALL') {
                      purgeAllDataExceptAdmin(true);
                    } else {
                      toast.error('Confirmation text did not match. Operation cancelled.');
                    }
                  }
                }} 
                disabled={purging}
                className="flex-1"
              >
                {purging ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Purging...</> : <>🔥 PURGE ALL</>}
              </Button>
            </div>
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

// ─── Export Subject Completions Card ────────────────────────────────────────
function ExportSubjectCompletionsCard() {
  const currentYear = new Date().getFullYear();
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');

  const [filterMode, setFilterMode] = useState('range'); // 'range' | 'month'
  const [startDate, setStartDate] = useState(`${currentYear}-01-01`);
  const [endDate, setEndDate] = useState(`${currentYear}-12-31`);
  const [selectedMonth, setSelectedMonth] = useState(`${currentYear}-${currentMonth}`);
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);

    let filterStart, filterEnd;
    if (filterMode === 'month') {
      const [yr, mo] = selectedMonth.split('-');
      filterStart = `${yr}-${mo}-01`;
      const lastDay = new Date(parseInt(yr), parseInt(mo), 0).getDate();
      filterEnd = `${yr}-${mo}-${String(lastDay).padStart(2, '0')}`;
    } else {
      filterStart = startDate;
      filterEnd = endDate;
    }

    const [progress, personnel, syllabus] = await Promise.all([
      base44.entities.ProgressLedger.filter({ Status: 'Approved' }),
      base44.entities.PersonnelManager.filter({}),
      base44.entities.SyllabusMaster.filter({}),
    ]);

    const filtered = progress.filter(r => {
      if (!r.CompletionDate) return false;
      return r.CompletionDate >= filterStart && r.CompletionDate <= filterEnd;
    });

    const personnelMap = Object.fromEntries(personnel.map(p => [p.PNumber, p]));
    const syllabusMap = Object.fromEntries(syllabus.map(s => [s.LessonCode, s]));
    const headers = ['SURNAME', 'INITIAL', 'RANK', 'STAR LEVEL', 'SUBJECT', 'DATE COMPLETED'];
    const rows = filtered.map(r => {
      const p = personnelMap[r.CadetPNumber] || {};
      const s = syllabusMap[r.LessonCode] || {};
      return [
        `"${p.Surname || r.CadetPNumber}"`,
        `"${(p.FirstName || '').charAt(0)}"`,
        `"${p.Rank || ''}"`,
        `"${p.CurrentStarLevel || s.StarLevel || ''}"`,
        `"${s.SubjectName || ''}"`,
        `"${r.CompletionDate || ''}"`,
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filterMode === 'month'
      ? `subject_completions_${selectedMonth}.csv`
      : `subject_completions_${filterStart}_to_${filterEnd}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} completion records`);
    setExporting(false);
  }

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Download className="w-4 h-4 text-chart-2" />
          Export Subject Completions to CSV
        </CardTitle>
        <CardDescription>
          Filter by date range or month/year, then export approved completions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filter mode toggle */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={filterMode === 'range' ? 'default' : 'outline'}
            onClick={() => setFilterMode('range')}
          >
            Date Range
          </Button>
          <Button
            size="sm"
            variant={filterMode === 'month' ? 'default' : 'outline'}
            onClick={() => setFilterMode('month')}
          >
            Month / Year
          </Button>
        </div>

        {filterMode === 'range' ? (
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <Label className="text-xs">Start Date</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1 w-36" />
            </div>
            <div>
              <Label className="text-xs">End Date</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1 w-36" />
            </div>
          </div>
        ) : (
          <div>
            <Label className="text-xs">Month / Year</Label>
            <Input
              type="month"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="mt-1 w-44"
            />
          </div>
        )}

        <Button variant="outline" className="w-full" onClick={handleExport} disabled={exporting}>
          {exporting
            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Exporting...</>
            : <><Download className="w-4 h-4 mr-2" />Export Filtered Results to CSV</>}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Personnel Panel (L4+) — import/purge roster ────────────────────────────
function PersonnelPanel({ queryClient }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [purgingPersonnel, setPurgingPersonnel] = useState(false);

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
        PNumber: r.PNumber, Rank: r.Rank || '', FirstName: r.FirstName || '',
        Surname: r.Surname, Type: r.Type || 'Cadet',
        AccessLevel: parseInt(r.AccessLevel) || 0, RoleName: r.RoleName || '',
        CurrentStarLevel: r.CurrentStarLevel || 'Basic',
        PersonnelStatus: 'Active', IsLinked: false,
      }));
      if (batch.length > 0) {
        const existing = await base44.entities.PersonnelManager.filter({});
        const existingPNums = new Set(existing.map(r => r.PNumber));
        const unique = batch.filter(r => !existingPNums.has(r.PNumber));
        if (unique.length === 0) { toast.error('All records already exist'); setUploading(false); if (fileRef.current) fileRef.current.value = ''; return; }
        for (let i = 0; i < unique.length; i += 50) await base44.entities.PersonnelManager.bulkCreate(unique.slice(i, i + 50));
        const skipped = batch.length - unique.length;
        toast.success(`Imported ${unique.length} records${skipped > 0 ? ` (${skipped} duplicates skipped)` : ''}`);
        queryClient.invalidateQueries({ queryKey: ['all-personnel'] });
      } else { toast.error('No valid records found'); }
    } else { toast.error('Failed to parse CSV: ' + (result.details || 'Unknown error')); }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function purgePersonnel() {
    if (!window.confirm('Permanently delete ALL personnel records (except your own)?')) return;
    setPurgingPersonnel(true);
    const user = await base44.auth.me();
    const all = await base44.entities.PersonnelManager.filter({});
    const toDelete = all.filter(r => r.LinkedEmailUID !== user?.email);
    for (const record of toDelete) await base44.entities.PersonnelManager.delete(record.id);
    queryClient.invalidateQueries({ queryKey: ['all-personnel'] });
    toast.success(`Purged ${toDelete.length} personnel records`);
    setPurgingPersonnel(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
        <Users className="w-4 h-4 text-primary shrink-0" />
        <p className="text-xs text-primary font-medium">Manage the detachment personnel roster — import new records or remove all entries.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4 text-chart-2" />Import Personnel Roster</CardTitle>
            <CardDescription>CSV columns: PNumber, Rank, FirstName, Surname, Type, AccessLevel, RoleName, CurrentStarLevel</CardDescription>
          </CardHeader>
          <CardContent>
            <input type="file" accept=".csv,.xlsx" ref={fileRef} onChange={handlePersonnelCsvUpload} className="hidden" />
            <Button onClick={() => fileRef.current?.click()} disabled={uploading} className="w-full" variant="outline">
              {uploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</> : <><FileUp className="w-4 h-4 mr-2" />Choose File</>}
            </Button>
          </CardContent>
        </Card>
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Trash2 className="w-4 h-4 text-destructive" />Purge Personnel Roster</CardTitle>
            <CardDescription>Remove all personnel records. Cannot be undone.</CardDescription>
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

// ─── Engagement Audit Panel (DC-only L5+) ───────────────────────────────────
function EngagementAuditPanel() {
  const { data: ledger = [] } = useQuery({
    queryKey: ['engagement-audit'],
    queryFn: () => base44.entities.InstructorAttendanceLedger.filter({}),
  });
  const { data: allPersonnel = [] } = useQuery({
    queryKey: ['all-personnel-engagement'],
    queryFn: () => base44.entities.PersonnelManager.filter({ Type: 'Adult Instructor' }),
  });

  const byInstructor = {};
  ledger.forEach(e => {
    if (!byInstructor[e.InstructorPNumber]) byInstructor[e.InstructorPNumber] = { name: e.InstructorName, entries: [] };
    byInstructor[e.InstructorPNumber].entries.push(e);
  });

  const rows = Object.entries(byInstructor).map(([pnum, data]) => {
    const total = data.entries.length;
    const present = data.entries.filter(e => e.AttendanceStatus === 'Present').length;
    const score = total > 0 ? Math.round((present / total) * 100) : null;
    return { pnum, name: data.name, total, present, score, entries: data.entries };
  }).sort((a, b) => (a.score ?? 101) - (b.score ?? 101));

  const flagged = rows.filter(r => r.score !== null && r.score < 60);
  const healthy = rows.filter(r => r.score === null || r.score >= 60);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
        <ShieldCheck className="w-4 h-4 text-destructive shrink-0" />
        <p className="text-xs text-destructive font-medium">DC-only view — Instructor engagement records from the Parade State. Not visible to instructors.</p>
      </div>
      {flagged.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-destructive flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> Flagged — Below 60% Attendance</h3>
          {flagged.map(r => <EngagementRow key={r.pnum} row={r} />)}
        </div>
      )}
      {healthy.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">All Other Instructors</h3>
          {healthy.map(r => <EngagementRow key={r.pnum} row={r} />)}
        </div>
      )}
      {rows.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">No engagement records yet. Records are created via the "Not Attended" button on Parade State.</p>
      )}
    </div>
  );
}

function EngagementRow({ row }) {
  const [open, setOpen] = useState(false);
  const scoreColor = row.score === null ? 'text-muted-foreground' : row.score < 60 ? 'text-destructive' : row.score < 80 ? 'text-amber-600' : 'text-chart-2';
  return (
    <Card className={row.score !== null && row.score < 60 ? 'border-destructive/30' : ''}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-sm">{row.name || row.pnum}</p>
            <p className="text-xs text-muted-foreground">{row.present}/{row.total} sessions present</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-lg font-bold ${scoreColor}`}>{row.score !== null ? `${row.score}%` : 'N/A'}</span>
            {row.entries.some(e => e.EngagementNotes || (e.QuickTags && e.QuickTags.length > 0)) && (
              <button onClick={() => setOpen(!open)} className="text-xs text-muted-foreground hover:text-foreground underline">
                {open ? 'Hide' : 'Notes'}
              </button>
            )}
          </div>
        </div>
        {open && (
          <div className="mt-3 space-y-2 border-t pt-3">
            {row.entries.filter(e => e.EngagementNotes || e.QuickTags?.length > 0).map(e => (
              <div key={e.id} className="text-xs bg-muted/30 rounded p-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{e.Date}</span>
                  <span className="text-muted-foreground">{e.Reason || e.AttendanceStatus}</span>
                </div>
                {e.QuickTags?.length > 0 && <div className="flex flex-wrap gap-1 mb-1">{e.QuickTags.map(t => <span key={t} className="px-1.5 py-0.5 bg-destructive/10 text-destructive rounded text-xs">{t}</span>)}</div>}
                {e.EngagementNotes && <p className="text-muted-foreground">{e.EngagementNotes}</p>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Attendance Discrepancy Detection ────────────────────────────────────────
function DiscrepancyAlert({ discrepancies }) {
  if (discrepancies.length === 0) return null;

  return (
    <Card className="border-destructive/30 bg-destructive/5 mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2 text-destructive">
          <AlertCircle className="w-5 h-5" />
          Attendance Discrepancies ({discrepancies.length})
        </CardTitle>
        <CardDescription>Instructors marked Available but recorded as Absent</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {discrepancies.map(d => (
          <div key={d.id} className="flex items-center justify-between p-2 rounded bg-muted/40">
            <div className="text-sm">
              <span className="font-medium">{d.instructorName}</span> ({d.pnum})
              <span className="text-xs text-muted-foreground ml-2">{d.date}</span>
            </div>
            <Button size="sm" variant="outline" onClick={() => window.alert('Resolve: Trigger engagement note modal for ' + d.pnum)}>
              Resolve
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Operations Panel (L4+) — settings, syllabus, exports ───────────────────
function DetCommanderPanel({ queryClient }) {
  const [detName, setDetName] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  const { data: settings = [] } = useQuery({
    queryKey: ['det-settings'],
    queryFn: () => base44.entities.DetachmentSettings.filter({}),
  });

  const { data: availability = [] } = useQuery({
    queryKey: ['instructor-availability'],
    queryFn: () => base44.entities.InstructorAvailability.list(),
  });

  const { data: attendanceLedger = [] } = useQuery({
    queryKey: ['attendance-ledger'],
    queryFn: () => base44.entities.InstructorAttendanceLedger.list(),
  });

  // Detect discrepancies: Available but Absent
  const discrepancies = useMemo(() => {
    const discrepancy = [];
    availability.forEach(avail => {
      if (avail.Status === 'Available') {
        const absenceRecord = attendanceLedger.find(
          a => a.InstructorPNumber === avail.InstructorPNumber && a.Date === avail.Date && a.AttendanceStatus === 'Absent'
        );
        if (absenceRecord) {
          discrepancy.push({
            id: `${avail.id}-${absenceRecord.id}`,
            pnum: avail.InstructorPNumber,
            instructorName: absenceRecord.InstructorName,
            date: avail.Date,
          });
        }
      }
    });
    return discrepancy;
  }, [availability, attendanceLedger]);

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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
        <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
        <p className="text-xs text-primary font-medium">Operational settings — detachment configuration, syllabus management and data exports.</p>
      </div>
      {discrepancies.length > 0 && <DiscrepancyAlert discrepancies={discrepancies} />}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Settings className="w-4 h-4 text-primary" />Detachment Name</CardTitle>
            <CardDescription>Display name used in exports and reports</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 max-w-md">
              <Input value={detName} onChange={e => setDetName(e.target.value)} placeholder="e.g. 123 (City) Sqn ACF" className="flex-1" />
              <Button onClick={saveDetachmentName} disabled={savingSettings}>
                {savingSettings ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}Save
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4 text-primary" />Inject Community Engagement Subject</CardTitle>
            <CardDescription>Add Community Engagement lessons to 1–4 Star syllabus profiles</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" onClick={async () => {
              const CE_LESSONS = [
                { LessonCode: 'CE-1-01', StarLevel: '1 Star', SubjectName: 'Community Engagement', LessonName: 'Introduction to Community Engagement', IsMandatory: true },
                { LessonCode: 'CE-1-02', StarLevel: '1 Star', SubjectName: 'Community Engagement', LessonName: 'Local Community Projects', IsMandatory: false },
                { LessonCode: 'CE-2-01', StarLevel: '2 Star', SubjectName: 'Community Engagement', LessonName: 'Volunteering and Service', IsMandatory: true },
                { LessonCode: 'CE-2-02', StarLevel: '2 Star', SubjectName: 'Community Engagement', LessonName: 'Community Impact Assessment', IsMandatory: false },
                { LessonCode: 'CE-3-01', StarLevel: '3 Star', SubjectName: 'Community Engagement', LessonName: 'Leading Community Initiatives', IsMandatory: true },
                { LessonCode: 'CE-3-02', StarLevel: '3 Star', SubjectName: 'Community Engagement', LessonName: 'Partnership and Stakeholder Engagement', IsMandatory: false },
                { LessonCode: 'CE-4-01', StarLevel: '4 Star', SubjectName: 'Community Engagement', LessonName: 'Strategic Community Leadership', IsMandatory: true },
                { LessonCode: 'CE-4-02', StarLevel: '4 Star', SubjectName: 'Community Engagement', LessonName: 'Legacy Planning and Sustainability', IsMandatory: false },
              ];
              const existing = await base44.entities.SyllabusMaster.filter({});
              const existingCodes = new Set(existing.map(r => r.LessonCode));
              const toAdd = CE_LESSONS.filter(l => !existingCodes.has(l.LessonCode));
              if (toAdd.length === 0) { toast.info('Community Engagement lessons already exist'); return; }
              await base44.entities.SyllabusMaster.bulkCreate(toAdd);
              queryClient.invalidateQueries({ queryKey: ['syllabus-master-all'] });
              toast.success(`Injected ${toAdd.length} Community Engagement lessons`);
            }}>
              <Users className="w-4 h-4 mr-2" />Inject Community Engagement Lessons
            </Button>
          </CardContent>
        </Card>
        <ExportSubjectCompletionsCard />
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function AdminControls() {
  const queryClient = useQueryClient();
  const { personnel: me } = usePersonnel();
  const myLevel = me?.AccessLevel ?? 0;
  const isDC = myLevel >= ACCESS_LEVELS.DET_COMMANDER;
  const isSysAdmin = myLevel >= ACCESS_LEVELS.SYSTEM_ADMIN;

  const { data: availability = [] } = useQuery({
    queryKey: ['instructor-availability'],
    queryFn: () => base44.entities.InstructorAvailability.list(),
  });

  const { data: attendanceLedger = [] } = useQuery({
    queryKey: ['attendance-ledger'],
    queryFn: () => base44.entities.InstructorAttendanceLedger.list(),
  });

  // Main discrepancy count for badge
  const discrepancyCount = useMemo(() => {
    let count = 0;
    availability.forEach(avail => {
      if (avail.Status === 'Available') {
        const hasAbsence = attendanceLedger.some(
          a => a.InstructorPNumber === avail.InstructorPNumber && a.Date === avail.Date && a.AttendanceStatus === 'Absent'
        );
        if (hasAbsence) count++;
      }
    });
    return count;
  }, [availability, attendanceLedger]);

  return (
    <AccessGate level={ACCESS_LEVELS.DET_2IC}>
      <PageHeader
        title="Command Hub"
        description="Centralised detachment administration and oversight"
        icon={ShieldCheck}
      />

      <Tabs defaultValue="operations">
        <TabsList className="mb-4 flex-wrap h-auto gap-1">
          <TabsTrigger value="operations" className="gap-2">
            <Zap className="w-4 h-4" />
            Operations
            {discrepancyCount > 0 && <Badge className="ml-1 bg-destructive">{discrepancyCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="personnel" className="gap-2">
            <Users className="w-4 h-4" />
            Personnel
          </TabsTrigger>
          {isDC && (
            <TabsTrigger value="engagement" className="gap-2">
              <ShieldCheck className="w-4 h-4" />
              Engagement Audit
            </TabsTrigger>
          )}
          {isSysAdmin && (
            <TabsTrigger value="sys-admin" className="gap-2">
              <Shield className="w-4 h-4" />
              System Admin
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="operations">
          <DetCommanderPanel queryClient={queryClient} />
        </TabsContent>

        <TabsContent value="personnel">
          <PersonnelPanel queryClient={queryClient} />
        </TabsContent>

        {isDC && (
          <TabsContent value="engagement">
            <EngagementAuditPanel />
          </TabsContent>
        )}

        {isSysAdmin && (
          <TabsContent value="sys-admin">
            <SysAdminPanel queryClient={queryClient} />
          </TabsContent>
        )}
      </Tabs>
    </AccessGate>
  );
}