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
  AlertCircle, Shirt, HeartHandshake, AlertTriangle, FileText, BookMarked,
  Star, Layers
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';

// ── Compact nested nav structure ──────────────────────────────────────────────
const NAV_GROUPS = [
  {
    label: 'DASHBOARD',
    icon: LayoutDashboard,
    items: [
      { path: '/', label: 'Command Hub', icon: LayoutDashboard, level: 0 },
      { path: '/monthly-reports', label: 'Monthly Reports', icon: FileText, level: 4 },
      { path: '/analytics', label: 'Analytics', icon: BarChart2, level: 4 },
      { path: '/notices', label: 'Notices', icon: Megaphone, level: 0 },
      { path: '/calendar', label: 'Training Calendar', icon: CalendarDays, level: 0 },
    ],
  },
  {
    label: 'CADETS',
    icon: Star,
    items: [
      { path: '/personnel', label: 'Cadet Profiles', icon: Users, level: 4 },
      { path: '/my-progress', label: 'My Progress', icon: TrendingUp, level: 0, hideIfAdult: true },
      { path: '/bulk-progress', label: 'Bulk Progress Entry', icon: ClipboardCheck, level: 4 },
      { path: '/progress', label: 'Progress Matrix', icon: Layers, level: 3 },
      { path: '/my-logbooks', label: 'My Logbooks', icon: BookMarked, level: 0 },
      { path: '/keeping-active', label: 'Keeping Active', icon: Dumbbell, level: 0 },
      { path: '/community-engagement', label: 'Community Engagement', icon: HeartHandshake, level: 0 },
      { path: '/wht', label: 'Weapon Handling Tests', icon: Crosshair, level: 0 },
    ],
  },
  {
    label: 'INSTRUCTION',
    icon: BookOpen,
    items: [
      { path: '/parade', label: 'Parade Nominal Roll', icon: ClipboardList, level: 1 },
      { path: '/attendance', label: 'Lesson Nominal Roll', icon: FileCheck, level: 2 },
      { path: '/schedule', label: 'Training Plan', icon: Calendar, level: 0 },
      { path: '/training-manager', label: 'Training Manager', icon: Brain, level: 4 },
      { path: '/plan-generator', label: 'Plan Generator', icon: Wand2, level: 4 },
      { path: '/training-plan-export', label: 'Export PDF', icon: FileDown, level: 3 },
      { path: '/syllabus', label: 'Syllabus', icon: BookOpen, level: 2 },
      { path: '/personal-syllabus', label: 'My Syllabus', icon: BookOpenCheck, level: 0 },
      { path: '/my-availability', label: 'My Availability', icon: CalendarCheck, level: 2 },
      { path: '/all-availability', label: 'All Availability', icon: CalendarCheck, level: 4 },
      { path: '/instructor-quals', label: 'Instructor Qualifications', icon: GraduationCap, level: 4 },
      { path: '/my-qualifications', label: 'My Qualifications', icon: GraduationCap, level: 2 },
    ],
  },
  {
    label: 'GOVERNANCE',
    icon: ShieldCheck,
    items: [
      { path: '/cfav-governance', label: 'CFAV Governance', icon: ShieldCheck, level: 4 },
      { path: '/my-governance', label: 'My Governance', icon: ShieldCheck, level: 3 },
      { path: '/accounts', label: 'Accounts', icon: Shield, level: 4 },
      { path: '/forms-resources', label: 'Forms & Resources', icon: FolderOpen, level: 0 },
      { path: '/form-creator', label: 'Resource Creator', icon: FolderOpen, level: 4 },
      { path: '/uniform-exchange', label: 'Uniform Exchange', icon: Shirt, level: 0 },
      { path: '/course-request', label: 'Course Request', icon: BookOpen, level: 0 },
      { path: '/report-issue', label: 'Report Issue', icon: AlertCircle, level: 0 },
    ],
  },
  {
    label: 'ADMIN',
    icon: Settings,
    items: [
      { path: '/admin', label: 'System Settings', icon: Settings, level: 4 },
      { path: '/help', label: 'Help & Wiki', icon: HelpCircle, level: 0 },
      { path: '/healthy-minds', label: 'Healthy Minds', icon: HeartHandshake, level: 0 },
    ],
  },
];

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }) {
  const location = useLocation();
  const { personnel } = usePersonnel();
  const accessLevel = personnel?.AccessLevel ?? 0;

  // All groups start collapsed except the one containing the active path
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

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen flex flex-col z-[60] transition-all duration-300 border-r border-sidebar-border",
        "max-md:transition-transform max-md:duration-300",
        mobileOpen ? "max-md:translate-x-0" : "max-md:-translate-x-full",
        collapsed ? "md:w-16" : "md:w-60",
        "w-60"
      )}
      style={{ background: '#002147' }}
    >
      {/* Header / Branding */}
      <div className="p-3 border-b border-sidebar-border shrink-0">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs"
            style={{ background: '#FFD700', color: '#002147' }}
          >
            KRH
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="font-bold text-xs leading-tight truncate" style={{ color: '#FFD700' }}>Kings Royal Hussars</h1>
              <p className="text-xs truncate" style={{ color: 'rgba(255,215,0,0.55)', fontSize: '0.65rem' }}>ACF Training Manager</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-1.5 px-1.5">
        {NAV_GROUPS.map(group => {
          const GroupIcon = group.icon;
          const visibleItems = group.items.filter(item =>
            hasAccess(accessLevel, item.level) &&
            !(item.hideIfAdult && isAdultInstructor(accessLevel))
          );
          if (visibleItems.length === 0) return null;

          const isGroupCollapsed = !!collapsedGroups[group.label];
          const hasActiveItem = visibleItems.some(item => location.pathname === item.path);

          return (
            <div key={group.label} className="mb-0.5">
              {/* Group header */}
              {!collapsed ? (
                <button
                  onClick={() => toggleGroup(group.label)}
                  className={cn(
                    "w-full flex items-center justify-between px-2 py-1.5 rounded-md transition-colors",
                    hasActiveItem
                      ? "bg-white/10"
                      : "hover:bg-white/5"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <GroupIcon className="w-3.5 h-3.5 shrink-0" style={{ color: hasActiveItem ? '#FFD700' : 'rgba(255,215,0,0.4)' }} />
                    <span
                      className="text-xs font-bold tracking-widest uppercase"
                      style={{ color: hasActiveItem ? '#FFD700' : 'rgba(255,215,0,0.4)', fontSize: '0.6rem' }}
                    >
                      {group.label}
                    </span>
                  </div>
                  <ChevronDown
                    className="w-3 h-3 transition-transform duration-200"
                    style={{ color: 'rgba(255,215,0,0.3)', transform: isGroupCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
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
                        key={item.path}
                        to={item.path}
                        onClick={onMobileClose}
                        className={cn(
                          "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs transition-all duration-150",
                          isActive
                            ? "font-semibold"
                            : "hover:bg-white/8"
                        )}
                        style={isActive
                          ? { background: '#FFD700', color: '#002147' }
                          : { color: 'rgba(255,255,255,0.7)' }
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
          );
        })}
      </nav>

      {/* User footer */}
      <div className="p-2 border-t border-white/10 shrink-0">
        {!collapsed && personnel && (
          <div className="mb-1.5 px-1">
            <p className="text-xs font-semibold truncate" style={{ color: '#FFD700' }}>
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