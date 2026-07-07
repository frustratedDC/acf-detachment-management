import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { usePersonnel } from '@/lib/usePersonnel';
import AccessGate from '@/components/shared/AccessGate';
import PageHeader from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClipboardList, Save, Search, UserCheck, UserX, UserMinus, Printer, Download, Shirt } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { ACCESS_LEVELS } from '@/lib/accessLevels';
import UniformInspectionForm from '@/components/inspection/UniformInspectionForm';
import EngagementNoteModal from '@/components/parade/EngagementNoteModal';

export default function ParadeState() {
  const queryClient = useQueryClient();
  const { personnel: me } = usePersonnel();
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [localStatuses, setLocalStatuses] = useState({});
  const [showInspectionForm, setShowInspectionForm] = useState(false);
  const [engagementTarget, setEngagementTarget] = useState(null); // instructor record for modal
  const isDC = (me?.AccessLevel ?? 0) >= ACCESS_LEVELS.DET_COMMANDER;

  const { data: allPersonnelRaw = [] } = useQuery({
    queryKey: ['all-personnel'],
    queryFn: () => base44.entities.PersonnelManager.filter({}),
  });
  const allPersonnel = allPersonnelRaw.filter(p => p.DetachmentID !== 'GLOBAL');

  const { data: existingParade = [] } = useQuery({
    queryKey: ['parade', date],
    queryFn: () => base44.entities.DailyParadeState.filter({ Date: date }),
  });

  useEffect(() => {
    const map = {};
    existingParade.forEach(p => { map[p.UserPNumber] = p.AttendanceStatus; });
    const newLocal = {};
    allPersonnel.forEach(p => {
      newLocal[p.PNumber] = map[p.PNumber] || 'Absent';
    });
    setLocalStatuses(newLocal);
  }, [existingParade, allPersonnel]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      for (const existing of existingParade) {
        await base44.entities.DailyParadeState.delete(existing.id);
      }
      const records = Object.entries(localStatuses).map(([pnum, status]) => ({
        Date: date,
        UserPNumber: pnum,
        AttendanceStatus: status,
      }));
      await base44.entities.DailyParadeState.bulkCreate(records);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parade', date] });
      toast.success('Parade state saved successfully');
    },
  });

  const filtered = allPersonnel.filter(p => {
    // Only show Active personnel on parade state
    if ((p.PersonnelStatus || 'Active') !== 'Active') return false;
    const matchSearch = p.Surname?.toLowerCase().includes(search.toLowerCase()) ||
      p.PNumber?.toLowerCase().includes(search.toLowerCase()) ||
      p.FirstName?.toLowerCase().includes(search.toLowerCase()) ||
      p.RoleName?.toLowerCase().includes(search.toLowerCase()) ||
      p.Rank?.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'all' || p.Type === typeFilter;
    return matchSearch && matchType;
  });

  const presentCount = Object.values(localStatuses).filter(s => s === 'Present').length;
  const absentCount = Object.values(localStatuses).filter(s => s === 'Absent').length;
  const excusedCount = Object.values(localStatuses).filter(s => s === 'Excused').length;

  function togglePresent(pnum) {
    setLocalStatuses(prev => {
      const cur = prev[pnum] || 'Absent';
      return { ...prev, [pnum]: cur === 'Present' ? 'Absent' : 'Present' };
    });
  }

  async function handleEngagementConfirm({ reason, notes, tags }) {
    const p = engagementTarget;
    setEngagementTarget(null);
    setLocalStatuses(prev => ({ ...prev, [p.PNumber]: 'Absent' }));
    const name = [p.Rank, p.FirstName, p.Surname].filter(Boolean).join(' ');
    await base44.entities.InstructorAttendanceLedger.create({
      InstructorPNumber: p.PNumber,
      InstructorName: name,
      Date: date,
      AttendanceStatus: 'Absent',
      Reason: reason,
      EngagementNotes: notes,
      QuickTags: tags,
      RecordedByPNumber: me?.PNumber,
    });
    toast.success(`Not Attended recorded for ${name}`);
  }

  function setExcused(pnum) {
    setLocalStatuses(prev => ({
      ...prev, [pnum]: prev[pnum] === 'Excused' ? 'Absent' : 'Excused'
    }));
  }

  const { data: detSettings = [] } = useQuery({
    queryKey: ['det-settings'],
    queryFn: () => base44.entities.DetachmentSettings.filter({}),
  });
  const detName = detSettings.find(s => s.Key === 'detachment_name')?.Value || 'ACF DETACHMENT';
  const canEdit = (me?.AccessLevel ?? 0) >= ACCESS_LEVELS.CADET_NCO;

  function exportCSV() {
    const rows = [['Rank','Surname','First Name','PNumber','Type','Status']];
    filtered.forEach(p => rows.push([p.Rank || '', p.Surname || '', p.FirstName || '', p.PNumber, p.Type || '', localStatuses[p.PNumber] || 'Absent']));
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `ParadeState_${date}.csv`; a.click();
  }

  function exportPDF() {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = 210;
    const margin = 15;
    const usableW = pageW - margin * 2;

    // Header
    doc.setFillColor(8, 63, 48);
    doc.rect(0, 0, pageW, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text(detName.toUpperCase(), pageW / 2, 10, { align: 'center' });
    doc.setFontSize(11); doc.setFont('helvetica', 'normal');
    doc.text('PARADE NIGHT NOMINAL ROLL', pageW / 2, 17, { align: 'center' });
    doc.setFontSize(9);
    doc.text(format(new Date(date + 'T00:00:00'), 'MMMM yyyy').toUpperCase(), pageW / 2, 24, { align: 'center' });

    doc.setTextColor(0, 0, 0);
    let y = 36;
    const rowH = 7;

    // Summary
    doc.setFontSize(8);
    doc.text(`Present: ${presentCount}   Absent: ${absentCount}   Excused: ${excusedCount}   Total: ${filtered.length}`, margin, y);
    y += 8;

    // Table header
    const cols = [30, 30, 25, 40, 25];
    const headers = ['Rank', 'Surname', 'First Name', 'PNumber', 'Status'];
    doc.setFillColor(220, 235, 225);
    doc.rect(margin, y, usableW, rowH, 'F');
    let cx = margin;
    headers.forEach((h, i) => {
      doc.setFontSize(7.5); doc.setFont('helvetica', 'bold');
      doc.text(h, cx + 2, y + 5);
      cx += cols[i];
    });
    y += rowH;

    filtered.forEach((p, ri) => {
      if (y > 270) { doc.addPage(); y = 20; }
      const status = localStatuses[p.PNumber] || 'Absent';
      if (ri % 2 === 0) { doc.setFillColor(248, 252, 250); doc.rect(margin, y, usableW, rowH, 'F'); }
      const cells = [p.Rank || '', p.Surname || '', p.FirstName || '', p.PNumber, status];
      cx = margin;
      cells.forEach((cell, i) => {
        doc.setFontSize(7); doc.setFont('helvetica', status === 'Present' ? 'bold' : 'normal');
        doc.setTextColor(status === 'Absent' ? 100 : status === 'Excused' ? 80 : 8, status === 'Absent' ? 100 : status === 'Excused' ? 110 : 63, status === 'Absent' ? 100 : status === 'Excused' ? 80 : 48);
        doc.text(String(cell), cx + 2, y + 5);
        cx += cols[i];
      });
      doc.setDrawColor(210, 225, 215); doc.setLineWidth(0.1);
      doc.line(margin, y + rowH, margin + usableW, y + rowH);
      y += rowH;
    });

    doc.setFillColor(8, 63, 48);
    doc.rect(0, 287, pageW, 10, 'F');
    doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(180, 220, 190);
    doc.text(`Generated ${format(new Date(), 'dd/MM/yyyy HH:mm')} · OFFICIAL`, pageW / 2, 293, { align: 'center' });

    doc.save(`ParadeState_${date}.pdf`);
  }

  return (
    <AccessGate level={ACCESS_LEVELS.GENERAL}>
      <PageHeader
        title="Parade State"
        description="Daily Nominal Roll — tick Present for First Parade"
        icon={ClipboardList}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
            <Button variant="outline" size="sm" onClick={exportPDF}><Printer className="w-4 h-4 mr-1.5" />PDF</Button>
            <Button variant="outline" size="sm" onClick={exportCSV}><Download className="w-4 h-4 mr-1.5" />CSV</Button>
            {(me?.AccessLevel ?? 0) >= ACCESS_LEVELS.DET_2IC && (
              <Button variant="outline" size="sm" onClick={() => setShowInspectionForm(true)}>
                <Shirt className="w-4 h-4 mr-1.5" />Inspect
              </Button>
            )}
            {canEdit && (
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                <Save className="w-4 h-4 mr-2" />
                {saveMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card className="bg-chart-2/5 border-chart-2/20">
          <CardContent className="p-3 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-chart-2" />
            <span className="text-sm font-medium">Present: {presentCount}</span>
          </CardContent>
        </Card>
        <Card className="bg-destructive/5 border-destructive/20">
          <CardContent className="p-3 flex items-center gap-2">
            <UserX className="w-4 h-4 text-destructive" />
            <span className="text-sm font-medium">Absent: {absentCount}</span>
          </CardContent>
        </Card>
        <Card className="bg-accent/10 border-accent/20">
          <CardContent className="p-3 flex items-center gap-2">
            <UserMinus className="w-4 h-4 text-accent-foreground" />
            <span className="text-sm font-medium">Excused: {excusedCount}</span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search name, PNumber, rank, role..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Cadet">Cadets</SelectItem>
                <SelectItem value="Adult Instructor">Instructors</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {filtered.map((p) => {
              const status = localStatuses[p.PNumber] || 'Absent';
              return (
                <div key={p.PNumber} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={status === 'Present'}
                      onCheckedChange={() => canEdit && togglePresent(p.PNumber)}
                      disabled={!canEdit}
                      className="data-[state=checked]:bg-chart-2 data-[state=checked]:border-chart-2"
                    />
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {p.Surname?.[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{[p.Rank, p.FirstName, p.Surname].filter(Boolean).join(' ')}</p>
                      <p className="text-xs text-muted-foreground">{p.PNumber} · {p.RoleName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={status === 'Present' ? 'default' : status === 'Excused' ? 'outline' : 'secondary'}
                      className={`text-xs ${status === 'Present' ? 'bg-chart-2/20 text-chart-2 border-chart-2/30' : status === 'Excused' ? 'border-accent/40 text-accent-foreground' : ''}`}
                    >
                      {status}
                    </Badge>
                    {canEdit && (
                      <button
                        onClick={() => setExcused(p.PNumber)}
                        className="text-xs px-2 py-1 rounded text-muted-foreground hover:bg-accent/20 hover:text-accent-foreground transition-colors"
                      >
                        {status === 'Excused' ? 'Unexcuse' : 'Excuse'}
                      </button>
                    )}
                    {isDC && p.Type === 'Adult Instructor' && (
                      <button
                        onClick={() => setEngagementTarget(p)}
                        className="text-xs px-2 py-1 rounded text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive transition-colors"
                        title="Record Not Attended (DC only)"
                      >
                        Not Attended
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-center py-8 text-muted-foreground text-sm">No personnel found.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {showInspectionForm && (
        <UniformInspectionForm
          onClose={() => setShowInspectionForm(false)}
          onSuccess={() => setShowInspectionForm(false)}
        />
      )}

      {engagementTarget && (
        <EngagementNoteModal
          instructor={engagementTarget}
          onConfirm={handleEngagementConfirm}
          onCancel={() => setEngagementTarget(null)}
        />
      )}
    </AccessGate>
  );
}