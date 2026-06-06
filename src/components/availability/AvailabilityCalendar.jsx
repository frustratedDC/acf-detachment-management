import React, { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, parseISO } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function AvailabilityCalendar({ availability, onDayToggle, isLoading }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Map availability by date for quick lookup
  const availabilityByDate = useMemo(() => {
    const map = {};
    availability.forEach(a => {
      map[a.Date] = a;
    });
    return map;
  }, [availability]);

  const handleDayClick = (date) => {
    if (isLoading) return;
    const dateStr = format(date, 'yyyy-MM-dd');
    const existing = availabilityByDate[dateStr];
    
    if (existing) {
      // Toggle status
      const newStatus = existing.Status === 'Available' ? 'Unavailable' : 'Available';
      onDayToggle(dateStr, newStatus, existing.id);
    } else {
      // Create new record as Available
      onDayToggle(dateStr, 'Available', null);
    }
  };

  const getDayStatus = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return availabilityByDate[dateStr];
  };

  const getDayColor = (status) => {
    if (!status) return 'bg-muted/30 hover:bg-muted/50';
    return status.Status === 'Available' 
      ? 'bg-chart-2/20 hover:bg-chart-2/30 border-chart-2/30' 
      : 'bg-amber-100/40 hover:bg-amber-100/50 border-amber-200/50';
  };

  // Get first day of week (0 = Sunday)
  const firstDayOfWeek = monthStart.getDay();
  const daysBeforeMonth = Array(firstDayOfWeek).fill(null);
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{format(currentMonth, 'MMMM yyyy')}</CardTitle>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentMonth(new Date())}
              className="text-xs"
            >
              Today
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 mb-3">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-xs font-semibold text-muted-foreground py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells before month starts */}
          {daysBeforeMonth.map((_, i) => (
            <div key={`before-${i}`} className="aspect-square" />
          ))}

          {/* Days of month */}
          {daysInMonth.map(date => {
            const status = getDayStatus(date);
            const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
            
            return (
              <button
                key={format(date, 'yyyy-MM-dd')}
                onClick={() => handleDayClick(date)}
                disabled={isLoading}
                className={`
                  aspect-square p-1 rounded-lg border text-xs font-semibold transition-colors
                  ${getDayColor(status)}
                  ${isToday ? 'ring-2 ring-primary' : 'border-muted'}
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
                title={status ? `${status.Status}` : 'Click to toggle'}
              >
                <div className="flex flex-col h-full items-center justify-center gap-0.5">
                  <span>{format(date, 'd')}</span>
                  {status && (
                    <span className={`text-[10px] font-bold ${
                      status.Status === 'Available' ? 'text-chart-2' : 'text-amber-700'
                    }`}>
                      {status.Status === 'Available' ? '✓' : '✕'}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex gap-4 mt-4 text-xs pt-4 border-t">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-chart-2/20 border border-chart-2/30" />
            <span>Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-amber-100/40 border border-amber-200/50" />
            <span>Unavailable</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-muted/30" />
            <span>No record</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}