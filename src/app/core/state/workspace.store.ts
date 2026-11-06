import { Injectable, effect, signal } from '@angular/core';
import { Horizon, RegionFilter } from '../models/domain';

const STORAGE_KEY = 'gridpulse.workspace.v1';

@Injectable({ providedIn: 'root' })
export class WorkspaceStore {
  readonly region = signal<RegionFilter>('all');
  readonly horizon = signal<Horizon>('24h');

  constructor() {
    const stored = readWorkspace();
    if (stored) {
      this.region.set(stored.region);
      this.horizon.set(stored.horizon);
    }
    effect(() => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ region: this.region(), horizon: this.horizon() }),
      );
    });
  }
}

function readWorkspace(): { region: RegionFilter; horizon: Horizon } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    const value = parsed as { region?: RegionFilter; horizon?: Horizon };
    const regions: RegionFilter[] = ['all', 'nordics', 'dach', 'uk', 'iberia', 'us-ne', 'us-west', 'us-gulf'];
    const horizons: Horizon[] = ['24h', '7d', '30d'];
    if (!value.region || !value.horizon || !regions.includes(value.region) || !horizons.includes(value.horizon)) {
      return null;
    }
    return { region: value.region, horizon: value.horizon };
  } catch {
    return null;
  }
}
