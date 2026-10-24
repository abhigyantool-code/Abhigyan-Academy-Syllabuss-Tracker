'use client';

import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { formatISTDate } from '@/lib/date-utils';

interface TimelineDataPoint {
  date: string;
  plannedCumulative: number;
  actualCumulative: number;
}

interface CumulativeChartProps {
  data: TimelineDataPoint[];
}

export function CumulativeChart({ data }: CumulativeChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-xs text-zinc-500 font-mono">
        No schedule timeline data recorded yet.
      </div>
    );
  }

  const formattedData = data.map((d) => ({
    ...d,
    formattedDate: formatISTDate(d.date),
  }));

  return (
    <div className="w-full h-80 pt-2">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
          <defs>
            <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
            </linearGradient>
            <linearGradient id="plannedGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis
            dataKey="formattedDate"
            stroke="#71717a"
            fontSize={11}
            tickLine={false}
            tickMargin={10}
            fontFamily="monospace"
          />
          <YAxis stroke="#71717a" fontSize={11} tickLine={false} fontFamily="monospace" />
          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="bg-zinc-900/95 backdrop-blur-md border border-zinc-700/80 rounded-xl p-3 shadow-2xl text-xs space-y-1.5">
                    <p className="font-semibold text-zinc-200 border-b border-zinc-800 pb-1 font-mono">
                      {label}
                    </p>
                    <div className="flex items-center justify-between gap-4">
                      <span className="flex items-center gap-1.5 text-emerald-400">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Actual Covered:
                      </span>
                      <span className="font-mono font-bold text-white">
                        {payload[0]?.value} topics
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="flex items-center gap-1.5 text-indigo-400">
                        <span className="w-2 h-2 rounded-full bg-indigo-400"></span> Planned Target:
                      </span>
                      <span className="font-mono font-bold text-zinc-300">
                        {payload[1]?.value} topics
                      </span>
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />
          <Legend
            verticalAlign="top"
            align="right"
            height={32}
            formatter={(value) => (
              <span className="text-[11px] font-medium text-zinc-300 mr-2">
                {value === 'actualCumulative' ? 'Actual Covered (Student Verified)' : 'Planned Target (Syllabus)'}
              </span>
            )}
          />
          <Area
            type="monotone"
            dataKey="actualCumulative"
            name="actualCumulative"
            stroke="#10b981"
            strokeWidth={2.5}
            fillOpacity={1}
            fill="url(#actualGradient)"
          />
          <Area
            type="monotone"
            dataKey="plannedCumulative"
            name="plannedCumulative"
            stroke="#818cf8"
            strokeWidth={2}
            strokeDasharray="4 4"
            fillOpacity={1}
            fill="url(#plannedGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
