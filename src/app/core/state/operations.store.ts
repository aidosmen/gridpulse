import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval, Observable, EMPTY } from 'rxjs';
import { catchError, filter, finalize, switchMap, tap } from 'rxjs/operators';
import { GridApiService } from '../api/grid-api.service';
import { demandDelta, isAlerting, presentFacility, sumLoad, summarize } from '../domain/operations';
import { projectTopology } from '../domain/topology';
import {
  Activity,
  Asset,
  Facility,
  Incident,
  IncidentAction,
  IncidentMutation,
  SeriesBundle,
  TopologyEdge,
  TopologyNode,
} from '../models/domain';
import { PreferencesStore } from './preferences.store';
import { ToastService } from './toast.service';
import { WorkspaceStore } from './workspace.store';

@Injectable({ providedIn: 'root' })
export class OperationsStore {
  private readonly api = inject(GridApiService);
  private readonly messages = inject(ToastService);
  private readonly preferences = inject(PreferencesStore);
  private readonly workspace = inject(WorkspaceStore);
  private readonly announced = new Set<string>();
  private primed = false;
  private epoch = 0;
  private pulseErrorShown = false;

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly pendingIds = signal<ReadonlySet<string>>(new Set());
  readonly facilities = signal<Facility[]>([]);
  readonly assets = signal<Asset[]>([]);
  readonly incidents = signal<Incident[]>([]);
  readonly activities = signal<Activity[]>([]);
  readonly topology = signal<{ nodes: TopologyNode[]; edges: TopologyEdge[] }>({ nodes: [], edges: [] });
  readonly series = signal<Record<string, SeriesBundle>>({});
  readonly timelineStart = signal('');

  readonly facilitiesView = computed(() =>
    this.facilities().map((facility) => presentFacility(facility, this.preferences.snapshot())),
  );

  readonly visibleFacilities = computed(() => {
    const region = this.workspace.region();
    const facilities = this.facilitiesView();
    return region === 'all' ? facilities : facilities.filter((facility) => facility.region === region);
  });

  readonly topologyView = computed(() => projectTopology(this.facilitiesView()));

  readonly visibleIncidents = computed(() => {
    const ids = new Set(this.visibleFacilities().map((facility) => facility.id));
    return this.incidents().filter((incident) => ids.has(incident.facilityId));
  });

  readonly summary = computed(() => {
    const facilities = this.visibleFacilities();
    const hourly = sumLoad(this.series(), facilities);
    return summarize(facilities, this.visibleIncidents(), this.preferences.snapshot(), demandDelta(hourly));
  });

  constructor() {
    this.load();
    interval(6000)
      .pipe(
        filter(() => !this.loading() && !this.error()),
        switchMap(() => {
          const epoch = this.epoch;
          return this.api.pulse().pipe(
            catchError((error: unknown) => {
              this.notePulseFailure(error);
              return EMPTY;
            }),
            filter(() => epoch === this.epoch),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((update) => {
        this.pulseErrorShown = false;
        this.watchThresholds(update.facilities);
        this.facilities.set(update.facilities);
        this.assets.set(update.assets);
        this.series.update((current) => {
          const next = { ...current };
          for (const [id, load] of Object.entries(update.tails)) {
            const bundle = next[id];
            if (!bundle) {
              continue;
            }
            const actual = bundle.actual.slice();
            actual[actual.length - 1] = load;
            next[id] = { ...bundle, actual };
          }
          return next;
        });
      });
  }

  load(): void {
    const epoch = ++this.epoch;
    this.loading.set(true);
    this.error.set(null);
    this.api.bootstrap().subscribe({
      next: (snapshot) => {
        if (epoch !== this.epoch) {
          return;
        }
        this.facilities.set(snapshot.facilities);
        this.assets.set(snapshot.assets);
        this.incidents.set(snapshot.incidents);
        this.activities.set(snapshot.activities);
        this.topology.set(snapshot.topology);
        this.series.set(snapshot.series);
        this.timelineStart.set(snapshot.timelineStart);
        this.primeAnnounced(snapshot.facilities);
        this.loading.set(false);
      },
      error: () => {
        if (epoch !== this.epoch) {
          return;
        }
        this.error.set('The operations feed did not respond.');
        this.loading.set(false);
      },
    });
  }

  facility(id: string): Facility | undefined {
    return this.facilitiesView().find((item) => item.id === id);
  }

  acknowledge(id: string): void {
    this.transition(id, 'acknowledge').subscribe();
  }

  investigate(id: string): void {
    this.transition(id, 'investigate').subscribe();
  }

  resolve(id: string, note: string): Observable<IncidentMutation> {
    return this.transition(id, 'resolve', note);
  }

  reopen(id: string): void {
    this.transition(id, 'reopen').subscribe();
  }

  logInspection(facilityId: string, note: string): Observable<{ activity: Activity }> {
    if (this.pendingIds().has(facilityId)) {
      this.messages.add({
        severity: 'warn',
        summary: 'Still applying',
        detail: 'Wait for the current update on this site to finish.',
        life: 2800,
      });
      return EMPTY;
    }
    this.markPending(facilityId, true);
    return this.api.logInspection(facilityId, note).pipe(
      tap(({ activity }) => {
        this.activities.update((items) => [activity, ...items]);
        this.messages.add({
          severity: 'success',
          summary: 'Inspection logged',
          detail: activity.message,
          life: 3600,
        });
      }),
      catchError((error: unknown) => {
        this.fail(error);
        return EMPTY;
      }),
      finalize(() => this.markPending(facilityId, false)),
    );
  }

  private transition(id: string, action: IncidentAction, note?: string): Observable<IncidentMutation> {
    if (this.pendingIds().has(id)) {
      this.messages.add({
        severity: 'warn',
        summary: 'Still applying',
        detail: 'Wait for the current update on this incident to finish.',
        life: 2800,
      });
      return EMPTY;
    }
    this.markPending(id, true);
    return this.api.transition(id, action, note).pipe(
      tap(({ incident, activity }) => {
        this.incidents.update((items) => items.map((item) => (item.id === incident.id ? incident : item)));
        this.activities.update((items) => [activity, ...items]);
        this.messages.add({
          severity: 'success',
          summary: incident.id,
          detail: activity.message,
          life: 3400,
        });
      }),
      catchError((error: unknown) => {
        this.fail(error);
        return EMPTY;
      }),
      finalize(() => this.markPending(id, false)),
    );
  }

  private markPending(id: string, pending: boolean): void {
    this.pendingIds.update((ids) => {
      const next = new Set(ids);
      if (pending) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  private notePulseFailure(error: unknown): void {
    if (this.pulseErrorShown) {
      return;
    }
    this.pulseErrorShown = true;
    this.fail(error);
  }

  private primeAnnounced(facilities: Facility[]): void {
    this.announced.clear();
    const preferences = this.preferences.snapshot();
    for (const facility of facilities) {
      if (isAlerting(facility, preferences)) {
        this.announced.add(facility.id);
      }
    }
    this.primed = true;
  }

  private watchThresholds(facilities: Facility[]): void {
    if (!this.primed || !this.preferences.notifyCritical()) {
      return;
    }
    const preferences = this.preferences.snapshot();
    for (const facility of facilities) {
      const alerting = isAlerting(facility, preferences);
      if (alerting && !this.announced.has(facility.id)) {
        this.announced.add(facility.id);
        this.messages.add({
          severity: 'warn',
          summary: 'Threshold crossed',
          detail: `${facility.name} moved outside the operating envelope.`,
          life: 4200,
        });
      }
      if (!alerting) {
        this.announced.delete(facility.id);
      }
    }
  }

  private fail(error: unknown): void {
    const detail =
      error instanceof HttpErrorResponse && typeof error.error?.message === 'string'
        ? error.error.message
        : 'The operation did not complete.';
    this.messages.add({ severity: 'error', summary: 'Not applied', detail, life: 4200 });
  }
}
