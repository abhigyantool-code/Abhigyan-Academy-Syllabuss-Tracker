'use client';

import React, { useState } from 'react';
import { X, Maximize2, Minimize2, ChevronLeft, ChevronRight, Clock, ShieldCheck } from 'lucide-react';
import { formatISTDate } from '@/lib/date-utils';

interface BoardCodeItem {
  id: string;
  course_id: string;
  course_name: string;
  course_code: string;
  code: string;
  class_date: string;
  valid_from: string;
  valid_until: string;
  is_active_now: boolean;
}

interface BoardModeModalProps {
  codes: BoardCodeItem[];
  isOpen: boolean;
  onClose: () => void;
  todayIST: string;
}

export function BoardModeModal({ codes, isOpen, onClose, todayIST }: BoardModeModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!isOpen || codes.length === 0) return null;

  const currentCode = codes[currentIndex] || codes[0];

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % codes.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + codes.length) % codes.length);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 text-white flex flex-col justify-between p-6 sm:p-12 animate-in fade-in duration-200">
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center font-black text-lg">
            AA
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight uppercase">
              Abhigyan Academy
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400">Classroom Code Projection Mode</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <span className="text-xs text-zinc-500 uppercase tracking-widest block">Class Date</span>
            <span className="font-mono text-sm text-zinc-300 font-semibold">{formatISTDate(todayIST)}</span>
          </div>

          <button
            onClick={onClose}
            className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-colors"
            title="Exit Board Presentation Mode (Esc)"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Main Code Presentation Stage */}
      <div className="flex-1 flex flex-col items-center justify-center text-center max-w-4xl mx-auto my-8 w-full">
        <div className="inline-flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-full px-5 py-2 mb-8 shadow-inner">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-semibold text-zinc-300 tracking-wide">
            {currentCode.course_name}
          </span>
          <span className="bg-amber-500/20 text-amber-300 text-xs px-2 py-0.5 rounded font-mono font-bold">
            {currentCode.course_code}
          </span>
        </div>

        <span className="text-sm sm:text-base font-semibold tracking-widest text-zinc-500 uppercase mb-4">
          Enter this Class Code on /submit
        </span>

        {/* GIANT DISPLAY CODE */}
        <div className="bg-zinc-900/90 border-2 border-amber-500/40 rounded-3xl p-8 sm:p-14 shadow-2xl shadow-amber-500/10 mb-8 w-full max-w-2xl select-all">
          <div className="font-mono text-6xl sm:text-8xl md:text-9xl font-black text-amber-400 tracking-wider">
            {currentCode.code}
          </div>
        </div>

        <div className="flex items-center gap-3 text-sm sm:text-base text-zinc-400">
          <Clock className="w-5 h-5 text-emerald-400 animate-pulse" />
          <span>Active for Today&apos;s Class</span>
          <span className="text-zinc-600">&bull;</span>
          <span className="font-mono text-zinc-400 text-xs sm:text-sm">
            Valid until {new Date(currentCode.valid_until).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true })}
          </span>
        </div>
      </div>

      {/* Bottom Course Switcher Carousel */}
      <div className="flex items-center justify-between border-t border-zinc-800 pt-4">
        <button
          onClick={handlePrev}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs sm:text-sm text-zinc-300 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Previous Course</span>
        </button>

        <div className="flex items-center gap-2">
          {codes.map((c, i) => (
            <button
              key={c.id}
              onClick={() => setCurrentIndex(i)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
                i === currentIndex
                  ? 'bg-amber-400 text-black font-bold shadow-md'
                  : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {c.course_code}
            </button>
          ))}
        </div>

        <button
          onClick={handleNext}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs sm:text-sm text-zinc-300 transition-colors"
        >
          <span>Next Course</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
