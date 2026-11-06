// IST (Asia/Kolkata) Date & Time Utilities

export const TIMEZONE_IST = 'Asia/Kolkata';

/**
 * Returns today's date formatted as YYYY-MM-DD in Asia/Kolkata timezone.
 * Used for setting class_date on server submissions and checking validity.
 */
export function getTodayIST(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE_IST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

/**
 * Formats a Date object or date string into a user-friendly IST representation.
 */
export function formatISTDate(date: string | Date | null | undefined): string {
  if (!date) return 'N/A';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return String(date);

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: TIMEZONE_IST,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

/**
 * Formats timestamp with time in IST (e.g., 24 Oct 2026, 01:30 PM)
 */
export function formatISTDateTime(date: string | Date | null | undefined): string {
  if (!date) return 'N/A';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return String(date);

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: TIMEZONE_IST,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

/**
 * Adds or subtracts days from a YYYY-MM-DD string in IST.
 */
export function offsetDaysIST(daysOffset: number, baseDateStr: string = getTodayIST()): string {
  const [year, month, day] = baseDateStr.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + daysOffset);
  return d.toISOString().split('T')[0];
}

/**
 * Returns Start and End of Today in IST as UTC Date objects (for class code valid_from / valid_until)
 */
export function getTodayBoundsIST(ttlMinutes = 1440): { validFrom: Date; validUntil: Date } {
  const now = new Date();
  const validFrom = new Date(now.getTime() - 5 * 60 * 1000); // 5 min clock skew leeway
  const validUntil = new Date(now.getTime() + ttlMinutes * 60 * 1000);
  return { validFrom, validUntil };
}

/**
 * Checks whether the current time in Asia/Kolkata falls within official academy hours:
 * - Days: Monday to Saturday (Mon–Sat)
 * - Time: 06:30 AM to 09:00 PM IST (06:30 – 21:00)
 */
export function checkAcademyHours(date: Date = new Date()): { allowed: boolean; reason?: string } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE_IST,
    hour12: false,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
  });

  const parts = formatter.formatToParts(date);
  const weekday = parts.find((p) => p.type === 'weekday')?.value; // "Sun", "Mon", etc.
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);

  if (weekday === 'Sun') {
    return {
      allowed: false,
      reason: 'Class submissions are closed on Sundays. The academy operates Monday through Saturday.',
    };
  }

  const currentMinutes = hour * 60 + minute;
  const startMinutes = 6 * 60 + 30; // 06:30 AM IST (390 mins)
  const endMinutes = 21 * 60; // 09:00 PM IST (1260 mins)

  if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
    return {
      allowed: false,
      reason:
        'Class submissions are only open during academy lecture hours (06:30 AM – 09:00 PM IST, Mon–Sat). Please log during your scheduled lecture window.',
    };
  }

  return { allowed: true };
}
