import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { usePersonnel } from '@/lib/usePersonnel';
import { ACCESS_LEVELS } from '@/lib/accessLevels';
import PageHeader from '@/components/shared/PageHeader';
import AccessGate from '@/components/shared/AccessGate';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FolderOpen, Plus, Download, Trash2, Loader2, FileUp } from 'lucide-react';
import { toast } from 'sonner';

const CATEGORIES = ['Training', 'Admin', 'Logistics', 'Other'];
const TYPES = ['Form', 'Resource'];

function CreateResourceModal({ queryClient }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('Resource');
  const [category, setCategory] = useState('Training');
  const [file, setFile] = useState(null);
  const fileRef = useRef(null);
  const { personnel: me } = usePersonnel();

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim()) {
        toast.error('Title is required');
        return;
      }

      let fileUrl = null;
      let fileName = null;

      if (file) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        fileUrl = file_url;
        fileName = file.name;
      }

      return base44.entities.DetachmentResources.create({
        Title: title,
        Description: description,
        Type: type,
        Category: category,
        FileUrl: fileUrl,
        FileName: fileName,
        CreatedByPNumber: me?.PNumber,
        IsActive: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['detachment-resources'] });
      toast.success('Resource created successfully');
      setTitle('');
      setDescription('');
      setType('Resource');
      setCategory('Training');
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      setOpen(false);
    },
    onError: (error) => {
      toast.error(`Failed to create resource: ${error.message}`);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Create New Resource
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Resource</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs">Title *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Fieldcraft Lesson Plan"
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-xs">Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="mt-1"
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <Label className="text-xs">Type *</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <Label className="text-xs">Category *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Upload File (PDF/Excel)</Label>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="hidden"
            />
            <Button
              variant="outline"
              className="w-full mt-1 gap-2"
              onClick={() => fileRef.current?.click()}
            >
              <FileUp className="w-4 h-4" />
              {file ? file.name : 'Choose File'}
            </Button>
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ResourceCard({ resource, isDC, onDelete }) {
  const deleteMutation = useMutation({
    mutationFn: () => base44.entities.DetachmentResources.delete(resource.id),
    onSuccess: () => {
      toast.success('Resource deleted');
      onDelete();
    },
    onError: (error) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });

  const typeColor = resource.Type === 'Form' ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary-foreground';

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <CardTitle className="text-base">{resource.Title}</CardTitle>
            <CardDescription className="text-xs mt-1">{resource.Description}</CardDescription>
          </div>
          <Badge className={typeColor}>{resource.Type}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{resource.Category}</span>
          <span className="text-muted-foreground">{new Date(resource.created_date).toLocaleDateString()}</span>
        </div>

        <div className="flex gap-2">
          {resource.FileUrl && (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 gap-1"
              onClick={() => window.open(resource.FileUrl, '_blank')}
            >
              <Download className="w-3 h-3" />
              Download
            </Button>
          )}
          {isDC && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="text-destructive hover:text-destructive"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Trash2 className="w-3 h-3" />
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function FormCreator() {
  const { personnel: me } = usePersonnel();
  const queryClient = useQueryClient();
  const isDC = me?.AccessLevel >= ACCESS_LEVELS.DET_COMMANDER;

  const { data: resources = [], isLoading } = useQuery({
    queryKey: ['detachment-resources'],
    queryFn: () => base44.entities.DetachmentResources.filter({ IsActive: true }),
  });

  const resourcesByCategory = CATEGORIES.reduce((acc, category) => {
    acc[category] = resources.filter((r) => r.Category === category);
    return acc;
  }, {});

  const handleResourceDeleted = () => {
    queryClient.invalidateQueries({ queryKey: ['detachment-resources'] });
  };

  return (
    <AccessGate level={ACCESS_LEVELS.DET_2IC}>
      <PageHeader
        title="Form & Resource Creator"
        description="Manage detachment forms and resources"
        icon={FolderOpen}
        actions={isDC ? <CreateResourceModal queryClient={queryClient} /> : null}
      />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : resources.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FolderOpen className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">No resources yet.</p>
            {isDC && <p className="text-xs text-muted-foreground mt-1">Create one using the button above.</p>}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {CATEGORIES.map((category) => {
            const categoryResources = resourcesByCategory[category];
            if (categoryResources.length === 0) return null;

            return (
              <div key={category}>
                <h2 className="text-lg font-semibold mb-3">{category}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categoryResources.map((resource) => (
                    <ResourceCard
                      key={resource.id}
                      resource={resource}
                      isDC={isDC}
                      onDelete={handleResourceDeleted}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AccessGate>
  );
}