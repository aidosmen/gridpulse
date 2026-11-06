export type RegionId = 'nordics' | 'dach' | 'uk' | 'iberia' | 'us-ne' | 'us-west' | 'us-gulf';

export type RegionFilter = RegionId | 'all';

export type FacilityType =
  | 'transmission'
  | 'generation'
  | 'storage'
  | 'data-center'
  | 'industrial'
  | 'campus';

export type FacilityStatus = 'nominal' | 'watch' | 'degraded' | 'offline' | 'maintenance';

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export type IncidentStatus = 'open' | 'acknowledged' | 'investigating' | 'resolved';

export type IncidentAction = 'acknowledge' | 'investigate' | 'resolve' | 'reopen';

export type IncidentCategory =
  | 'protection'
  | 'thermal'
  | 'power-quality'
  | 'communications'
  | 'capacity'
  | 'maintenance';

export type Horizon = '24h' | '7d' | '30d';

export interface Facility {
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
  loadMw: number;
  health: number;
  voltageKv: number;
  powerFactor: number;
  commissioned: string;
  operator: string;
}

export interface Asset {
  id: string;
  facilityId: string;
  name: string;
  kind: string;
  status: FacilityStatus;
  temperatureC: number;
  loadPct: number;
}

export interface Incident {
  id: string;
  facilityId: string;
  title: string;
  summary: string;
  severity: Severity;
  status: IncidentStatus;
  category: IncidentCategory;
  openedAt: string;
  updatedAt: string;
  assignee: string;
  resolution?: string;
}

export interface Activity {
  id: string;
  at: string;
  message: string;
  actor: string;
  facilityId: string;
  incidentId?: string;
}

export interface TopologyNode {
  id: string;
  label: string;
  kind: 'hub' | 'facility';
  region: RegionId;
  status: FacilityStatus;
  facilityId?: string;
}

export interface TopologyEdge {
  id: string;
  source: string;
  target: string;
  flowMw: number;
  stressed: boolean;
}

export interface SeriesBundle {
  actual: number[];
  forecast: number[];
}

export interface WorkspaceSnapshot {
  facilities: Facility[];
  assets: Asset[];
  incidents: Incident[];
  activities: Activity[];
  topology: { nodes: TopologyNode[]; edges: TopologyEdge[] };
  series: Record<string, SeriesBundle>;
  timelineStart: string;
}

export interface Preferences {
  loadAlertPct: number;
  healthFloor: number;
  notifyCritical: boolean;
  compact: boolean;
}

export interface IncidentMutation {
  incident: Incident;
  activity: Activity;
}

export interface PulseUpdate {
  facilities: Facility[];
  assets: Asset[];
  tails: Record<string, number>;
}

export const HISTORY_HOURS = 24 * 30;

export const DEFAULT_PREFERENCES: Preferences = {
  loadAlertPct: 86,
  healthFloor: 72,
  notifyCritical: true,
  compact: false,
};

export const OPERATOR = {
  name: 'Amina Rahman',
  role: 'Operations lead',
  initials: 'AR',
};

export const REGION_META = {
  nordics: { label: 'Nordics' },
  dach: { label: 'DACH' },
  uk: { label: 'UK & Ireland' },
  iberia: { label: 'Iberia' },
  'us-ne': { label: 'US Northeast' },
  'us-west': { label: 'US West' },
  'us-gulf': { label: 'US Gulf' },
} as const satisfies Record<RegionId, { label: string }>;

export const TYPE_META = {
  transmission: { label: 'Transmission' },
  generation: { label: 'Generation' },
  storage: { label: 'Storage' },
  'data-center': { label: 'Data center' },
  industrial: { label: 'Industrial' },
  campus: { label: 'Campus' },
} as const satisfies Record<FacilityType, { label: string }>;

export const STATUS_META = {
  nominal: { label: 'Nominal' },
  watch: { label: 'Watch' },
  degraded: { label: 'Degraded' },
  offline: { label: 'Offline' },
  maintenance: { label: 'Maintenance' },
} as const satisfies Record<FacilityStatus, { label: string }>;

export const SEVERITY_META = {
  critical: { label: 'Critical' },
  high: { label: 'High' },
  medium: { label: 'Medium' },
  low: { label: 'Low' },
} as const satisfies Record<Severity, { label: string }>;

export const INCIDENT_STATUS_META = {
  open: { label: 'Open' },
  acknowledged: { label: 'Acknowledged' },
  investigating: { label: 'Investigating' },
  resolved: { label: 'Resolved' },
} as const satisfies Record<IncidentStatus, { label: string }>;

export const CATEGORY_META = {
  protection: { label: 'Protection' },
  thermal: { label: 'Thermal' },
  'power-quality': { label: 'Power quality' },
  communications: { label: 'Communications' },
  capacity: { label: 'Capacity' },
  maintenance: { label: 'Maintenance' },
} as const satisfies Record<IncidentCategory, { label: string }>;

export const REGION_OPTIONS = (Object.keys(REGION_META) as RegionId[]).map((id) => ({
  id,
  label: REGION_META[id].label,
}));

export const TYPE_OPTIONS = (Object.keys(TYPE_META) as FacilityType[]).map((id) => ({
  id,
  label: TYPE_META[id].label,
}));

export const STATUS_OPTIONS = (Object.keys(STATUS_META) as FacilityStatus[]).map((id) => ({
  id,
  label: STATUS_META[id].label,
}));
