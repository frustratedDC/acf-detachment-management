import React, { useState, useRef } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import AccessGate from '@/components/shared/AccessGate';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings, Upload, Trash2, AlertTriangle, Loader2, FileUp, Users, Save } from 'lucide-react';
import { toast } from 'sonner';
import { ACCESS_LEVELS } from '@/lib/accessLevels';

export default function AdminControls() {
  const queryClient = useQueryClient();
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
    onSuccess: (data) => {
      const name = data.find(s => s.Key === 'detachment_name');
      if (name) setDetName(name.Value);
    }
  });

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

  async function handleCsvUpload(e) {
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
      const batch = [];
      for (const r of records) {
        if (r.LessonCode && r.SubjectName && r.LessonName) {
          batch.push({
            LessonCode: r.LessonCode,
            StarLevel: r.StarLevel || 'Basic',
            SubjectName: r.SubjectName,
            LessonName: r.LessonName,
            IsMandatory: r.IsMandatory || false,
          });
        }
      }
      if (batch.length > 0) {
        // bulkCreate in chunks of 50
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

  async function handlePersonnelCsvUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPersonnel(true);
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
    setUploadingPersonnel(false);
    if (personnelFileRef.current) personnelFileRef.current.value = '';
  }

  async function purgeSyllabus() {
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
    <AccessGate level={ACCESS_LEVELS.SYSTEM_ADMIN}>
      <PageHeader
        title="Admin Controls"
        description="System administration tools"
        icon={Settings}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Detachment Settings */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="w-4 h-4 text-primary" />
              Detachment Settings
            </CardTitle>
            <CardDescription>Configure detachment-wide settings used in exports and display</CardDescription>
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
        {/* Personnel CSV Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-chart-2" />
              CSV Upload — Personnel
            </CardTitle>
            <CardDescription>
              Upload a CSV with columns: PNumber, Rank, FirstName, Surname, Type, AccessLevel, RoleName, CurrentStarLevel
            </CardDescription>
          </CardHeader>
          <CardContent>
            <input
              type="file"
              accept=".csv,.xlsx"
              ref={personnelFileRef}
              onChange={handlePersonnelCsvUpload}
              className="hidden"
            />
            <Button
              onClick={() => personnelFileRef.current?.click()}
              disabled={uploadingPersonnel}
              className="w-full"
              variant="outline"
            >
              {uploadingPersonnel ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>
              ) : (
                <><FileUp className="w-4 h-4 mr-2" />Choose File</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Syllabus CSV Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="w-4 h-4 text-accent" />
              CSV Upload — Master Syllabus
            </CardTitle>
            <CardDescription>
              Upload a CSV with columns: LessonCode, StarLevel, SubjectName, LessonName, IsMandatory
            </CardDescription>
          </CardHeader>
          <CardContent>
            <input
              type="file"
              accept=".csv,.xlsx"
              ref={fileRef}
              onChange={handleCsvUpload}
              className="hidden"
            />
            <Button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full"
              variant="outline"
            >
              {uploading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>
              ) : (
                <><FileUp className="w-4 h-4 mr-2" />Choose File</>
              )}
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
              Remove all records from the Master Syllabus. This action cannot be undone.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              onClick={purgeSyllabus}
              disabled={purging}
              className="w-full"
            >
              {purging ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Purging...</>
              ) : (
                <><AlertTriangle className="w-4 h-4 mr-2" />Purge All Records</>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </AccessGate>
  );
}