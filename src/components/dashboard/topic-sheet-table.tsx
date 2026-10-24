'use client';

import React, { useState, useMemo } from 'react';
import { TopicProgressItem } from '@/lib/dashboard-data';
import { formatISTDate } from '@/lib/date-utils';
import { Search, Filter, CheckCircle2, Clock, AlertTriangle, AlertCircle, CircleDot } from 'lucide-react';

interface TopicSheetTableProps {
  topics: TopicProgressItem[];
  confirmationThreshold: number;
}

export function TopicSheetTable({ topics, confirmationThreshold }: TopicSheetTableProps) {
  const [search, setSearch] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const subjects = useMemo(() => {
    const set = new Set<string>();
    topics.forEach((t) => set.add(t.subject_name));
    return Array.from(set).sort();
  }, [topics]);

  const filteredTopics = useMemo(() => {
    return topics.filter((t) => {
      // Subject filter
      if (selectedSubject !== 'ALL' && t.subject_name !== selectedSubject) {
        return false;
      }
      // Status filter
      if (statusFilter !== 'ALL' && t.status !== statusFilter) {
        return false;
      }
      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchTitle = t.topic_name.toLowerCase().includes(q);
        const matchSub = t.subject_name.toLowerCase().includes(q);
        const matchTea = (t.teacher_names || '').toLowerCase().includes(q);
        const matchSeq = String(t.seq_no).includes(q);
        if (!matchTitle && !matchSub && !matchTea && !matchSeq) {
          return false;
        }
      }
      return true;
    });
  }, [topics, selectedSubject, statusFilter, search]);

  const renderStatusBadge = (status: TopicProgressItem['status']) => {
    switch (status) {
      case 'covered':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            Covered
          </span>
        );
      case 'unverified':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <Clock className="w-3 h-3 text-amber-400" />
            Unverified
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/15 text-sky-400 border border-sky-500/30">
            <CircleDot className="w-3 h-3 text-sky-400" />
            In Progress
          </span>
        );
      case 'overdue':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <AlertCircle className="w-3 h-3 text-rose-400" />
            Overdue
          </span>
        );
      case 'not_started':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
            Not Started
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Search and Filters Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-3 rounded-xl">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          {/* Search box */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by topic title, faculty, or subject..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Subject Filter */}
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Subjects ({subjects.length})</option>
            {subjects.map((sub) => (
              <option key={sub} value={sub}>
                {sub}
              </option>
            ))}
          </select>
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-1 overflow-x-auto text-xs">
          {[
            { id: 'ALL', label: 'All' },
            { id: 'covered', label: 'Covered' },
            { id: 'unverified', label: 'Unverified' },
            { id: 'in_progress', label: 'In Progress' },
            { id: 'overdue', label: 'Overdue' },
            { id: 'not_started', label: 'Not Started' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                statusFilter === tab.id
                  ? 'bg-slate-100 text-slate-900 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Spreadsheet Grid Container */}
      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950 shadow-inner">
        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-left border-collapse text-xs">
            {/* Sheet Header */}
            <thead className="bg-slate-900/90 sticky top-0 z-10 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-2.5 px-3 w-12 text-center border-r border-slate-800/80">#</th>
                <th className="py-2.5 px-4 w-44 border-r border-slate-800/80">Subject</th>
                <th className="py-2.5 px-4 border-r border-slate-800/80">Topic Curriculum Block</th>
                <th className="py-2.5 px-3 w-40 border-r border-slate-800/80">Assigned Faculty</th>
                <th className="py-2.5 px-3 w-28 border-r border-slate-800/80">Target Date</th>
                <th className="py-2.5 px-3 w-28 text-center border-r border-slate-800/80">Confirmations</th>
                <th className="py-2.5 px-3 w-28 text-center border-r border-slate-800/80">Status</th>
                <th className="py-2.5 px-3 w-28">First Taught</th>
              </tr>
            </thead>
            {/* Sheet Rows */}
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11.5px]">
              {filteredTopics.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500 font-sans">
                    No curriculum topics matched your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredTopics.map((t, idx) => (
                  <tr
                    key={t.topic_id}
                    className="hover:bg-slate-900/70 transition-colors group font-sans text-slate-300"
                  >
                    <td className="py-2 px-3 text-center text-slate-500 font-mono text-xs border-r border-slate-800/60 bg-slate-900/30">
                      {t.seq_no}
                    </td>
                    <td className="py-2 px-4 font-medium text-slate-200 border-r border-slate-800/60">
                      <span className="truncate block max-w-[170px]" title={t.subject_name}>
                        {t.subject_name}
                      </span>
                    </td>
                    <td className="py-2 px-4 text-slate-100 font-medium border-r border-slate-800/60">
                      <span className="block">{t.topic_name}</span>
                    </td>
                    <td className="py-2 px-3 text-slate-300 border-r border-slate-800/60 text-xs">
                      {t.teacher_names}
                    </td>
                    <td className="py-2 px-3 font-mono text-xs text-slate-400 border-r border-slate-800/60">
                      {formatISTDate(t.target_date)}
                    </td>
                    <td className="py-2 px-3 text-center font-mono border-r border-slate-800/60">
                      <span
                        className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                          t.covered_confirmations >= t.effective_threshold
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : t.covered_confirmations > 0
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'text-slate-500'
                        }`}
                      >
                        {t.covered_confirmations} / {t.effective_threshold}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center border-r border-slate-800/60">
                      {renderStatusBadge(t.status)}
                    </td>
                    <td className="py-2 px-3 font-mono text-xs text-slate-400">
                      {formatISTDate(t.first_date_taught)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* Sheet Footer */}
        <div className="bg-slate-900/70 border-t border-slate-800 px-4 py-2 flex items-center justify-between text-xs text-slate-400">
          <span>
            Showing <strong className="text-slate-200">{filteredTopics.length}</strong> of{' '}
            <strong className="text-slate-200">{topics.length}</strong> topics
          </span>
          <span className="text-[11px] text-slate-500">
            Threshold formula: min(threshold, round(20% × enrolled)) = {confirmationThreshold} students
          </span>
        </div>
      </div>
    </div>
  );
}
