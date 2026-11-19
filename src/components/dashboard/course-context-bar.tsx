import React from 'react';
import Link from 'next/link';
import { Calendar, Layers } from 'lucide-react';
import { formatISTDate } from '@/lib/date-utils';
import type { DashboardCourse } from '@/lib/dashboard-data';

interface CourseContextBarProps {
  courses: DashboardCourse[];
  selectedCourse: DashboardCourse;
  today: string;
}

export function CourseContextBar({
  courses,
  selectedCourse,
  today,
}: CourseContextBarProps) {
  return (
    <div className="space-y-2.5">
      {/* Current Context Row */}
      <div className="flex items-center justify-between text-xs text-[var(--text-muted)] font-medium px-1">
        <span className="flex items-center gap-1.5 font-semibold text-[var(--text-secondary)]">
          <Layers className="w-3.5 h-3.5 text-[var(--icon-color)]" />
          Active Course Batch
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[11px] tabular-nums text-[var(--text-secondary)]">
          <Calendar className="w-3.5 h-3.5 text-[var(--icon-color)]" />
          {formatISTDate(today)}
        </span>
      </div>

      {/* Course Switcher Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none snap-x">
        {courses.map((course) => {
          const isSelected = course.id === selectedCourse.id;
          return (
            <Link
              key={course.id}
              href={`/dashboard?course=${course.id}`}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all duration-150 snap-start border ${
                isSelected
                  ? 'bg-[var(--text-primary)] text-[var(--surface-shell)] border-[var(--text-primary)] shadow-[var(--shadow-soft)]'
                  : 'bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-card-hover)] border-[var(--border-subtle)]'
              }`}
              style={{ borderRadius: '999px' }}
            >
              <span>{course.code || course.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
