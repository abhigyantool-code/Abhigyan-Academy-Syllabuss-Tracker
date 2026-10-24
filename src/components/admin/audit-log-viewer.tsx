'use client';

import React, { useState } from 'react';
import { formatISTDateTime } from '@/lib/date-utils';
import { History, Eye, ShieldCheck, Terminal } from 'lucide-react';

interface AuditItem {
  id: string;
  actor_label: string;
  action: string;
  entity: string;
  entity_id: string | null;
  before: any;
  after: any;
  created_at: string;
}

interface AuditLogViewerProps {
  logs: AuditItem[];
}

export function AuditLogViewer({ logs }: AuditLogViewerProps) {
  const [inspectingItem, setInspectingItem] = useState<AuditItem | null>(null);

  const getActionBadgeColor = (action: string) => {
    if (action.startsWith('CREATE')) return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    if (action.startsWith('UPDATE') || action.startsWith('REORDER')) return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
    if (action.startsWith('DELETE') || action.startsWith('REJECT')) return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    if (action.startsWith('APPROVE')) return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <History className="w-4 h-4 text-indigo-400" />
            Administrative Audit Trail
            <span className="text-xs font-mono bg-slate-950 px-2 py-0.5 rounded text-slate-400 border border-slate-800">
              {logs.length} logged events
            </span>
          </h3>
          <p className="text-xs text-slate-400">
            Immutable log of curriculum changes, code dispatches, settings updates, and queue reviews.
          </p>
        </div>
      </div>

      {/* Audit Sheet Table */}
      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-slate-900/90 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10.5px]">
            <tr>
              <th className="py-2.5 px-3 w-40 border-r border-slate-800/80">Timestamp (IST)</th>
              <th className="py-2.5 px-3 w-36 border-r border-slate-800/80">Actor</th>
              <th className="py-2.5 px-4 w-52 border-r border-slate-800/80">Action</th>
              <th className="py-2.5 px-3 w-28 border-r border-slate-800/80">Entity</th>
              <th className="py-2.5 px-4 border-r border-slate-800/80">Entity Reference ID</th>
              <th className="py-2.5 px-3 text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono text-[11.5px]">
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-500 font-sans">
                  No audit logs recorded yet.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-900/50 transition-colors text-slate-300">
                  <td className="py-2 px-3 text-slate-400 border-r border-slate-800/60">
                    {formatISTDateTime(log.created_at)}
                  </td>
                  <td className="py-2 px-3 text-slate-200 border-r border-slate-800/60 font-sans font-medium">
                    {log.actor_label}
                  </td>
                  <td className="py-2 px-4 border-r border-slate-800/60 font-sans">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold border ${getActionBadgeColor(
                        log.action
                      )}`}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-slate-300 border-r border-slate-800/60 font-sans font-medium">
                    {log.entity}
                  </td>
                  <td className="py-2 px-4 text-slate-500 text-[11px] border-r border-slate-800/60 truncate max-w-xs">
                    {log.entity_id || '-'}
                  </td>
                  <td className="py-2 px-3 text-right">
                    <button
                      onClick={() => setInspectingItem(log)}
                      className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                      title="Inspect Diff"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* JSON Diff Inspector Modal */}
      {inspectingItem && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-indigo-400" />
                  Audit Event Snapshot: {inspectingItem.action}
                </h3>
                <p className="text-xs text-slate-400">
                  Logged at {formatISTDateTime(inspectingItem.created_at)} by {inspectingItem.actor_label}
                </p>
              </div>
              <button
                onClick={() => setInspectingItem(null)}
                className="text-slate-400 hover:text-white text-lg"
              >
                &times;
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 font-semibold block mb-1">State Before</span>
                <pre className="bg-slate-950 border border-slate-800 p-3 rounded-lg overflow-x-auto text-[11px] text-slate-300 max-h-60 font-mono">
                  {inspectingItem.before ? JSON.stringify(inspectingItem.before, null, 2) : '// No previous state'}
                </pre>
              </div>

              <div>
                <span className="text-slate-400 font-semibold block mb-1">State After (Committed)</span>
                <pre className="bg-slate-950 border border-slate-800 p-3 rounded-lg overflow-x-auto text-[11px] text-emerald-400 max-h-60 font-mono">
                  {inspectingItem.after ? JSON.stringify(inspectingItem.after, null, 2) : '// None'}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setInspectingItem(null)}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
