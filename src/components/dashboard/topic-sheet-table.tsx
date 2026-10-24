'use client';

import React, { useState, useMemo } from 'react';
import { TopicProgressItem } from '@/lib/dashboard-data';
import { formatISTDate } from '@/lib/date-utils';
import { Search, X, CheckCircle2, Clock, AlertCircle, CircleDot, MinusCircle } from 'lucide-react';

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
      if (selectedSubject !== 'ALL' && t.subject_name !== selectedSubject) {
        return false;
      }
      if (statusFilter !== 'ALL' && t.status !== statusFilter) {
        return false;
      }
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

  const countsByStatus = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: topics.length,
      covered: 0,
      unverified: 0,
      in_progress: 0,
      overdue: 0,
      not_started: 0,
    };
    topics.forEach((t) => {
      if (counts[t.status] !== undefined) counts[t.status]++;
    });
    return counts;
  }, [topics]);

  const renderStatusBadge = (status: TopicProgressItem['status']) => {
    switch (status) {
      case 'covered':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Covered
          </span>
        );
      case 'unverified':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            Unverified
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
            In Progress
          </span>
        );
      case 'overdue':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
            Overdue
          </span>
        );
      case 'not_started':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-zinc-800/80 text-zinc-400 border border-zinc-700/50">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-500"></span>
            Not Started
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Modern Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-900/60 backdrop-blur-md border border-zinc-800/80 p-3 rounded-2xl">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          {/* Search box with subtle glow */}
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter topics, faculty, subject..."
              className="w-full bg-zinc-950/80 border border-zinc-800/80 rounded-xl pl-9 pr-8 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/40 transition-all font-sans"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Subject Filter Select */}
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500/60 transition-all"
          >
            <option value="ALL">All Subjects ({subjects.length})</option>
            {subjects.map((sub) => (
              <option key={sub} value={sub}>
                {sub}
              </option>
            ))}
          </select>
        </div>

        {/* Filter Pills with Badge Counts */}
        <div className="flex items-center gap-1 overflow-x-auto text-xs bg-zinc-950/60 p-1 rounded-xl border border-zinc-800/60">
          {[
            { id: 'ALL', label: 'All', count: countsByStatus.ALL },
            { id: 'covered', label: 'Covered', count: countsByStatus.covered },
            { id: 'unverified', label: 'Unverified', count: countsByStatus.unverified },
            { id: 'in_progress', label: 'In Progress', count: countsByStatus.in_progress },
            { id: 'overdue', label: 'Overdue', count: countsByStatus.overdue },
            { id: 'not_started', label: 'Not Started', count: countsByStatus.not_started },
          ].map((tab) => {
            const isActive = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-zinc-800 text-white font-semibold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] font-mono px-1 rounded ${
                    isActive ? 'bg-zinc-700 text-zinc-200' : 'bg-zinc-900 text-zinc-500'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Modern Spreadsheet Table */}
      <div className="border border-zinc-800/80 rounded-2xl overflow-hidden bg-zinc-950/60 backdrop-blur-md shadow-2xl">
        <div className="overflow-x-auto max-h-[520px]">
          <table className="w-full text-left border-collapse text-xs">
            {/* Header */}
            <thead className="bg-zinc-900/90 backdrop-blur sticky top-0 z-10 border-b border-zinc-800 text-zinc-400 font-semibold uppercase tracking-wider text-[10.5px]">
              <tr>
                <th className="py-3 px-3 w-12 text-center border-r border-zinc-800/60">#</th>
                <th className="py-3 px-4 w-44 border-r border-zinc-800/60">Subject</th>
                <th className="py-3 px-4 border-r border-zinc-800/60">Curriculum Topic Block</th>
                <th className="py-3 px-3 w-40 border-r border-zinc-800/60">Faculty Assigned</th>
                <th className="py-3 px-3 w-28 border-r border-zinc-800/60">Target Date</th>
                <th className="py-3 px-3 w-28 text-center border-r border-zinc-800/60">Confirmations</th>
                <th className="py-3 px-3 w-32 text-center border-r border-zinc-800/60">Status</th>
                <th className="py-3 px-3 w-28">First Taught</th>
              </tr>
            </thead>
            {/* Rows */}
            <tbody className="divide-y divide-zinc-800/60 font-sans">
              {filteredTopics.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-500 font-sans">
                    No curriculum topics matched your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredTopics.map((t) => (
                  <tr
                    key={t.topic_id}
                    className="hover:bg-zinc-900/60 transition-colors group text-zinc-300"
                  >
                    <td className="py-2.5 px-3 text-center text-zinc-500 font-mono text-xs border-r border-zinc-800/60 bg-zinc-900/20">
                      {t.seq_no}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-zinc-200 border-r border-zinc-800/60">
                      <span className="truncate block max-w-[170px]" title={t.subject_name}>
                        {t.subject_name}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-zinc-100 font-medium border-r border-zinc-800/60">
                      {t.topic_name}
                    </td>
                    <td className="py-2.5 px-3 text-zinc-400 border-r border-zinc-800/60 text-xs">
                      {t.teacher_names}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-xs text-zinc-400 border-r border-zinc-800/60">
                      {formatISTDate(t.target_date)}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono border-r border-zinc-800/60">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                          t.covered_confirmations >= t.effective_threshold
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                            : t.covered_confirmations > 0
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                            : 'text-zinc-500 bg-zinc-900/60'
                        }`}
                      >
                        {t.covered_confirmations} / {t.effective_threshold}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center border-r border-zinc-800/60">
                      {renderStatusBadge(t.status)}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-xs text-zinc-400">
                      {formatISTDate(t.first_date_taught)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* Footer */}
        <div className="bg-zinc-900/80 border-t border-zinc-800/80 px-4 py-2.5 flex items-center justify-between text-xs text-zinc-400 font-mono">
          <span>
            Showing <strong className="text-zinc-200">{filteredTopics.length}</strong> of{' '}
            <strong className="text-zinc-200">{topics.length}</strong> topics
          </span>
          <span className="text-[11px] text-zinc-500">
            Threshold: {confirmationThreshold} distinct student confirmations
          </span>
        </div>
      </div>
    </div>
  );
}
