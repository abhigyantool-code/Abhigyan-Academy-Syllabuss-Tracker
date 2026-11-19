import React from 'react';

interface NeumorphicShellProps {
  children: React.ReactNode;
}

export function NeumorphicShell({ children }: NeumorphicShellProps) {
  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden flex flex-col items-center justify-start py-4 px-3 sm:py-8 sm:px-6 lg:py-12 lg:px-8 bg-gradient-to-br from-[var(--bg-page-from)] to-[var(--bg-page-to)] transition-colors duration-300 box-border">
      <main
        className="w-full max-w-[1020px] bg-[var(--surface-shell)] rounded-[20px] sm:rounded-[26px] lg:rounded-[30px] p-4 sm:p-7 lg:p-10 shadow-[var(--shadow-shell)] border border-[var(--border-subtle)] transition-all duration-300 relative box-border overflow-hidden min-w-0"
        style={{
          backgroundColor: 'var(--surface-shell)',
          boxShadow: 'var(--shadow-shell)',
        }}
      >
        {children}
      </main>
    </div>
  );
}
