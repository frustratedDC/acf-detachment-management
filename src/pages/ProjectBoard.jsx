import React, { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import AccessGate from '@/components/shared/AccessGate';
import PageHeader from '@/components/shared/PageHeader';
import { ACCESS_LEVELS } from '@/lib/accessLevels';
import { Kanban } from 'lucide-react';
import { ALL_PAGES } from '@/lib/allPages';

const COLUMNS = ['Backlog', 'Development', 'QA', 'Live'];
const SETTING_PREFIX = 'feature_status:';

export default function ProjectBoard() {
  const queryClient = useQueryClient();

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ['detachment-settings-feature-status'],
    queryFn: () => base44.entities.DetachmentSettings.filter({}),
  });

  const statusByPath = useMemo(() => {
    const map = {};
    settings.forEach(s => {
      if (s.Key?.startsWith(SETTING_PREFIX)) {
        map[s.Key.slice(SETTING_PREFIX.length)] = s.Value;
      }
    });
    return map;
  }, [settings]);

  const getStatus = (path) => statusByPath[path] || 'Backlog';

  const handleCycle = async (path) => {
    const current = getStatus(path);
    const nextIndex = (COLUMNS.indexOf(current) + 1) % COLUMNS.length;
    const nextStatus = COLUMNS[nextIndex];
    const key = `${SETTING_PREFIX}${path}`;
    const existing = settings.find(s => s.Key === key);
    if (existing) {
      await base44.entities.DetachmentSettings.update(existing.id, { Value: nextStatus });
    } else {
      await base44.entities.DetachmentSettings.create({ Key: key, Value: nextStatus, Description: `Feature status for ${path}` });
    }
    queryClient.invalidateQueries({ queryKey: ['detachment-settings-feature-status'] });
  };

  if (isLoading) {
    return (
      <AccessGate level={ACCESS_LEVELS.SYSTEM_ADMIN}>
        <PageHeader title="Project Board" description="Loading..." icon={Kanban} />
      </AccessGate>
    );
  }

  return (
    <AccessGate level={ACCESS_LEVELS.SYSTEM_ADMIN}>
      <PageHeader
        title="Project Board"
        description="Every page in the app, tracked by lifecycle status. Click a card to advance its status."
        icon={Kanban}
      />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {COLUMNS.map(col => {
          const pages = ALL_PAGES.filter(p => getStatus(p.path) === col);
          return (
            <div key={col} className="bg-muted/40 rounded-xl p-3 min-h-[200px]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold uppercase tracking-wide text-foreground">{col}</h3>
                <span className="text-xs text-muted-foreground">{pages.length}</span>
              </div>
              <div className="space-y-2">
                {pages.map(p => (
                  <button
                    key={p.path}
                    onClick={() => handleCycle(p.path)}
                    className="w-full text-left bg-card border rounded-lg px-3 py-2 text-sm hover:shadow-md transition-shadow"
                  >
                    <p className="font-medium truncate">{p.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{p.path}</p>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </AccessGate>
  );
}