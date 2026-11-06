import { DEFAULT_PREFERENCES, Facility, Incident } from '../models/domain';
import { createSeed } from '../data/seed';
import { projectTopology } from './topology';
import {
  demandDelta,
  filterFacilities,
  isAlerting,
  presentFacility,
  resolveSelectedIncident,
  summarize,
  transitionIncident,
  windowSeries,
} from './operations';

describe('incident transitions', () => {
  const incident = (): Incident => ({
    id: 'INC-1',
    facilityId: 'aurora',
    title: 'Tap changer',
    summary: 'Hunting',
    severity: 'high',
    status: 'open',
    category: 'protection',
    openedAt: '2026-11-06T08:00:00.000Z',
    updatedAt: '2026-11-06T08:00:00.000Z',
    assignee: 'Amina Rahman',
  });

  it('acknowledges an open incident and rejects a second acknowledgement', () => {
    const acknowledged = transitionIncident(incident(), 'acknowledge', '2026-11-06T09:00:00.000Z');
    expect(acknowledged.ok).toBe(true);
    expect(acknowledged.incident?.status).toBe('acknowledged');
    const again = transitionIncident(acknowledged.incident ?? incident(), 'acknowledge', '2026-11-06T09:10:00.000Z');
    expect(again.ok).toBe(false);
  });

  it('requires acknowledgement before investigation', () => {
    expect(transitionIncident(incident(), 'investigate', '2026-11-06T09:00:00.000Z').ok).toBe(false);
    const acknowledged = transitionIncident(incident(), 'acknowledge', '2026-11-06T09:00:00.000Z').incident;
    expect(acknowledged).toBeTruthy();
    const investigating = transitionIncident(acknowledged!, 'investigate', '2026-11-06T09:20:00.000Z');
    expect(investigating.incident?.status).toBe('investigating');
  });

  it('resolves only with a usable note and can reopen', () => {
    const acknowledged = transitionIncident(incident(), 'acknowledge', '2026-11-06T09:00:00.000Z').incident!;
    expect(transitionIncident(acknowledged, 'resolve', '2026-11-06T10:00:00.000Z', 'short').ok).toBe(false);
    const resolved = transitionIncident(
      acknowledged,
      'resolve',
      '2026-11-06T10:00:00.000Z',
      'Replaced the tap motor and verified a clean ramp.',
    );
    expect(resolved.incident?.status).toBe('resolved');
    expect(resolved.incident?.resolution).toContain('tap motor');
    const reopened = transitionIncident(resolved.incident!, 'reopen', '2026-11-06T11:00:00.000Z');
    expect(reopened.incident?.status).toBe('open');
    expect(reopened.incident?.resolution).toBeUndefined();
  });
});

describe('facility queries', () => {
  const facilities: Facility[] = [
    facility('aurora', 'Aurora Substation', 'nordics', 'nominal', 100, 50, 95),
    facility('gulf', 'Gulf Refinery Bus', 'us-gulf', 'offline', 200, 0, 40),
    facility('rhine', 'Rhine Chemical Works', 'dach', 'degraded', 100, 70, 80),
  ];

  it('filters by text and region', () => {
    const matches = filterFacilities(facilities, {
      region: 'nordics',
      type: 'all',
      status: 'all',
      text: 'aurora',
      alertingOnly: false,
      preferences: DEFAULT_PREFERENCES,
    });
    expect(matches.map((item) => item.id)).toEqual(['aurora']);
  });

  it('treats offline, degraded, and threshold breaches as alerting', () => {
    expect(isAlerting(facilities[1]!, DEFAULT_PREFERENCES)).toBe(true);
    expect(isAlerting(facilities[2]!, DEFAULT_PREFERENCES)).toBe(true);
    const quiet = facility('quiet', 'Quiet Campus', 'uk', 'nominal', 100, 40, 90);
    expect(isAlerting(quiet, DEFAULT_PREFERENCES)).toBe(false);
    expect(isAlerting(quiet, { ...DEFAULT_PREFERENCES, loadAlertPct: 70, healthFloor: 92 })).toBe(true);
  });

  it('summarizes demand, reserve, and open critical work', () => {
    const incidents: Incident[] = [
      {
        id: 'INC-9',
        facilityId: 'gulf',
        title: 'Trip',
        summary: 'Offline',
        severity: 'critical',
        status: 'open',
        category: 'protection',
        openedAt: '2026-11-06T08:00:00.000Z',
        updatedAt: '2026-11-06T08:00:00.000Z',
        assignee: 'Amina Rahman',
      },
    ];
    const summary = summarize(facilities, incidents, DEFAULT_PREFERENCES, 1.5);
    expect(summary.demandMw).toBe(120);
    expect(summary.capacityMw).toBe(400);
    expect(summary.reservePct).toBe(70);
    expect(summary.criticalIncidents).toBe(1);
    expect(summary.alertingFacilities).toBe(2);
    expect(summary.demandDeltaPct).toBe(1.5);
  });
});

describe('series windows and seed', () => {
  it('builds a 24 hour window and a 7 day daily window', () => {
    const values = Array.from({ length: 24 * 30 }, (_, index) => index);
    const day = windowSeries(values, '24h', '2026-10-07T00:00:00.000Z');
    expect(day.values).toHaveLength(24);
    expect(day.labels[0]).toMatch(/^\d{2}:\d{2}$/);
    const week = windowSeries(values, '7d', '2026-10-07T00:00:00.000Z');
    expect(week.values).toHaveLength(7);
  });

  it('returns null demand delta until a day of history exists', () => {
    expect(demandDelta([10, 12])).toBeNull();
    expect(demandDelta([...Array(24).fill(100), 110])).toBe(10);
  });

  it('seeds a full operating picture with the refinery still offline', () => {
    const snapshot = createSeed(new Date('2026-11-06T12:00:00.000Z'));
    expect(snapshot.facilities).toHaveLength(16);
    expect(snapshot.assets.length).toBeGreaterThan(40);
    expect(snapshot.incidents.some((item) => item.id === 'INC-2418' && item.status === 'open')).toBe(true);
    const gulf = snapshot.facilities.find((item) => item.id === 'gulf');
    expect(gulf?.loadMw).toBe(0);
    expect(snapshot.series['aurora']?.actual).toHaveLength(24 * 30);
    expect(snapshot.topology.nodes.length).toBe(23);
    expect(snapshot.topology.edges.length).toBeGreaterThan(16);
  });

  it('keeps badges, alerts, and topology on the same facility status', () => {
    const quiet = facility('quiet', 'Quiet Campus', 'uk', 'nominal', 100, 40, 90);
    const hot = facility('hot', 'Hot Bus', 'uk', 'nominal', 100, 90, 95);
    expect(presentFacility(quiet, DEFAULT_PREFERENCES).status).toBe('nominal');
    expect(presentFacility(hot, DEFAULT_PREFERENCES).status).toBe('degraded');
    expect(isAlerting(presentFacility(hot, DEFAULT_PREFERENCES), DEFAULT_PREFERENCES)).toBe(true);
    const calmEdge = projectTopology([quiet]).edges.find((edge) => edge.target === 'quiet');
    const hotEdge = projectTopology([presentFacility(hot, DEFAULT_PREFERENCES)]).edges.find((edge) => edge.target === 'hot');
    expect(calmEdge?.flowMw).toBe(40);
    expect(calmEdge?.stressed).toBe(false);
    expect(hotEdge?.flowMw).toBe(90);
    expect(hotEdge?.stressed).toBe(true);
    const raised = projectTopology([{ ...quiet, loadMw: 55 }]).edges.find((edge) => edge.target === 'quiet');
    expect(raised?.flowMw).toBe(55);
  });
});

describe('incident selection', () => {
  const incidents: Incident[] = [
    {
      id: 'INC-1',
      facilityId: 'aurora',
      title: 'Tap',
      summary: 'Hunting',
      severity: 'critical',
      status: 'open',
      category: 'protection',
      openedAt: '2026-11-06T08:00:00.000Z',
      updatedAt: '2026-11-06T08:00:00.000Z',
      assignee: 'Amina Rahman',
    },
    {
      id: 'INC-2',
      facilityId: 'gulf',
      title: 'Trip',
      summary: 'Offline',
      severity: 'high',
      status: 'resolved',
      category: 'protection',
      openedAt: '2026-11-06T08:00:00.000Z',
      updatedAt: '2026-11-06T08:00:00.000Z',
      assignee: 'Amina Rahman',
    },
  ];

  it('uses the route id even when that incident is filtered out', () => {
    const active = incidents.filter((incident) => incident.status !== 'resolved');
    expect(resolveSelectedIncident(incidents, active, null)).toEqual({ incident: null, hiddenByFilter: false });
    expect(resolveSelectedIncident(incidents, active, 'INC-1').incident?.id).toBe('INC-1');
    expect(resolveSelectedIncident(incidents, active, 'INC-1').hiddenByFilter).toBe(false);
    const hidden = resolveSelectedIncident(incidents, active, 'INC-2');
    expect(hidden.incident?.id).toBe('INC-2');
    expect(hidden.hiddenByFilter).toBe(true);
    expect(hidden.incident?.id).not.toBe(active[0]?.id);
  });

  it('does not substitute another incident when the route id is missing', () => {
    const active = incidents.filter((incident) => incident.status !== 'resolved');
    expect(resolveSelectedIncident(incidents, active, 'INC-404')).toEqual({ incident: null, hiddenByFilter: false });
  });
});

function facility(
  id: string,
  name: string,
  region: Facility['region'],
  status: Facility['status'],
  capacityMw: number,
  loadMw: number,
  health: number,
): Facility {
  return {
    id,
    code: id,
    name,
    type: 'industrial',
    status,
    region,
    city: 'Test',
    country: 'Test',
    latitude: 0,
    longitude: 0,
    capacityMw,
    loadMw,
    health,
    voltageKv: 33,
    powerFactor: 0.95,
    commissioned: '2020-01-01',
    operator: 'GridPulse',
  };
}
