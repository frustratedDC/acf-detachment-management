import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { usePersonnel } from '@/lib/usePersonnel';
import { hasAccess, ACCESS_LEVELS, LEVEL_NAMES, isAdultInstructor } from '@/lib/accessLevels';
import {
  LayoutDashboard, Users, BookOpen, Calendar, ClipboardList,
  FileCheck, Brain, CheckSquare, Settings, HelpCircle, Shield,
  ChevronLeft, ChevronRight, BookOpenCheck, LogOut, FileDown,
  CalendarDays, ClipboardCheck, Megaphone, ShieldCheck, Crosshair, ChevronDown,
  CalendarCheck, GraduationCap, BarChart2, Wand2, Dumbbell, Trophy, TrendingUp, FolderOpen
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { path: '/', label: 'Dashboard', icon: LayoutDashboard, level: 0 },
    ],
  },
  {
    label: 'My Progress',
    items: [
      { path: '/my-progress', label: 'My Progress', icon: TrendingUp, level: 0 },
    ],
    hideIfAdult: true,
  },
  {
    label: 'Detachment Training',
    items: [
      { path: '/calendar', label: 'View Calendar', icon: CalendarDays, level: 0 },
      { path: '/schedule', label: 'Monthly Training Plan', icon: Calendar, level: 0 },
      { path: '/training-calendar', label: 'Upcoming Training/Events', icon: CalendarCheck, level: 0 },
    ],
  },
  {
    label: 'Attendance',
    items: [
      { path: '/parade', label: 'Parade Nominal Roll', icon: ClipboardList, level: 1 },
      { path: '/attendance', label: 'Lesson Nominal Roll', icon: FileCheck, level: 2 },
    ],
  },
  {
    label: 'Training Planning',
    items: [
      { path: '/tasks', label: 'Task List', icon: CheckSquare, level: 4 },
      { path: '/training-manager', label: 'Training Manager', icon: Brain, level: 4 },
      { path: '/plan-generator', label: 'Plan Generator', icon: Wand2, level: 4 },
      { path: '/training-plan-export', label: 'Export PDF', icon: FileDown, level: 4 },
      { path: '/bulk-progress', label: 'Bulk Progress Entry', icon: ClipboardCheck, level: 4 },
    ],
  },
  {
    label: 'Syllabus',
    items: [
      { path: '/syllabus', label: 'Syllabus', icon: BookOpen, level: 2 },
      { path: '/personal-syllabus', label: 'My Syllabus', icon: BookOpenCheck, level: 2 },
      { path: '/wht', label: 'Weapon Handling Tests', icon: Crosshair, level: 2 },
    ],
  },
  {
    label: 'Staffing',
    items: [
      { path: '/my-governance', label: 'My Governance', icon: ShieldCheck, level: 3 },
      { path: '/my-availability', label: 'My Availability', icon: CalendarCheck, level: 2 },
      { path: '/my-qualifications', label: 'My Qualifications', icon: GraduationCap, level: 2 },
    ],
  },
  {
    label: 'Keeping Active',
    items: [
      { path: '/keeping-active', label: 'Keeping Active Tracker', icon: Dumbbell, level: 0 },
    ],
  },
  {
    label: 'Detachment Management',
    items: [
      { path: '/analytics', label: 'Analytics', icon: BarChart2, level: 4 },
      { path: '/personnel', label: 'Personnel', icon: Users, level: 4 },
      { path: '/accounts', label: 'Accounts', icon: Shield, level: 4 },
      { path: '/cfav-governance', label: 'CFAV Governance', icon: ShieldCheck, level: 4 },
      { path: '/instructor-quals', label: 'Instructor Qualifications', icon: GraduationCap, level: 4 },
      { path: '/all-availability', label: 'All Instructor Availability', icon: CalendarCheck, level: 4 },
      { path: '/form-creator', label: 'Form & Resource Creator', icon: FolderOpen, level: 4 },
      { path: '/admin', label: 'Admin Controls', icon: Settings, level: 4 },
    ],
  },
  {
    label: 'Support',
    items: [
      { path: '/help', label: 'Help & Wiki', icon: HelpCircle, level: 0 },
    ],
  },
];

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }) {
  const location = useLocation();
  const { personnel } = usePersonnel();
  const accessLevel = personnel?.AccessLevel ?? 0;

  // Track which groups are collapsed — all expanded by default
  const [collapsedGroups, setCollapsedGroups] = useState({});

  function toggleGroup(label) {
    setCollapsedGroups(prev => ({ ...prev, [label]: !prev[label] }));
  }

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen bg-sidebar text-sidebar-foreground flex flex-col z-[60] transition-all duration-300 border-r border-sidebar-border",
        // Mobile: slide in/out
        "max-md:transition-transform max-md:duration-300",
        mobileOpen ? "max-md:translate-x-0" : "max-md:-translate-x-full",
        // Desktop: collapse
        collapsed ? "md:w-16" : "md:w-64",
        "w-64"
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
          if (group.hideIfAdult && isAdultInstructor(accessLevel)) return null;
          const isGroupCollapsed = !!collapsedGroups[group.label];
          const hasActiveItem = visibleItems.some(item => location.pathname === item.path);

          return (
            <div key={group.label} className="mb-1">
              {!collapsed ? (
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="w-full flex items-center justify-between px-3 py-1.5 rounded hover:bg-sidebar-accent/30 transition-colors group"
                >
                  <p className={cn(
                    "text-xs font-semibold uppercase tracking-wider transition-colors",
                    hasActiveItem ? "text-sidebar-foreground/80" : "text-sidebar-foreground/40",
                    "group-hover:text-sidebar-foreground/70"
                  )}>
                    {group.label}
                  </p>
                  <ChevronDown className={cn(
                    "w-3 h-3 text-sidebar-foreground/30 transition-transform duration-200",
                    isGroupCollapsed && "-rotate-90"
                  )} />
                </button>
              ) : (
                <div className="my-1 border-t border-sidebar-border/40" />
              )}

              {(!isGroupCollapsed || collapsed) && (
                <div className="space-y-0.5 mt-0.5">
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
              )}
            </div>
          );
        })}
      </nav>

      {/* User Info */}
      <div className="p-3 border-t border-sidebar-border shrink-0">
        {!collapsed && personnel && (
          <div className="mb-2 px-2">
            <p className="text-xs font-semibold text-sidebar-foreground truncate">
              {personnel.Rank && `${personnel.Rank} `}{personnel.FirstName} {personnel.Surname}
            </p>
            <p className="text-xs text-sidebar-foreground/50">{LEVEL_NAMES[accessLevel]}</p>
          </div>
        )}
        <div className="flex items-center gap-1">
          <button
            onClick={onToggle}
            className="p-2 rounded-lg hover:bg-sidebar-accent/50 text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors hidden md:block"
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