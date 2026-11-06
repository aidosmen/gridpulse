import {
  Activity,
  Asset,
  Facility,
  FacilityStatus,
  FacilityType,
  HISTORY_HOURS,
  Incident,
  RegionId,
  SeriesBundle,
  WorkspaceSnapshot,
} from '../models/domain';
import { round1 } from '../domain/operations';
import { projectTopology } from '../domain/topology';

interface FacilityDraft {
  id: string;
  code: string;
  name: string;
  type: FacilityType;
  status: FacilityStatus;
  region: RegionId;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  capacityMw: number;
  target: number;
  health: number;
  voltageKv: number;
  powerFactor: number;
  commissioned: string;
  operator: string;
  phase: number;
}

const ASSET_KINDS: Record<FacilityType, { name: string; kind: string }[]> = {
  transmission: [
    { name: 'TR-2 primary transformer', kind: 'Transformer' },
    { name: 'Bus coupler CB-4', kind: 'Breaker' },
    { name: 'Feeder A breaker', kind: 'Breaker' },
    { name: 'Revenue meter M-1', kind: 'Meter' },
  ],
  generation: [
    { name: 'Collector transformer', kind: 'Transformer' },
    { name: 'Inverter block 1', kind: 'Inverter' },
    { name: 'Inverter block 2', kind: 'Inverter' },
    { name: 'Grid breaker', kind: 'Breaker' },
  ],
  storage: [
    { name: 'Battery string A', kind: 'Battery' },
    { name: 'Battery string B', kind: 'Battery' },
    { name: 'PCS inverter', kind: 'Inverter' },
    { name: 'Site meter', kind: 'Meter' },
  ],
  'data-center': [
    { name: 'UPS A', kind: 'UPS' },
    { name: 'UPS B', kind: 'UPS' },
    { name: 'PDU row 3', kind: 'PDU' },
    { name: 'Utility breaker', kind: 'Breaker' },
  ],
  industrial: [
    { name: 'Main transformer', kind: 'Transformer' },
    { name: 'Process feeder', kind: 'Feeder' },
    { name: 'Harmonic filter', kind: 'Filter' },
    { name: 'Plant meter', kind: 'Meter' },
  ],
  campus: [
    { name: 'Service transformer', kind: 'Transformer' },
    { name: 'Chiller feeder', kind: 'Feeder' },
    { name: 'Emergency generator', kind: 'Generator' },
    { name: 'Building meter', kind: 'Meter' },
  ],
};

export function createSeed(now = new Date()): WorkspaceSnapshot {
  const clock = new Date(now);
  clock.setMinutes(0, 0, 0);
  const timelineStart = new Date(clock.getTime() - (HISTORY_HOURS - 1) * 3_600_000).toISOString();
  const drafts = facilityDrafts();
  const rand = mulberry32(24018);
  const facilities: Facility[] = [];
  const series: Record<string, SeriesBundle> = {};

  for (const draft of drafts) {
    const actual: number[] = [];
    const forecast: number[] = [];
    for (let hour = 0; hour < HISTORY_HOURS; hour += 1) {
      const shape = dailyShape(hour, draft.phase);
      const forecastMw = clamp(draft.capacityMw * draft.target * shape, 0, draft.capacityMw * 0.98);
      const noise = 0.975 + rand() * 0.05;
      forecast.push(round1(forecastMw));
      actual.push(round1(forecastMw * noise));
    }
    applyRegime(draft.status, actual);
    const loadMw = actual[actual.length - 1] ?? 0;
    const { target: _target, phase: _phase, ...rest } = draft;
    facilities.push({ ...rest, loadMw });
    series[draft.id] = { actual, forecast };
  }

  const assets = buildAssets(facilities, rand);
  const incidents = buildIncidents(clock);
  const activities = buildActivities(incidents, clock);
  const topology = projectTopology(facilities);

  return { facilities, assets, incidents, activities, topology, series, timelineStart };
}

function facilityDrafts(): FacilityDraft[] {
  return [
    draft('aurora', 'GP-OSL-01', 'Aurora Substation', 'transmission', 'nominal', 'nordics', 'Oslo', 'Norway', 59.9139, 10.7522, 420, 0.68, 92, 132, 0.97, '2014-04-12', 'NordGrid', 0.2),
    draft('fjord', 'GP-BGO-04', 'Fjord Data Hall', 'data-center', 'watch', 'nordics', 'Bergen', 'Norway', 60.3913, 5.3221, 86, 0.83, 88, 33, 0.95, '2019-09-02', 'Fjord Digital', 0.8),
    draft('meridian', 'GP-HAM-02', 'Meridian Wind Collector', 'generation', 'nominal', 'dach', 'Hamburg', 'Germany', 53.5511, 9.9937, 240, 0.66, 90, 110, 0.98, '2021-06-18', 'Elbe Power', 1.1),
    draft('rhine', 'GP-LUD-07', 'Rhine Chemical Works', 'industrial', 'degraded', 'dach', 'Ludwigshafen', 'Germany', 49.4774, 8.4452, 180, 0.91, 71, 33, 0.89, '2008-11-03', 'RheinChem', 2.4),
    draft('black-forest', 'GP-FRE-03', 'Black Forest Campus', 'campus', 'nominal', 'dach', 'Freiburg', 'Germany', 47.999, 7.8421, 42, 0.55, 95, 20, 0.96, '2016-03-22', 'Black Forest Estate', 0.4),
    draft('thames', 'GP-LON-01', 'Thames Switching Yard', 'transmission', 'watch', 'uk', 'London', 'United Kingdom', 51.5074, -0.087, 510, 0.79, 84, 275, 0.94, '2004-01-19', 'Thames Grid', 1.6),
    draft('docklands', 'GP-LON-11', 'Docklands Compute', 'data-center', 'degraded', 'uk', 'London', 'United Kingdom', 51.5054, -0.0235, 96, 0.92, 79, 33, 0.91, '2018-08-09', 'Docklands Compute Co', 2.1),
    draft('iberia', 'GP-SVQ-05', 'Iberia Solar Park', 'generation', 'nominal', 'iberia', 'Seville', 'Spain', 37.3891, -5.9845, 310, 0.64, 93, 132, 0.99, '2022-04-30', 'Sol Iberia', 3.2),
    draft('tagus', 'GP-LIS-02', 'Tagus Manufacturing', 'industrial', 'maintenance', 'iberia', 'Lisbon', 'Portugal', 38.7223, -9.1393, 74, 0.56, 86, 20, 0.93, '2011-10-14', 'Tagus Works', 0.9),
    draft('hudson', 'GP-EWR-01', 'Hudson Intertie', 'transmission', 'watch', 'us-ne', 'Newark', 'United States', 40.7357, -74.1724, 640, 0.8, 81, 345, 0.95, '1998-06-01', 'Hudson Intertie Authority', 1.3),
    draft('midtown', 'GP-NYC-08', 'Midtown Tower Plant', 'campus', 'degraded', 'us-ne', 'New York', 'United States', 40.7549, -73.984, 58, 0.85, 77, 13, 0.9, '2013-12-11', 'Midtown Facilities', 2.7),
    draft('lakeshore', 'GP-CHI-04', 'Lakeshore Hospital Grid', 'campus', 'nominal', 'us-ne', 'Chicago', 'United States', 41.8781, -87.6298, 36, 0.74, 91, 13, 0.97, '2017-02-08', 'Lakeshore Health', 0.6),
    draft('cascade', 'GP-PDX-03', 'Cascade Hydro', 'generation', 'nominal', 'us-west', 'Portland', 'United States', 45.5152, -122.6784, 280, 0.73, 96, 230, 0.98, '1986-05-27', 'Cascade Hydro Co', 0.3),
    draft('silicon', 'GP-SJC-09', 'Silicon Forge', 'data-center', 'degraded', 'us-west', 'San Jose', 'United States', 37.3382, -121.8863, 120, 0.9, 74, 33, 0.92, '2020-01-15', 'Silicon Forge', 1.9),
    draft('prairie', 'GP-DFW-06', 'Prairie Battery Hub', 'storage', 'nominal', 'us-gulf', 'Dallas', 'United States', 32.7767, -96.797, 150, 0.42, 89, 138, 0.96, '2023-07-21', 'Prairie Storage', 2.2),
    draft('gulf', 'GP-HOU-01', 'Gulf Refinery Bus', 'industrial', 'offline', 'us-gulf', 'Houston', 'United States', 29.7604, -95.3698, 210, 0.78, 38, 138, 0.84, '2001-09-04', 'Gulf Process', 1.4),
  ];
}

function draft(
  id: string,
  code: string,
  name: string,
  type: FacilityType,
  status: FacilityStatus,
  region: RegionId,
  city: string,
  country: string,
  latitude: number,
  longitude: number,
  capacityMw: number,
  target: number,
  health: number,
  voltageKv: number,
  powerFactor: number,
  commissioned: string,
  operator: string,
  phase: number,
): FacilityDraft {
  return {
    id,
    code,
    name,
    type,
    status,
    region,
    city,
    country,
    latitude,
    longitude,
    capacityMw,
    target,
    health,
    voltageKv,
    powerFactor,
    commissioned,
    operator,
    phase,
  };
}

function buildIncidents(now: Date): Incident[] {
  const ago = (hours: number) => new Date(now.getTime() - hours * 3_600_000).toISOString();
  return [
    incident('INC-2418', 'aurora', 'Tap changer hunting on TR-2', 'Automatic tap operations exceeded the hourly limit during the morning ramp. Voltage is still inside band, but the mechanism temperature is climbing.', 'critical', 'open', 'protection', ago(2.2), ago(0.4), 'Leo Martins'),
    incident('INC-2421', 'gulf', 'Main incoming offline after protection trip', 'Differential protection opened the refinery incoming breaker. Process load is islanded on emergency generation and the bus remains de-energized.', 'critical', 'open', 'protection', ago(6.5), ago(1.1), 'Jonah Hale'),
    incident('INC-2419', 'silicon', 'Utility breaker thermal alarm', 'Infrared on the utility breaker shows a hot joint above the facility threshold. IT load has been capped by the site BMS.', 'critical', 'open', 'thermal', ago(5), ago(0.8), 'Priya Shah'),
    incident('INC-2414', 'docklands', 'UPS B runtime beyond design window', 'UPS B transferred to battery during a utility sag and has not returned to normal. Estimated runtime is inside the escalation window.', 'high', 'acknowledged', 'capacity', ago(9), ago(3), 'Sofia Keller'),
    incident('INC-2409', 'rhine', 'Process feeder overload at batch start', 'Feeder current exceeded the 15-minute rating when line two restarted. Harmonic distortion is elevated on the same bus.', 'high', 'investigating', 'capacity', ago(14), ago(2), 'Leo Martins'),
    incident('INC-2411', 'midtown', 'Chiller feeder voltage sag', 'A sag to 0.89 pu coincided with the chiller plant start. Two chillers stayed offline and tower load is being served by the remaining pair.', 'high', 'open', 'power-quality', ago(4.5), ago(1.6), 'Amina Rahman'),
    incident('INC-2398', 'hudson', 'Bus coupler SF6 density watch', 'Density on coupler CB-4 fell into the advisory band. No trip bias is active. A gas integrity check is scheduled with the yard crew.', 'medium', 'investigating', 'protection', ago(30), ago(6), 'Jonah Hale'),
    incident('INC-2420', 'fjord', 'PDU row 3 phase imbalance', 'Phase B on PDU row 3 is carrying 18% more than the other phases after a rack migration. The row is still inside breaker limits.', 'medium', 'open', 'power-quality', ago(7), ago(2.4), 'Priya Shah'),
    incident('INC-2416', 'iberia', 'Inverter block 2 curtailment mismatch', 'Block 2 is reporting curtailed output while irradiance on the sister block is unrestricted. SCADA and the inverter gateway disagree by 6 MW.', 'medium', 'acknowledged', 'communications', ago(11), ago(4), 'Sofia Keller'),
    incident('INC-2412', 'meridian', 'Collector yaw communications delay', 'Two turbine strings are late on yaw acknowledgements. Production is steady and the collector transformer is nominal.', 'medium', 'open', 'communications', ago(3.2), ago(1.2), 'Leo Martins'),
    incident('INC-2415', 'prairie', 'String B state-of-charge drift', 'String B has drifted 4% from the site setpoint since yesterday’s arbitrage window. No thermal alarms are present.', 'low', 'open', 'capacity', ago(20), ago(5), 'Priya Shah'),
    incident('INC-2391', 'tagus', 'Maintenance isolation extended', 'The planned feeder isolation overran the outage window by 90 minutes. Production is on the standby transformer.', 'low', 'investigating', 'maintenance', ago(26), ago(8), 'Jonah Hale'),
    incident('INC-2402', 'thames', 'Protection relay communications loss', 'The yard HMI lost polling to relay R-17 for 22 minutes. Polling recovered after a gateway restart and event logs were complete.', 'medium', 'resolved', 'communications', ago(52), ago(28), 'Sofia Keller', 'Gateway restarted and relay event log reconciled. No protection was blind during the gap.'),
    incident('INC-2407', 'cascade', 'Collector transformer temperature excursion', 'Top-oil temperature touched the alarm setpoint during a high-water period. Cooling pumps staged correctly and temperature fell back inside band.', 'high', 'resolved', 'thermal', ago(70), ago(40), 'Amina Rahman', 'Cooling stage 2 verified. Temperature returned below 72°C and the alarm cleared.'),
    incident('INC-2388', 'black-forest', 'Meter firmware window', 'Revenue meter firmware was applied inside the agreed maintenance window. Billing register totals matched the pre-change snapshot.', 'low', 'resolved', 'maintenance', ago(96), ago(90), 'Leo Martins', 'Firmware 4.3.1 applied. Register checksum matched the snapshot taken before the window.'),
  ];
}

function buildActivities(incidents: Incident[], now: Date): Activity[] {
  const activities: Activity[] = [];
  for (const item of incidents) {
    activities.push({
      id: `${item.id}-opened`,
      at: item.openedAt,
      message: `Opened ${item.id}: ${item.title}.`,
      actor: 'GridPulse monitor',
      facilityId: item.facilityId,
      incidentId: item.id,
    });
    if (item.status !== 'open') {
      activities.push({
        id: `${item.id}-status`,
        at: item.updatedAt,
        message: item.resolution
          ? `Resolved ${item.id}. ${item.resolution}`
          : `${labelStatus(item.status)} ${item.id}.`,
        actor: item.assignee,
        facilityId: item.facilityId,
        incidentId: item.id,
      });
    }
  }
  activities.push({
    id: 'inspection-cascade',
    at: new Date(now.getTime() - 18 * 3_600_000).toISOString(),
    message: 'Quarterly inspection logged for Cascade Hydro collector yard.',
    actor: 'Jonah Hale',
    facilityId: 'cascade',
  });
  return activities.sort((left, right) => right.at.localeCompare(left.at));
}

function buildAssets(facilities: Facility[], rand: () => number): Asset[] {
  const assets: Asset[] = [];
  for (const facility of facilities) {
    ASSET_KINDS[facility.type].forEach((asset, index) => {
      const status = assetStatus(facility.status, index);
      const base = facility.capacityMw === 0 ? 0 : (facility.loadMw / facility.capacityMw) * 100;
      assets.push({
        id: `${facility.id}-a${index + 1}`,
        facilityId: facility.id,
        name: asset.name,
        kind: asset.kind,
        status,
        temperatureC:
          status === 'offline' ? 22 : Math.round(30 + rand() * 28 + (status === 'degraded' ? 16 : 0)),
        loadPct: status === 'offline' ? 0 : clamp(Math.round(base + (rand() - 0.5) * 10), 0, 99),
      });
    });
  }
  return assets;
}

function applyRegime(status: FacilityStatus, actual: number[]): void {
  if (status === 'offline') {
    const tripAt = Math.floor(HISTORY_HOURS * 0.86);
    for (let index = tripAt; index < actual.length; index += 1) {
      actual[index] = 0;
    }
  }
  if (status === 'maintenance') {
    const start = actual.length - 48;
    for (let index = start; index < actual.length; index += 1) {
      actual[index] = round1((actual[index] ?? 0) * 0.45);
    }
  }
}

function assetStatus(status: FacilityStatus, index: number): FacilityStatus {
  if (status === 'offline' && index < 2) {
    return 'offline';
  }
  if (status === 'maintenance' && index === 0) {
    return 'maintenance';
  }
  if (status === 'degraded' && index === 0) {
    return 'degraded';
  }
  if (status === 'watch' && index === 1) {
    return 'watch';
  }
  return status === 'offline' || status === 'degraded' || status === 'watch' || status === 'maintenance'
    ? 'nominal'
    : 'nominal';
}

function dailyShape(hourIndex: number, phase: number): number {
  const hour = hourIndex % 24;
  const daily = 0.8 + 0.2 * Math.sin(((hour - 8) / 24) * Math.PI * 2 + phase);
  const weekly = 1 + 0.035 * Math.sin((hourIndex / (24 * 7)) * Math.PI * 2);
  return daily * weekly;
}

function incident(
  id: string,
  facilityId: string,
  title: string,
  summary: string,
  severity: Incident['severity'],
  status: Incident['status'],
  category: Incident['category'],
  openedAt: string,
  updatedAt: string,
  assignee: string,
  resolution?: string,
): Incident {
  return { id, facilityId, title, summary, severity, status, category, openedAt, updatedAt, assignee, resolution };
}

function labelStatus(status: Incident['status']): string {
  if (status === 'acknowledged') {
    return 'Acknowledged';
  }
  if (status === 'investigating') {
    return 'Investigation updated for';
  }
  return 'Updated';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
