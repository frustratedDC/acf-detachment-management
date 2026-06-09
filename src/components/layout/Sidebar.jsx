import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { usePersonnel } from '@/lib/usePersonnel';
import { hasAccess, ACCESS_LEVELS, LEVEL_NAMES, isAdultInstructor } from '@/lib/accessLevels';
import {
  LayoutDashboard, Users, BookOpen, Calendar, ClipboardList,
  FileCheck, Brain, Settings, HelpCircle, Shield,
  ChevronLeft, ChevronRight, BookOpenCheck, LogOut, FileDown,
  CalendarDays, ClipboardCheck, Megaphone, ShieldCheck, Crosshair, ChevronDown,
  CalendarCheck, GraduationCap, BarChart2, Wand2, Dumbbell, TrendingUp, FolderOpen,
  AlertCircle, Shirt, HeartHandshake, FileText, BookMarked,
  Star, Layers, UserCheck, Swords, Eye, ClipboardPen, UserCog,
  UsersRound, BadgeCheck, MapPin, ReceiptText, Cog
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';

// ── Navigation structure ───────────────────────────────────────────────────────
// Each group optionally has `separator: true` to render a section divider above it.
// `level` maps directly to ACCESS_LEVELS numeric values (L1=1, L2=2, etc.).
const NAV_GROUPS = [
  // ── 1. Dashboard ─────────────────────────────────────────────────────────────
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    items: [
      { path: '/',             label: 'Command Hub',       icon: LayoutDashboard, level: 0 },
      { path: '/notices',      label: 'Notices',           icon: Megaphone,       level: 0 },
      { path: '/calendar',     label: 'Monthly Calendar',  icon: CalendarDays,    level: 0 },
      { path: '/healthy-minds',label: 'Healthy Minds',     icon: HeartHandshake,  level: 0 },
      { path: '/tasks',        label: 'DC/2IC Task List',  icon: ClipboardList,   level: 1 },
    ],
  },

  // ── 2. Me (cadet-facing, level 0+) ──────────────────────────────────────────
  {
    label: 'Me',
    icon: UserCheck,
    items: [
      { path: '/my-progress',       label: 'My Progress',       icon: TrendingUp,     level: 0 },
      { path: '/community-engagement', label: 'CE / KA',        icon: Dumbbell,       level: 0 },
      { path: '/uniform-exchange',  label: 'Uniform Requests',  icon: Shirt,          level: 0 },
      { path: '/course-request',    label: 'Course Requests',   icon: BookOpen,       level: 0 },
      { path: '/report-issue',      label: 'Report an Issue',   icon: AlertCircle,    level: 0 },
      { path: '/forms-resources',   label: 'Forms & Resources', icon: FolderOpen,     level: 0 },
      { path: '/my-availability',   label: 'My Availability',   icon: CalendarCheck,  level: 1 },
      { path: '/my-qualifications', label: 'My Qualifications', icon: GraduationCap,  level: 1 },
      { path: '/my-governance',     label: 'My Governance',     icon: ShieldCheck,    level: 1 },
    ],
  },

  // ── 3. Cadets ────────────────────────────────────────────────────────────────
  {
    label: 'Cadets',
    icon: Star,
    separator: true,
    separatorLabel: 'DETACHMENT MANAGEMENT',
    items: [
      { path: '/personnel',           label: 'Cadet Profiles',        icon: Users,         level: 2 },
      { path: '/progress',            label: 'Progress Matrix',       icon: Layers,        level: 2 },
      { path: '/wht',                 label: 'Cadet WHTs',            icon: Crosshair,     level: 2 },
      { path: '/my-logbooks',         label: 'Cadet Logbooks',        icon: BookMarked,    level: 2 },
      { path: '/instructor-engagement',label: 'Discipline / SG Log', icon: Swords,        level: 3 },
      { path: '/uniform-exchange',    label: 'Uniform Requests',      icon: Shirt,         level: 2 },
      { path: '/course-request',      label: 'Course Requests',       icon: BookOpen,      level: 2 },
      { path: '/report-issue',        label: 'Issues Log',            icon: AlertCircle,   level: 2 },
    ],
  },

  // ── 4. CFAVs ─────────────────────────────────────────────────────────────────
  {
    label: 'CFAVs',
    icon: UsersRound,
    items: [
      { path: '/personnel',          label: 'CFAV Nominal Roll',   icon: UserCog,       level: 3 },
      { path: '/instructor-quals',   label: 'CFAV Qualifications', icon: BadgeCheck,    level: 3 },
      { path: '/cfav-governance',    label: 'CFAV Governance',     icon: ShieldCheck,   level: 3 },
      { path: '/all-availability',   label: 'CFAV Availability',   icon: CalendarCheck, level: 3 },
      { path: '/instructor-engagement', label: 'Engagement Log',   icon: Swords,        level: 5 },
      { path: '/my-availability',    label: 'My Availability',     icon: CalendarCheck, level: 3, adultOnly: true },
      { path: '/my-qualifications',  label: 'My Qualifications',   icon: BadgeCheck,    level: 3, adultOnly: true },
      { path: '/my-governance',      label: 'My Governance',       icon: ShieldCheck,   level: 3, adultOnly: true },
    ],
  },

  // ── 5. Training ──────────────────────────────────────────────────────────────
  {
    label: 'Training',
    icon: BookOpen,
    items: [
      { path: '/parade',               label: 'Parade Nominal Roll',  icon: ClipboardList,  level: 2 },
      { path: '/attendance',           label: 'Lesson Nominal Roll',  icon: FileCheck,      level: 2 },
      { path: '/schedule',             label: 'Training Plan',        icon: Calendar,       level: 2 },
      { path: '/training-manager',     label: 'Training Manager',     icon: Brain,          level: 3 },
      { path: '/community-engagement', label: 'CE / KA Session Entry',icon: Dumbbell,       level: 2 },
      { path: '/wht',                  label: 'WHTs',                 icon: Crosshair,      level: 3, adultOnly: true },
      { path: '/bulk-progress',        label: 'Bulk Progress Entry',  icon: ClipboardCheck, level: 3 },
      { path: '/syllabus',             label: 'Syllabus',             icon: BookOpen,       level: 3 },
      { path: '/personal-syllabus',    label: 'My Syllabus',          icon: BookOpenCheck,  level: 3 },
      { path: '/plan-generator',       label: 'AI Plan Generator',    icon: Wand2,          level: 3 },
      { path: '/training-plan-export', label: 'Export PDF',           icon: FileDown,       level: 3 },
    ],
  },

  // ── 6. Detachment ────────────────────────────────────────────────────────────
  {
    label: 'Detachment',
    icon: MapPin,
    items: [
      { path: '/analytics',       label: 'Analytics',            icon: BarChart2,  level: 4 },
      { path: '/monthly-reports', label: 'Monthly Reports',      icon: FileText,   level: 4 },
      { path: '/accounts',        label: 'Accounts',             icon: ReceiptText,level: 4 },
      { path: '/forms-resources', label: 'Forms & Resources',    icon: FolderOpen, level: 4 },
      { path: '/admin',           label: 'Detachment Settings',  icon: Cog,        level: 4 },
    ],
  },

  // ── System Admin ─────────────────────────────────────────────────────────────
  {
    label: 'System Admin',
    icon: Settings,
    items: [
      { path: '/admin', label: 'Global Settings', icon: Settings, level: 6 },
    ],
  },
];

// Help is always visible at the bottom, fixed — not part of collapsible groups
const HELP_ITEM = { path: '/help', label: 'Help & Wiki', icon: HelpCircle };

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }) {
  const location = useLocation();
  const { personnel } = usePersonnel();
  const accessLevel = personnel?.AccessLevel ?? 0;
  const isAdult = isAdultInstructor(accessLevel);

  const getDefaultCollapsed = () => {
    const state = {};
    NAV_GROUPS.forEach(g => {
      const hasActive = g.items.some(i => location.pathname === i.path);
      state[g.label] = !hasActive;
    });
    return state;
  };
  const [collapsedGroups, setCollapsedGroups] = useState(getDefaultCollapsed);

  function toggleGroup(label) {
    setCollapsedGroups(prev => ({ ...prev, [label]: !prev[label] }));
  }

  function isItemVisible(item) {
    if (!hasAccess(accessLevel, item.level)) return false;
    if (item.adultOnly && !isAdult) return false;
    // cfavOnly items are deduplicated paths shared between groups — always show if access passes
    return true;
  }

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen flex flex-col z-[60] transition-all duration-300 border-r border-sidebar-border",
        "max-md:transition-transform max-md:duration-300",
        mobileOpen ? "max-md:translate-x-0" : "max-md:-translate-x-full",
        collapsed ? "md:w-16" : "md:w-60",
        "w-60"
      )}
      style={{ background: '#0B3D2E' }}
    >
      {/* Header / Branding */}
      <div className="p-3 border-b border-sidebar-border shrink-0">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs"
            style={{ background: '#D4AF37', color: '#0B3D2E' }}
          >
            LD
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="font-bold text-xs leading-tight truncate" style={{ color: '#D4AF37' }}>Leigh Detachment</h1>
              <p className="text-xs truncate" style={{ color: 'rgba(212,175,55,0.55)', fontSize: '0.65rem' }}>ACF Training Manager</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-1.5 px-1.5">
        {NAV_GROUPS.map(group => {
          const GroupIcon = group.icon;
          const visibleItems = group.items.filter(isItemVisible);
          if (visibleItems.length === 0) return null;

          const isGroupCollapsed = !!collapsedGroups[group.label];
          const hasActiveItem = visibleItems.some(item => location.pathname === item.path);

          return (
            <div key={group.label}>
              {/* Section separator */}
              {group.separator && !collapsed && (
                <div className="mt-3 mb-1 mx-1 flex items-center gap-2">
                  <div className="flex-1 border-t border-white/10" />
                  <span className="text-xs font-bold tracking-widest uppercase shrink-0" style={{ color: 'rgba(212,175,55,0.35)', fontSize: '0.55rem' }}>
                    {group.separatorLabel}
                  </span>
                  <div className="flex-1 border-t border-white/10" />
                </div>
              )}
              {group.separator && collapsed && (
                <div className="my-2 border-t-2 border-white/20" />
              )}

              <div className="mb-0.5">
                {/* Group header */}
                {!collapsed ? (
                  <button
                    onClick={() => toggleGroup(group.label)}
                    className={cn(
                      "w-full flex items-center justify-between px-2 py-1.5 rounded-md transition-colors",
                      hasActiveItem ? "bg-white/10" : "hover:bg-white/5"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <GroupIcon className="w-3.5 h-3.5 shrink-0" style={{ color: hasActiveItem ? '#D4AF37' : 'rgba(212,175,55,0.4)' }} />
                      <span
                        className="text-xs font-bold tracking-widest uppercase"
                        style={{ color: hasActiveItem ? '#D4AF37' : 'rgba(212,175,55,0.4)', fontSize: '0.6rem' }}
                      >
                        {group.label}
                      </span>
                    </div>
                    <ChevronDown
                      className="w-3 h-3 transition-transform duration-200"
                      style={{ color: 'rgba(212,175,55,0.3)', transform: isGroupCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
                    />
                  </button>
                ) : (
                  <div className="my-1 border-t border-white/10" />
                )}

                {/* Items */}
                {(!isGroupCollapsed || collapsed) && (
                  <div className="space-y-0.5 mt-0.5 mb-1">
                    {visibleItems.map(item => {
                      const isActive = location.pathname === item.path;
                      const Icon = item.icon;
                      return (
                        <Link
                          key={`${group.label}-${item.path}-${item.label}`}
                          to={item.path}
                          onClick={onMobileClose}
                          className={cn(
                            "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs transition-all duration-150",
                            isActive ? "font-semibold" : "hover:bg-white/8"
                          )}
                          style={isActive
                            ? { background: '#D4AF37', color: '#1A1A1A' }
                            : { color: 'rgba(255,255,255,0.75)' }
                          }
                          title={collapsed ? item.label : undefined}
                        >
                          <Icon className="w-3.5 h-3.5 shrink-0" />
                          {!collapsed && <span className="truncate">{item.label}</span>}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Help & Wiki — always visible, pinned at bottom of nav */}
        {!collapsed && (
          <div className="mt-1 border-t border-white/10 pt-1">
            <Link
              to={HELP_ITEM.path}
              onClick={onMobileClose}
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs transition-all duration-150",
                location.pathname === HELP_ITEM.path ? "font-semibold" : "hover:bg-white/8"
              )}
              style={location.pathname === HELP_ITEM.path
                ? { background: '#D4AF37', color: '#1A1A1A' }
                : { color: 'rgba(255,255,255,0.75)' }
              }
            >
              <HelpCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{HELP_ITEM.label}</span>
            </Link>
          </div>
        )}
      </nav>

      {/* User footer */}
      <div className="p-2 border-t border-white/10 shrink-0">
        {!collapsed && personnel && (
          <div className="mb-1.5 px-1">
            <p className="text-xs font-semibold truncate" style={{ color: '#D4AF37' }}>
              {personnel.Rank && `${personnel.Rank} `}{personnel.FirstName} {personnel.Surname}
            </p>
            <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem' }}>{LEVEL_NAMES[accessLevel]}</p>
          </div>
        )}
        <div className="flex items-center gap-1">
          <button
            onClick={onToggle}
            className="p-1.5 rounded-md transition-colors hidden md:block"
            style={{ color: 'rgba(255,255,255,0.4)' }}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
          {!collapsed && (
            <button
              onClick={() => base44.auth.logout()}
              className="flex items-center gap-2 p-1.5 rounded-md text-xs flex-1 transition-colors"
              style={{ color: 'rgba(255,255,255,0.4)' }}
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