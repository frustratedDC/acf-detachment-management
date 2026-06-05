import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dumbbell, ArrowRight, History } from 'lucide-react';
import { Link } from 'react-router-dom';

/** SVG ring showing progress of currentPoints toward a target */
function ProgressRing({ points, target, size = 88 }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const pct = target > 0 ? Math.min(1, points / target) : 0;
  const dash = pct * circ;

  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={8} stroke="hsl(var(--muted))" fill="none" />
      <circle
        cx={size / 2} cy={size / 2} r={r} strokeWidth={8}
        stroke={pct >= 1 ? 'hsl(var(--chart-2))' : 'hsl(var(--primary))'}
        fill="none"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.5s ease' }}
      />
    </svg>
  );
}

// Per-level KA point targets (advisory milestone)
const KA_TARGETS = { Basic: 50, '1 Star': 75, '2 Star': 100, '3 Star': 150, '4 Star': 200 };

export default function KADashboardWidget({ personnel }) {
  const pnum = personnel?.PNumber;
  const starLevel = personnel?.CurrentStarLevel;
  const promotionDate = personnel?.PromotionDate || null;

  const { data: allEntries = [], isLoading } = useQuery({
    queryKey: ['ka-logbook-mine', pnum],
    queryFn: () => base44.entities.KA_LogBook.filter({ Name: pnum }),
    enabled: !!pnum,
  });

  // Lifetime total — all records ever
  const lifetimePoints = allEntries.reduce((s, e) => s + (e.Points || 0), 0);

  // Current level — only entries on/after PromotionDate
  const currentLevelPoints = allEntries
    .filter(e => !promotionDate || (e.Date && e.Date >= promotionDate))
    .reduce((s, e) => s + (e.Points || 0), 0);

  const target = KA_TARGETS[starLevel] || 100;

  if (isLoading) return null;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Dumbbell className="w-4 h-4 text-primary" />
            Keeping Active
          </CardTitle>
          <Link to="/keeping-active">
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
              Tracker <ArrowRight className="w-3 h-3" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-5">
          {/* Progress ring — current level */}
          <div className="relative shrink-0" style={{ width: 88, height: 88 }}>
            <ProgressRing points={currentLevelPoints} target={target} size={88} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-bold leading-none">{currentLevelPoints}</span>
              <span className="text-[9px] text-muted-foreground leading-tight text-center">pts</span>
            </div>
          </div>

          {/* Text breakdown */}
          <div className="flex-1 space-y-2.5">
            <div>
              <p className="text-xs font-semibold text-foreground">
                {starLevel} Progress
              </p>
              <p className="text-xs text-muted-foreground">
                {currentLevelPoints} / {target} pts
                {currentLevelPoints >= target && (
                  <span className="ml-1.5 text-chart-2 font-semibold">✓ Target Met</span>
                )}
              </p>
              <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                <div
                  className={`rounded-full h-1.5 transition-all ${currentLevelPoints >= target ? 'bg-chart-2' : 'bg-primary'}`}
                  style={{ width: `${Math.min(100, (currentLevelPoints / target) * 100)}%` }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Lifetime Total</p>
                <p className="text-xl font-bold text-foreground">{lifetimePoints} <span className="text-xs font-normal text-muted-foreground">pts</span></p>
              </div>
              <Link to="/keeping-active?tab=history">
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                  <History className="w-3 h-3" />
                  History
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}