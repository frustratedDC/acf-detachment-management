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
import { Settings, Upload, Trash2, AlertTriangle, Loader2, FileUp, Users, Save, Shield, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { ACCESS_LEVELS } from '@/lib/accessLevels';

// ─── Sys Admin Section (L6 only) ───────────────────────────────────────────
function SysAdminPanel({ queryClient }) {
  const fileRef = useRef(null);
  const personnelFileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingPersonnel, setUploadingPersonnel] = useState(false);
  const [purging, setPurging] = useState(false);
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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
        <Shield className="w-4 h-4 text-destructive shrink-0" />
        <p className="text-xs text-destructive font-medium">System Administrator actions only — L6 access required. These affect all detachments.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Global Detachment Settings */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="w-4 h-4 text-primary" />
              Global Detachment Settings
            </CardTitle>
            <CardDescription>System-wide configuration applied across the application</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 max-w-md">
              <div className="flex-1">
                <Label>Detachment Name</Label>
                <Input value={detName} onChange={e => setDetName(e.target.value)} placeholder="e.g. 123 (City) Sqn ACF" className="mt-1" />
              </div>
              <div className="flex items-end">
                <Button onClick={saveDetachmentName} disabled={savingSettings}>
                  {savingSettings ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Save
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

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
      </div>
    </div>
  );
}

// ─── Detachment Commander Section (L5+) ────────────────────────────────────
function DetCommanderPanel({ queryClient }) {
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
        for (let i = 0; i < batch.length; i += 50) {
          await base44.entities.PersonnelManager.bulkCreate(batch.slice(i, i + 50));
        }
        toast.success(`Imported ${batch.length} personnel records`);
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
    if (!window.confirm('This will permanently delete ALL personnel records. Are you sure?')) return;
    setPurgingPersonnel(true);
    const all = await base44.entities.PersonnelManager.filter({});
    for (const record of all) {
      await base44.entities.PersonnelManager.delete(record.id);
    }
    queryClient.invalidateQueries({ queryKey: ['all-personnel'] });
    toast.success(`Purged ${all.length} personnel records`);
    setPurgingPersonnel(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
        <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
        <p className="text-xs text-primary font-medium">Detachment Commander actions — manage your detachment's personnel roster and data.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
    <AccessGate level={ACCESS_LEVELS.DET_COMMANDER}>
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