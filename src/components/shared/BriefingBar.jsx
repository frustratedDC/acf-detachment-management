import React, { useState } from 'react';
import { AlertTriangle, X, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function BriefingBar({ reason, details = [], estimatedCompletion, onDismiss }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={cn(
      'w-full border-b-2 border-amber-300/50 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 mb-6',
      'flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3'
    )}>
      {/* Main alert content */}
      <div className="flex gap-3 flex-1">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-amber-900 dark:text-amber-100">
            Work in Progress
          </p>
          <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">
            {reason}
          </p>

          {/* Expandable details */}
          {details.length > 0 && (
            <>
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs text-amber-700 dark:text-amber-300 hover:underline mt-2 font-medium"
              >
                {expanded ? 'Hide' : 'Show'} Details ({details.length})
              </button>
              {expanded && (
                <ul className="text-xs text-amber-700 dark:text-amber-300 mt-2 space-y-1 ml-4 list-disc">
                  {details.map((detail, i) => (
                    <li key={i}>{detail}</li>
                  ))}
                </ul>
              )}
            </>
          )}

          {estimatedCompletion && (
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
              Estimated completion: <span className="font-semibold">{estimatedCompletion}</span>
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 shrink-0">
        <Button
          size="sm"
          variant="outline"
          className="text-amber-700 border-amber-300 hover:bg-amber-100 dark:text-amber-300 dark:border-amber-700 dark:hover:bg-amber-900/50"
          onClick={() => setExpanded(!expanded)}
        >
          <FileText className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Audit Notes</span>
        </Button>

        {onDismiss && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onDismiss}
            className="text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/50"
            title="Dismiss this notification"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}