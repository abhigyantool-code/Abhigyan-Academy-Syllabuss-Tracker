'use client';

import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
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
      <div className="h-64 flex items-center justify-center text-xs text-slate-400">
        No schedule timeline data available yet.
      </div>
    );
  }

  const formattedData = data.map((d) => ({
    ...d,
    formattedDate: formatISTDate(d.date),
  }));

  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={formattedData} margin={{ top: 10, right: 20, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
          <XAxis
            dataKey="formattedDate"
            stroke="#94a3b8"
            fontSize={11}
            tickLine={false}
            tickMargin={8}
          />
          <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0f172a',
              borderColor: '#334155',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#f8fafc',
            }}
          />
          <Legend
            verticalAlign="top"
            height={36}
            formatter={(value) => (
              <span className="text-xs font-medium text-slate-300">
                {value === 'plannedCumulative' ? 'Planned Target (Syllabus Schedule)' : 'Actual Covered (Student Verified)'}
              </span>
            )}
          />
          <Line
            type="monotone"
            dataKey="plannedCumulative"
            name="plannedCumulative"
            stroke="#60a5fa"
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={{ r: 3, fill: '#60a5fa' }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="actualCumulative"
            name="actualCumulative"
            stroke="#10b981"
            strokeWidth={2.5}
            dot={{ r: 3, fill: '#10b981' }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
