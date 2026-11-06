import { Injectable, computed, effect, signal } from '@angular/core';
import { DEFAULT_PREFERENCES, Preferences } from '../models/domain';

const STORAGE_KEY = 'gridpulse.preferences.v1';

@Injectable({ providedIn: 'root' })
export class PreferencesStore {
  readonly loadAlertPct = signal(DEFAULT_PREFERENCES.loadAlertPct);
  readonly healthFloor = signal(DEFAULT_PREFERENCES.healthFloor);
  readonly notifyCritical = signal(DEFAULT_PREFERENCES.notifyCritical);
  readonly compact = signal(DEFAULT_PREFERENCES.compact);

  readonly snapshot = computed<Preferences>(() => ({
    loadAlertPct: this.loadAlertPct(),
    healthFloor: this.healthFloor(),
    notifyCritical: this.notifyCritical(),
    compact: this.compact(),
  }));

  constructor() {
    const stored = readPreferences();
    if (stored) {
      this.loadAlertPct.set(stored.loadAlertPct);
      this.healthFloor.set(stored.healthFloor);
      this.notifyCritical.set(stored.notifyCritical);
      this.compact.set(stored.compact);
    }

    effect(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.snapshot()));
    });
  }

  setLoadAlert(value: number): void {
    this.loadAlertPct.set(clamp(Math.round(value), 70, 98));
  }

  setHealthFloor(value: number): void {
    this.healthFloor.set(clamp(Math.round(value), 40, 95));
  }
}

function readPreferences(): Preferences | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    const value = parsed as Partial<Preferences>;
    if (
      typeof value.loadAlertPct !== 'number' ||
      typeof value.healthFloor !== 'number' ||
      typeof value.notifyCritical !== 'boolean' ||
      typeof value.compact !== 'boolean'
    ) {
      return null;
    }
    return {
      loadAlertPct: clamp(value.loadAlertPct, 70, 98),
      healthFloor: clamp(value.healthFloor, 40, 95),
      notifyCritical: value.notifyCritical,
      compact: value.compact,
    };
  } catch {
    return null;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
