/**
 * Semantic status palette — single source is the `--status-*` CSS variables in
 * `src/styles.less`. These are FIXED colors (blue / green / gray / amber /
 * orange) that must NOT follow the tenant accent; the accent only drives the
 * brand, never statuses.
 */

const STATUS_KEYS = ['SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'PROPOSED'] as const;

const VAR_MAP: Record<string, string> = {
  SCHEDULED: '--status-scheduled',
  COMPLETED: '--status-completed',
  CANCELLED: '--status-cancelled',
  NO_SHOW: '--status-no-show',
  PROPOSED: '--status-proposed',
};

const FALLBACKS: Record<string, string> = {
  SCHEDULED: '#3b82f6',
  COMPLETED: '#10b981',
  CANCELLED: '#6b7280',
  NO_SHOW: '#f59e0b',
  PROPOSED: '#f97316',
};

function readStatusVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return /^#([0-9a-fA-F]{6})$/.test(v) ? v.toLowerCase() : fallback;
}

export const STATUS_COLORS: Record<string, string> = STATUS_KEYS.reduce(
  (acc, key) => {
    acc[key] = readStatusVar(VAR_MAP[key], FALLBACKS[key]);
    return acc;
  },
  {} as Record<string, string>
);

export function statusColor(status: string): string {
  return STATUS_COLORS[status] ?? FALLBACKS['SCHEDULED'];
}

/** Calendar day-state colors (legend dots & day backgrounds). */
export const HOLIDAY_COLOR = readStatusVar('--status-holiday', '#dc2626');
export const CLOSED_COLOR = readStatusVar('--status-closed', '#94a3b8');
export const ACTIVE_HOURS_COLOR = readStatusVar('--status-active-hours', '#10b981');
