import { Facility, FacilityStatus, RegionId, TopologyEdge, TopologyNode } from '../models/domain';
import { round1 } from './operations';

const HUBS: { id: string; label: string; region: RegionId }[] = [
  { id: 'hub-nordics', label: 'Nordic hub', region: 'nordics' },
  { id: 'hub-dach', label: 'Rhine hub', region: 'dach' },
  { id: 'hub-uk', label: 'Thames hub', region: 'uk' },
  { id: 'hub-iberia', label: 'Iberian hub', region: 'iberia' },
  { id: 'hub-us-ne', label: 'Atlantic hub', region: 'us-ne' },
  { id: 'hub-us-west', label: 'Pacific hub', region: 'us-west' },
  { id: 'hub-us-gulf', label: 'Gulf hub', region: 'us-gulf' },
];

const BACKBONE: [RegionId, RegionId][] = [
  ['nordics', 'dach'],
  ['dach', 'uk'],
  ['uk', 'iberia'],
  ['dach', 'us-ne'],
  ['us-ne', 'us-gulf'],
  ['us-gulf', 'us-west'],
];

const STATUS_RANK: FacilityStatus[] = ['nominal', 'maintenance', 'watch', 'degraded', 'offline'];

export function projectTopology(facilities: readonly Facility[]): { nodes: TopologyNode[]; edges: TopologyEdge[] } {
  const nodes: TopologyNode[] = HUBS.map((hub) => ({
    id: hub.id,
    label: hub.label,
    kind: 'hub',
    region: hub.region,
    status: worstStatus(facilities.filter((facility) => facility.region === hub.region).map((facility) => facility.status)),
  }));
  const edges: TopologyEdge[] = [];

  for (const facility of facilities) {
    nodes.push({
      id: facility.id,
      label: facility.name,
      kind: 'facility',
      region: facility.region,
      status: facility.status,
      facilityId: facility.id,
    });
    edges.push({
      id: `edge-${facility.id}`,
      source: `hub-${facility.region}`,
      target: facility.id,
      flowMw: round1(facility.loadMw),
      stressed: facility.status === 'degraded' || facility.status === 'offline',
    });
  }

  for (const [left, right] of BACKBONE) {
    const flow = facilities
      .filter((facility) => facility.region === left || facility.region === right)
      .reduce((sum, facility) => sum + facility.loadMw, 0);
    const stressed = nodes.some(
      (node) =>
        node.kind === 'hub' &&
        (node.region === left || node.region === right) &&
        (node.status === 'degraded' || node.status === 'offline'),
    );
    edges.push({
      id: `backbone-${left}-${right}`,
      source: `hub-${left}`,
      target: `hub-${right}`,
      flowMw: round1(flow * 0.18),
      stressed,
    });
  }

  return { nodes, edges };
}

function worstStatus(statuses: FacilityStatus[]): FacilityStatus {
  return statuses.reduce<FacilityStatus>(
    (current, next) => (STATUS_RANK.indexOf(next) > STATUS_RANK.indexOf(current) ? next : current),
    'nominal',
  );
}
