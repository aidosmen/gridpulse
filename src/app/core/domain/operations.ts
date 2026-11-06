import {
  Activity,
  Facility,
  FacilityStatus,
  FacilityType,
  HISTORY_HOURS,
  Horizon,
  Incident,
  IncidentAction,
  IncidentStatus,
  Preferences,
  RegionFilter,
  SeriesBundle,
} from '../models/domain';

export interface FacilityQuery {
  region: RegionFilter;
  type: FacilityType | 'all';
  status: FacilityStatus | 'all';
  text: string;
  alertingOnly: boolean;
  preferences: Preferences;
}

export interface GridSummary {
  demandMw: number;
  capacityMw: number;
  reservePct: number;
  health: number;
  openIncidents: number;
  criticalIncidents: number;
  alertingFacilities: number;
  demandDeltaPct: number | null;
}

export interface TransitionResult {
  ok: boolean;
  incident?: Incident;
  message: string;
}

export interface ChartWindow {
  values: number[];
  labels: string[];
}

const OPEN_STATUSES: readonly IncidentStatus[] = ['open', 'acknowledged', 'investigating'];

export const MIN_NOTE_LENGTH = 8;

export interface IncidentSelection {
  incident: Incident | null;
  hiddenByFilter: boolean;
}

export function presentFacility(facility: Facility, preferences: Preferences): Facility {
  if (facility.status !== 'nominal' && facility.status !== 'watch') {
    return facility;
  }
  if (!isAlerting(facility, preferences)) {
    return facility;
  }
  return { ...facility, status: 'degraded' };
}

export function resolveSelectedIncident(
  incidents: readonly Incident[],
  filtered: readonly Incident[],
  routeId: string | null,
): IncidentSelection {
  if (!routeId) {
    return { incident: null, hiddenByFilter: false };
  }
  const incident = incidents.find((item) => item.id === routeId) ?? null;
  if (!incident) {
    return { incident: null, hiddenByFilter: false };
  }
  return {
    incident,
    hiddenByFilter: !filtered.some((item) => item.id === routeId),
  };
}

export function isAlerting(facility: Facility, preferences: Preferences): boolean {
  if (facility.status === 'offline' || facility.status === 'degraded') {
    return true;
  }
  if (facility.capacityMw <= 0) {
    return false;
  }
  const loadPct = (facility.loadMw / facility.capacityMw) * 100;
  return loadPct >= preferences.loadAlertPct || facility.health < preferences.healthFloor;
}

export function filterFacilities(facilities: Facility[], query: FacilityQuery): Facility[] {
  const text = query.text.trim().toLowerCase();
  return facilities.filter((facility) => {
    if (query.region !== 'all' && facility.region !== query.region) {
      return false;
    }
    if (query.type !== 'all' && facility.type !== query.type) {
      return false;
    }
    if (query.status !== 'all' && facility.status !== query.status) {
      return false;
    }
    if (query.alertingOnly && !isAlerting(facility, query.preferences)) {
      return false;
    }
    if (!text) {
      return true;
    }
    return [facility.name, facility.code, facility.city, facility.country, facility.operator].some((value) =>
      value.toLowerCase().includes(text),
    );
  });
}

export function summarize(
  facilities: Facility[],
  incidents: Incident[],
  preferences: Preferences,
  demandDeltaPct: number | null = null,
): GridSummary {
  const demandMw = facilities.reduce((sum, facility) => sum + facility.loadMw, 0);
  const capacityMw = facilities.reduce((sum, facility) => sum + facility.capacityMw, 0);
  const health = facilities.length
    ? facilities.reduce((sum, facility) => sum + facility.health, 0) / facilities.length
    : 0;
  const open = incidents.filter((incident) => OPEN_STATUSES.includes(incident.status));
  return {
    demandMw,
    capacityMw,
    reservePct: capacityMw === 0 ? 0 : ((capacityMw - demandMw) / capacityMw) * 100,
    health,
    openIncidents: open.length,
    criticalIncidents: open.filter((incident) => incident.severity === 'critical').length,
    alertingFacilities: facilities.filter((facility) => isAlerting(facility, preferences)).length,
    demandDeltaPct,
  };
}

export function transitionIncident(
  incident: Incident,
  action: IncidentAction,
  at: string,
  note?: string,
): TransitionResult {
  const resolution = note?.trim() ?? '';

  switch (action) {
    case 'acknowledge':
      if (incident.status !== 'open') {
        return { ok: false, message: 'Only open incidents can be acknowledged.' };
      }
      return {
        ok: true,
        message: 'Incident acknowledged.',
        incident: { ...incident, status: 'acknowledged', updatedAt: at },
      };
    case 'investigate':
      if (incident.status !== 'acknowledged') {
        return { ok: false, message: 'Acknowledge the incident before investigation starts.' };
      }
      return {
        ok: true,
        message: 'Investigation started.',
        incident: { ...incident, status: 'investigating', updatedAt: at },
      };
    case 'resolve':
      if (incident.status !== 'acknowledged' && incident.status !== 'investigating') {
        return { ok: false, message: 'Resolve an acknowledged or active investigation.' };
      }
      if (resolution.length < MIN_NOTE_LENGTH) {
        return { ok: false, message: 'Add a resolution note of at least 8 characters.' };
      }
      return {
        ok: true,
        message: 'Incident resolved.',
        incident: { ...incident, status: 'resolved', updatedAt: at, resolution },
      };
    case 'reopen':
      if (incident.status !== 'resolved') {
        return { ok: false, message: 'Only resolved incidents can be reopened.' };
      }
      return {
        ok: true,
        message: 'Incident reopened.',
        incident: { ...incident, status: 'open', updatedAt: at, resolution: undefined },
      };
  }
}

export function describeTransition(action: IncidentAction, incident: Incident): string {
  switch (action) {
    case 'acknowledge':
      return `Acknowledged ${incident.id}.`;
    case 'investigate':
      return `Started investigation on ${incident.id}.`;
    case 'resolve':
      return `Resolved ${incident.id}. ${incident.resolution ?? ''}`.trim();
    case 'reopen':
      return `Reopened ${incident.id}.`;
  }
}

export function makeActivity(
  id: string,
  incident: Incident,
  message: string,
  actor: string,
  at: string,
): Activity {
  return {
    id,
    at,
    message,
    actor,
    facilityId: incident.facilityId,
    incidentId: incident.id,
  };
}

export function sumLoad(series: Record<string, SeriesBundle>, facilities: Facility[]): number[] {
  const totals = Array.from({ length: HISTORY_HOURS }, () => 0);
  for (const facility of facilities) {
    const actual = series[facility.id]?.actual;
    if (!actual) {
      continue;
    }
    for (let index = 0; index < totals.length; index += 1) {
      totals[index] += actual[index] ?? 0;
    }
  }
  return totals;
}

export function demandDelta(hourly: number[]): number | null {
  if (hourly.length < 25) {
    return null;
  }
  const latest = hourly[hourly.length - 1] ?? 0;
  const previous = hourly[hourly.length - 25] ?? 0;
  if (previous === 0) {
    return null;
  }
  return ((latest - previous) / previous) * 100;
}

export function windowSeries(values: number[], horizon: Horizon, timelineStart: string): ChartWindow {
  const hours = horizon === '24h' ? 24 : horizon === '7d' ? 24 * 7 : HISTORY_HOURS;
  const slice = values.slice(-hours);
  const origin = new Date(timelineStart).getTime() + (values.length - slice.length) * 3_600_000;

  if (horizon === '24h') {
    return {
      values: slice.map((value) => round1(value)),
      labels: slice.map((_, index) => formatHour(new Date(origin + index * 3_600_000))),
    };
  }

  const days = horizon === '7d' ? 7 : 30;
  const bucketed: number[] = [];
  const labels: string[] = [];
  for (let day = 0; day < days; day += 1) {
    const chunk = slice.slice(day * 24, (day + 1) * 24);
    const average = chunk.reduce((sum, value) => sum + value, 0) / Math.max(chunk.length, 1);
    bucketed.push(round1(average));
    labels.push(
      new Date(origin + day * 24 * 3_600_000).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
      }),
    );
  }
  return { values: bucketed, labels };
}

export function regionEnergy(
  facilities: Facility[],
  series: Record<string, SeriesBundle>,
  horizon: Horizon,
): { region: Facility['region']; mwh: number }[] {
  const hours = horizon === '24h' ? 24 : horizon === '7d' ? 168 : HISTORY_HOURS;
  const totals = new Map<Facility['region'], number>();
  for (const facility of facilities) {
    const actual = series[facility.id]?.actual.slice(-hours) ?? [];
    const energy = actual.reduce((sum, value) => sum + value, 0);
    totals.set(facility.region, (totals.get(facility.region) ?? 0) + energy);
  }
  return [...totals.entries()]
    .map(([region, mwh]) => ({ region, mwh: round1(mwh) }))
    .sort((left, right) => right.mwh - left.mwh);
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function formatHour(date: Date): string {
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
