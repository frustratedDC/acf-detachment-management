import React, { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import AccessGate from '@/components/shared/AccessGate';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings, Upload, Trash2, AlertTriangle, Loader2, FileUp } from 'lucide-react';
import { toast } from 'sonner';
import { ACCESS_LEVELS } from '@/lib/accessLevels';

export default function AdminControls() {
  const queryClient = useQueryClient();
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [purging, setPurging] = useState(false);

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
        {/* CSV Upload */}
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