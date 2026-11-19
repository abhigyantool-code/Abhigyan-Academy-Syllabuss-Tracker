'use client';

import React, { useState, useId, useRef, useEffect } from 'react';
import { Search, Sparkles, X, ArrowRight, BookOpen, CheckCircle, Clock } from 'lucide-react';
import type { TopicProgressItem } from '@/lib/dashboard-data';

interface StudyAssistantBarProps {
  topics?: TopicProgressItem[];
}

export function StudyAssistantBar({ topics = [] }: StudyAssistantBarProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const inputId = useId();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const trimmedQuery = query.trim().toLowerCase();

  const matchedTopics = trimmedQuery.length >= 2
    ? topics.filter((t) =>
        t.topic_name.toLowerCase().includes(trimmedQuery) ||
        t.subject_name.toLowerCase().includes(trimmedQuery) ||
        (t.seq_no && String(t.seq_no).includes(trimmedQuery))
      ).slice(0, 5)
    : [];

  const quickPrompts = [
    'Quadratic Equations',
    'Modern Indian History',
    'Current Affairs & Defence',
    'Thermodynamics',
  ];

  return (
    <div ref={dropdownRef} className="relative w-full">
      {/* 26px radius ask container */}
      <div
        className="w-full h-[52px] rounded-[26px] bg-[var(--surface-muted)] border border-[var(--border-subtle)] px-4 flex items-center gap-3 shadow-[var(--shadow-inset)] focus-within:ring-2 focus-within:ring-[var(--border-strong)] transition-all duration-200"
        style={{ borderRadius: '26px' }}
      >
        <div className="text-[var(--icon-color)] shrink-0 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-[var(--icon-color)]" />
        </div>

        <label htmlFor={inputId} className="sr-only">
          Ask anything about your syllabus
        </label>
        <input
          id={inputId}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Ask anything about your syllabus, topics, schedule..."
          className="w-full bg-transparent text-[var(--text-primary)] placeholder-[var(--text-muted)] text-xs sm:text-sm font-medium outline-none border-none"
        />

        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Clear query"
            className="w-6 h-6 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-card)] transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Search syllabus assistant"
          className="w-8 h-8 rounded-full bg-[var(--surface-shell)] hover:bg-[var(--surface-card-hover)] text-[var(--text-primary)] border border-[var(--border-subtle)] shadow-[var(--shadow-soft)] flex items-center justify-center shrink-0 transition-transform active:scale-95 cursor-pointer"
        >
          <Search className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Interactive Match / Quick Suggestions Dropdown */}
      {isOpen && (
        <div
          className="absolute top-[60px] left-0 right-0 z-40 bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-[20px] shadow-[var(--shadow-shell)] p-4 space-y-3 transition-all"
        >
          {trimmedQuery.length >= 2 ? (
            <div>
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-[var(--border-subtle)]">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Matched Syllabus Topics ({matchedTopics.length})
                </span>
                <span className="text-[10px] text-[var(--text-faint)]">
                  Press topic to inspect
                </span>
              </div>

              {matchedTopics.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] py-2 text-center">
                  No syllabus topics matched &ldquo;{query}&rdquo;.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {matchedTopics.map((item) => (
                    <div
                      key={item.topic_id}
                      className="p-2.5 rounded-[14px] bg-[var(--surface-muted)] hover:bg-[var(--surface-card-hover)] border border-[var(--border-subtle)] flex items-center justify-between gap-3 text-xs transition-colors cursor-pointer"
                      onClick={() => {
                        setQuery(item.topic_name);
                        setIsOpen(false);
                      }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <BookOpen className="w-3.5 h-3.5 text-[var(--icon-color)] shrink-0" />
                        <div className="min-w-0">
                          <p className="font-semibold text-[var(--text-primary)] truncate">
                            {item.topic_name}
                          </p>
                          <p className="text-[10px] text-[var(--text-muted)]">
                            {item.subject_name} &bull; Seq #{item.seq_no}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-1.5 font-mono text-[10px] tabular-nums">
                        {item.status === 'covered' ? (
                          <span className="text-[var(--status-green)] flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Covered
                          </span>
                        ) : item.status === 'overdue' ? (
                          <span className="text-[var(--status-red)] flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Overdue
                          </span>
                        ) : (
                          <span className="text-[var(--status-yellow)] flex items-center gap-1">
                            In Progress
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                Suggested Topic Queries
              </p>
              <div className="flex flex-wrap gap-1.5">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => {
                      setQuery(prompt);
                      setIsOpen(true);
                    }}
                    className="text-xs px-3 py-1 rounded-full bg-[var(--surface-muted)] hover:bg-[var(--surface-card-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>{prompt}</span>
                    <ArrowRight className="w-3 h-3 text-[var(--text-muted)]" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
