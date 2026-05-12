import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { cn } from '@/lib/utils';
import { usePersonnel } from '@/lib/usePersonnel';
import { Menu, Eye, X } from 'lucide-react';

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { viewAs, setViewAs } = usePersonnel();

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-sidebar border-b border-sidebar-border flex items-center gap-3 px-4">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent/50 transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5 text-sidebar-foreground" />
        </button>
        <span className="font-bold text-sm text-sidebar-foreground flex-1 truncate">ACF Training Manager</span>
        {viewAs && (
          <div className="flex items-center gap-1.5 bg-accent/20 rounded-lg px-2 py-1 shrink-0">
            <Eye className="w-3 h-3 text-accent-foreground" />
            <span className="text-xs text-accent-foreground font-medium max-w-20 truncate">{viewAs.Surname}</span>
            <button onClick={() => setViewAs(null)}><X className="w-3 h-3 text-destructive" /></button>
          </div>
        )}
      </div>

      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-[55] bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* ViewAs banner — desktop only */}
      {viewAs && (
        <div
          className={cn(
            "hidden md:flex fixed top-0 right-0 z-30 items-center gap-2 px-4 py-1.5 text-xs font-medium bg-accent/90 text-accent-foreground transition-all",
            collapsed ? "left-16" : "left-64"
          )}
        >
          <Eye className="w-3.5 h-3.5" />
          Viewing as: {[viewAs.Rank, viewAs.FirstName, viewAs.Surname].filter(Boolean).join(' ')}
          <button
            onClick={() => setViewAs(null)}
            className="ml-2 flex items-center gap-1 text-destructive font-bold hover:underline"
          >
            <X className="w-3 h-3" /> Exit View As
          </button>
        </div>
      )}

      <main
        className={cn(
          "transition-all duration-300 min-h-screen",
          "pt-14 md:pt-0",
          viewAs && "md:pt-7",
          collapsed ? "md:ml-16" : "md:ml-64"
        )}
      >
        <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}