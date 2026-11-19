'use client';

import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface FlipClockProps {
  initialTime?: string; // Optional fixed time or label
}

interface DigitTileProps {
  digit: string;
  prevDigit: string;
}

function DigitTile({ digit, prevDigit }: DigitTileProps) {
  const isChanging = digit !== prevDigit;

  return (
    <div
      className="relative w-10 sm:w-12 h-14 sm:h-16 rounded-[20px] bg-[var(--surface-muted)] border border-[var(--border-subtle)] shadow-[var(--shadow-flip)] flex flex-col items-center justify-center overflow-hidden select-none"
      style={{ borderRadius: '20px' }}
    >
      {/* Top half / bottom half horizontal split divider */}
      <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-[var(--border-strong)] z-20" />

      {/* Digit display */}
      <div
        key={digit}
        className={`text-2xl sm:text-3xl font-bold font-mono text-[var(--text-primary)] tabular-nums transition-transform duration-300 ${
          isChanging ? 'animate-[flipBottom_0.3s_ease-out]' : ''
        }`}
      >
        {digit}
      </div>

      {/* Subtle shine overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/10 dark:from-white/5 to-transparent pointer-events-none rounded-[20px]" />
    </div>
  );
}

export function FlipClock({ initialTime }: FlipClockProps) {
  const [mounted, setMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState({
    h1: '1',
    h2: '4',
    m1: '3',
    m2: '0',
  });
  const [prevTime, setPrevTime] = useState({
    h1: '1',
    h2: '4',
    m1: '3',
    m2: '0',
  });

  useEffect(() => {
    setMounted(true);

    const updateClock = () => {
      // Get IST time
      const now = new Date();
      // Format in Asia/Kolkata
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      };
      const timeStr = now.toLocaleTimeString('en-GB', options);
      const [hours, minutes] = timeStr.split(':');

      if (hours && minutes) {
        const nextTime = {
          h1: hours[0] || '0',
          h2: hours[1] || '0',
          m1: minutes[0] || '0',
          m2: minutes[1] || '0',
        };

        setCurrentTime((prev) => {
          setPrevTime(prev);
          return nextTime;
        });
      }
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section
      aria-label="Current IST Academy Clock"
      className="rounded-[24px] p-4 bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-[var(--shadow-card)] flex flex-col items-center justify-between gap-3 transition-all duration-200"
      style={{ borderRadius: '24px' }}
    >
      <div className="w-full flex items-center justify-between text-xs text-[var(--text-muted)] font-medium px-1">
        <span className="flex items-center gap-1.5 font-semibold text-[var(--text-secondary)]">
          <Clock className="w-3.5 h-3.5 text-[var(--icon-color)]" />
          Study Schedule Clock
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wider bg-[var(--surface-muted)] px-2 py-0.5 rounded-full border border-[var(--border-subtle)]">
          Asia / Kolkata (IST)
        </span>
      </div>

      {/* Flip Clock Tiles (Hours : Minutes) */}
      <div className="flex items-center justify-center gap-2 sm:gap-3 py-1">
        {/* Hours Pair */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          <DigitTile
            digit={mounted ? currentTime.h1 : '1'}
            prevDigit={mounted ? prevTime.h1 : '1'}
          />
          <DigitTile
            digit={mounted ? currentTime.h2 : '4'}
            prevDigit={mounted ? prevTime.h2 : '4'}
          />
        </div>

        {/* Colon Divider */}
        <div className="flex flex-col gap-2 justify-center px-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)]" />
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)]" />
        </div>

        {/* Minutes Pair */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          <DigitTile
            digit={mounted ? currentTime.m1 : '3'}
            prevDigit={mounted ? prevTime.m1 : '3'}
          />
          <DigitTile
            digit={mounted ? currentTime.m2 : '0'}
            prevDigit={mounted ? prevTime.m2 : '0'}
          />
        </div>
      </div>
    </section>
  );
}
