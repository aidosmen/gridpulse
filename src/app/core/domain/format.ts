export function formatMw(value: number): string {
  return `${formatNumber(value, 1)} MW`;
}

export function formatPct(value: number, digits = 0): string {
  return `${formatNumber(value, digits)}%`;
}

export function formatNumber(value: number, digits = 1): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatSignedPct(value: number | null): string {
  if (value === null) {
    return '—';
  }
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${formatNumber(value, 1)}%`;
}

export function formatRelative(iso: string, now = Date.now()): string {
  const minutes = Math.round((now - new Date(iso).getTime()) / 60_000);
  if (Math.abs(minutes) < 1) {
    return 'just now';
  }
  if (Math.abs(minutes) < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 36) {
    return `${hours}h ago`;
  }
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function formatTimestamp(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}
