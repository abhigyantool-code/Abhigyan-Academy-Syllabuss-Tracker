'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { CurriculumManager } from './curriculum-manager';
import { CoursesManager } from './courses-manager';
import { FacultyManager } from './faculty-manager';
import { StudentsManager } from './students-manager';
import { ClassCodesManager } from './class-codes-manager';
import { ReviewQueue } from './review-queue';
import { AuditLogViewer } from './audit-log-viewer';
import {
  BookOpen,
  Layers,
  GraduationCap,
  Users,
  KeyRound,
  ShieldAlert,
  History,
  LayoutDashboard,
  Shield,
  ArrowRight,
} from 'lucide-react';

interface AdminPanelClientProps {
  initialData: any;
}

export function AdminPanelClient({ initialData }: AdminPanelClientProps) {
  const [activeTab, setActiveTab] = useState<
    'curriculum' | 'courses' | 'faculty' | 'students' | 'codes' | 'review' | 'audit'
  >('curriculum');

  const {
    today,
    courses,
    subjects,
    topics,
    teachers,
    students,
    classCodes,
    reviewQueue,
    auditLog,
  } = initialData;

  const navTabs = [
    { id: 'curriculum', label: 'Curriculum Builder', icon: BookOpen },
    { id: 'courses', label: 'Courses & Settings', icon: Layers, count: courses.length },
    { id: 'faculty', label: 'Faculty & Allocations', icon: GraduationCap, count: teachers.length },
    { id: 'students', label: 'Students & Roster', icon: Users, count: students.length },
    { id: 'codes', label: 'Class Codes & Board', icon: KeyRound, count: classCodes.filter((c: any) => c.is_active_now).length },
    { id: 'review', label: 'Review Queue', icon: ShieldAlert, badge: reviewQueue.length > 0 ? reviewQueue.length : undefined },
    { id: 'audit', label: 'Audit Trail', icon: History },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Admin Module Navigation Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-800 pb-px text-xs">
        {navTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 font-medium border-b-2 whitespace-nowrap transition-all ${
                isActive
                  ? 'border-indigo-500 text-white bg-slate-900/90 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
              }`}
            >
              <Icon
                className={`w-4 h-4 ${
                  isActive
                    ? 'text-indigo-400'
                    : tab.id === 'review' && tab.badge
                    ? 'text-amber-400'
                    : 'text-slate-500'
                }`}
              />
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className="bg-amber-500 text-black text-[10px] font-bold px-1.5 py-0.2 rounded-full font-mono animate-pulse">
                  {tab.badge}
                </span>
              )}
              {tab.count !== undefined && !tab.badge && (
                <span className="bg-slate-950 border border-slate-800 text-[10px] text-slate-400 px-1.5 py-0.2 rounded font-mono">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === 'curriculum' && (
          <CurriculumManager courses={courses} subjects={subjects} topics={topics} />
        )}
        {activeTab === 'courses' && <CoursesManager courses={courses} />}
        {activeTab === 'faculty' && <FacultyManager teachers={teachers} subjects={subjects} />}
        {activeTab === 'students' && <StudentsManager students={students} courses={courses} />}
        {activeTab === 'codes' && (
          <ClassCodesManager codes={classCodes} courses={courses} todayIST={today} />
        )}
        {activeTab === 'review' && <ReviewQueue entries={reviewQueue} />}
        {activeTab === 'audit' && <AuditLogViewer logs={auditLog} />}
      </div>
    </div>
  );
}
