'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { changeStudentPinAction } from '@/app/actions/auth-actions';
import { KeyRound, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

interface StudentPinModalProps {
  rollNo: string;
  mustChangePin?: boolean;
}

export function StudentPinModal({ rollNo, mustChangePin = false }: StudentPinModalProps) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(mustChangePin);
  const [currentPin, setCurrentPin] = useState(mustChangePin ? '1234' : '');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(
    mustChangePin
      ? {
          text: '⚠️ Mandatory Credential Rotation: Your account is currently using the default PIN (1234). Please set a secure personal PIN to continue.',
          type: 'error',
        }
      : null
  );

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPin.trim() || !newPin.trim()) {
      setMsg({ text: 'All PIN fields are required.', type: 'error' });
      return;
    }

    if (newPin !== confirmPin) {
      setMsg({ text: 'New PIN and Confirm PIN do not match.', type: 'error' });
      return;
    }

    setLoading(true);
    setMsg(null);

    try {
      const res = await changeStudentPinAction(rollNo, currentPin, newPin);
      if (res.success) {
        setMsg({ text: 'PIN successfully updated! Remember your new PIN.', type: 'success' });
        setCurrentPin('');
        setNewPin('');
        setConfirmPin('');
        setTimeout(() => {
          setShowModal(false);
          router.replace('/student');
          router.refresh();
        }, 1500);
      } else {
        setMsg({ text: res.error || 'Failed to update PIN', type: 'error' });
      }
    } catch (err: any) {
      setMsg({ text: err.message || 'An unexpected error occurred', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        title="Change Security PIN"
        className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 bg-amber-500/10 border border-amber-500/20 hover:border-amber-500/40 px-3 py-1.5 rounded-xl transition-all font-semibold"
      >
        <KeyRound className="w-3.5 h-3.5" />
        <span>Change PIN</span>
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-400" />
                <span>Change Student PIN</span>
              </h3>
              {!mustChangePin && (
                <button
                  onClick={() => setShowModal(false)}
                  className="text-zinc-400 hover:text-white text-lg font-bold"
                >
                  &times;
                </button>
              )}
            </div>

            {msg && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold flex items-start gap-2 ${
                  msg.type === 'success'
                    ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
                }`}
              >
                {msg.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                )}
                <span>{msg.text}</span>
              </div>
            )}

            <form onSubmit={handleUpdate} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1">
                  Current PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  required
                  value={currentPin}
                  onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter current PIN"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1">
                  New 4–8 Digit PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={8}
                  required
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 849201"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[10px] text-zinc-500 mt-1">
                  Must be 4–8 digits and cannot be common patterns like 1234 or 0000.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-400 block mb-1">
                  Confirm New PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={8}
                  required
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="Re-enter new PIN"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                {!mustChangePin && (
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white flex items-center gap-1.5"
                >
                  {loading && <Loader2 className="w-3 h-3 animate-spin" />}
                  <span>Save New PIN</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
