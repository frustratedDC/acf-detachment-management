import React, { useState } from 'react';
import { AlertTriangle, X, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function BriefingBar({ reason, details = [], estimatedCompletion, onDismiss }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={cn(
      'w-full px-4 py-3 mb-6 border-b-2',
      'flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3'
    )}
      style={{ background: '#C8102E', borderColor: '#8B0A1E' }}
    >
      {/* Main alert content */}
      <div className="flex gap-3 flex-1">
        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: '#FFD700' }} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-white">
            Action Required
          </p>
          <p className="text-sm text-white/90 mt-1">
            {reason}
          </p>

          {details.length > 0 && (
            <>
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs text-white/80 hover:text-white hover:underline mt-2 font-medium"
              >
                {expanded ? 'Hide' : 'Show'} Details ({details.length})
              </button>
              {expanded && (
                <ul className="text-xs text-white/80 mt-2 space-y-1 ml-4 list-disc">
                  {details.map((detail, i) => (
                    <li key={i}>{detail}</li>
                  ))}
                </ul>
              )}
            </>
          )}

          {estimatedCompletion && (
            <p className="text-xs text-white/70 mt-2">
              Estimated completion: <span className="font-semibold text-white">{estimatedCompletion}</span>
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 shrink-0">
        <Button
          size="sm"
          variant="outline"
          className="border-white/40 text-white hover:bg-white/10 hover:text-white"
          onClick={() => setExpanded(!expanded)}
        >
          <FileText className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Details</span>
        </Button>

        {onDismiss && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onDismiss}
            className="text-white hover:bg-white/10"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}