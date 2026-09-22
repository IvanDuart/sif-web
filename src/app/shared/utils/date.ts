export function formatInstant(isoString: string | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!isoString) return '—';
  const date = new Date(isoString);
  return date.toLocaleDateString('es-AR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options
  });
}

export function formatInstantWithTime(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  const date = new Date(isoString);
  return date.toLocaleDateString('es-AR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatDateInput(isoString: string | null | undefined): Date | undefined {
  if (!isoString) return undefined;
  const d = new Date(isoString);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function nowUtcIso(): string {
  return new Date().toISOString();
}

export function isPastInstant(isoString: string | null | undefined): boolean {
  if (!isoString) return false;
  const time = new Date(isoString).getTime();
  return !Number.isNaN(time) && time < Date.now();
}

export function toLocalISOString(date: Date): string {
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
}
