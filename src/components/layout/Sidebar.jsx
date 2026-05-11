import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { usePersonnel } from '@/lib/usePersonnel';
import { hasAccess, ACCESS_LEVELS, LEVEL_NAMES } from '@/lib/accessLevels';
import {
  LayoutDashboard, Users, BookOpen, Calendar, ClipboardList,
  FileCheck, Brain, CheckSquare, Settings, HelpCircle, Shield,
  ChevronLeft, ChevronRight, BookOpenCheck, LogOut, FileDown,
  CalendarDays, ClipboardCheck, Megaphone, ShieldCheck, Crosshair
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';

// Grouped navigation structure
const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { path: '/', label: 'Dashboard', icon: LayoutDashboard, level: 0 },
      { path: '/notices', label: 'Notices', icon: Megaphone, level: 0 },
      { path: '/calendar', label: 'Training Calendar', icon: CalendarDays, level: 0 },
    ],
  },
  {
    label: 'Training',
    items: [
      { path: '/parade', label: 'Parade State', icon: ClipboardList, level: 1 },
      { path: '/attendance', label: 'Lesson Attendance', icon: FileCheck, level: 2 },
      { path: '/schedule', label: 'Training Plan', icon: Calendar, level: 2 },
      { path: '/training-plan-export', label: 'Export PDF', icon: FileDown, level: 3 },
    ],
  },
  {
    label: 'Syllabus & Progress',
    items: [
      { path: '/syllabus', label: 'Syllabus', icon: BookOpen, level: 0 },
      { path: '/personal-syllabus', label: 'My Syllabus', icon: BookOpenCheck, level: 0 },
      { path: '/progress', label: 'Progress Matrix', icon: Brain, level: 3 },
      { path: '/bulk-progress', label: 'Bulk Progress Entry', icon: ClipboardCheck, level: 4 },
      { path: '/tasks', label: 'Task List', icon: CheckSquare, level: 3 },
    ],
  },
  {
    label: 'Governance',
    items: [
      { path: '/cfav-governance', label: 'CFAV Governance', icon: ShieldCheck, level: 3 },
      { path: '/wht', label: 'Weapon Handling Tests', icon: Crosshair, level: 0 },
      { path: '/training-manager', label: 'Training Manager', icon: Brain, level: 4 },
    ],
  },
  {
    label: 'Administration',
    items: [
      { path: '/personnel', label: 'Personnel', icon: Users, level: 5 },
      { path: '/admin', label: 'Admin Controls', icon: Settings, level: 5 },
    ],
  },
  {
    label: 'Support',
    items: [
      { path: '/help', label: 'Help & Wiki', icon: HelpCircle, level: 0 },
    ],
  },
];

export default function Sidebar({ collapsed, onToggle }) {
  const location = useLocation();
  const { personnel } = usePersonnel();
  const accessLevel = personnel?.AccessLevel ?? 0;

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen bg-sidebar text-sidebar-foreground flex flex-col z-50 transition-all duration-300 border-r border-sidebar-border",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-sidebar-border shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0">
            <Shield className="w-4 h-4 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="font-bold text-sm truncate text-sidebar-foreground">ACF Training</h1>
              <p className="text-xs text-sidebar-foreground/60 truncate">Manager</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {NAV_GROUPS.map(group => {
          const visibleItems = group.items.filter(item => hasAccess(accessLevel, item.level));
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.label} className="mb-2">
              {!collapsed && (
                <p className="text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-wider px-3 py-1.5">
                  {group.label}
                </p>
              )}
              {collapsed && <div className="my-1 border-t border-sidebar-border/40" />}
              <div className="space-y-0.5">
                {visibleItems.map(item => {
                  const isActive = location.pathname === item.path;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                      )}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon className={cn("w-4 h-4 shrink-0", isActive && "text-sidebar-primary")} />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User Info */}
      <div className="p-3 border-t border-sidebar-border shrink-0">
        {!collapsed && personnel && (
          <div className="mb-2 px-2">
            <p className="text-xs font-semibold text-sidebar-foreground truncate">{personnel.Surname}</p>
            <p className="text-xs text-sidebar-foreground/50">{LEVEL_NAMES[accessLevel]}</p>
          </div>
        )}
        <div className="flex items-center gap-1">
          <button
            onClick={onToggle}
            className="p-2 rounded-lg hover:bg-sidebar-accent/50 text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
          {!collapsed && (
            <button
              onClick={() => base44.auth.logout()}
              className="flex items-center gap-2 p-2 rounded-lg text-sidebar-foreground/60 hover:bg-destructive/20 hover:text-destructive transition-colors text-xs flex-1"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}