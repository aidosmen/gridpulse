import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MIN_NOTE_LENGTH, windowSeries } from '../../core/domain/operations';
import { formatMw, formatNumber, formatPct, formatRelative, formatTimestamp } from '../../core/domain/format';
import {
  CATEGORY_META,
  INCIDENT_STATUS_META,
  REGION_META,
  SEVERITY_META,
  STATUS_META,
  TYPE_META,
} from '../../core/models/domain';
import { OperationsStore } from '../../core/state/operations.store';
import { WorkspaceStore } from '../../core/state/workspace.store';
import { loadChart } from '../../shared/charts/chart-options';
import { ChartComponent } from '../../shared/charts/chart.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { IconComponent } from '../../shared/ui/icon.component';
import { PanelComponent } from '../../shared/ui/panel.component';
import { StatusPillComponent } from '../../shared/ui/status-pill.component';

@Component({
  selector: 'app-facility-detail',
  imports: [
    RouterLink,
    ChartComponent,
    PanelComponent,
    StatusPillComponent,
    EmptyStateComponent,
    IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.loading()) {
      <div class="panel h-96 animate-pulse"></div>
    } @else if (!facility()) {
      <app-empty-state
        icon="building"
        title="Facility not on this grid"
        message="That site id is not in the current operating snapshot."
        action="Back to infrastructure"
        (acted)="back()"
      />
    } @else {
      <a routerLink="/infrastructure" class="back-link"><app-icon name="chevron-left" /> Infrastructure</a>
      <header class="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="kicker">{{ facility()!.code }} · {{ TYPE_META[facility()!.type].label }}</p>
          <h2 class="font-display text-3xl tracking-tight">{{ facility()!.name }}</h2>
          <p class="mt-2 text-sm text-muted">
            {{ facility()!.city }}, {{ facility()!.country }} · {{ REGION_META[facility()!.region].label }} ·
            {{ facility()!.operator }}
          </p>
        </div>
        <app-status-pill [label]="STATUS_META[facility()!.status].label" [tone]="facility()!.status" />
      </header>

      <section class="mt-5 grid gap-3 md:grid-cols-4">
        <article class="stat">
          <p class="kicker">Load</p>
          <p class="stat-value">{{ formatMw(facility()!.loadMw) }}</p>
          <p class="text-xs text-muted">of {{ formatMw(facility()!.capacityMw) }}</p>
        </article>
        <article class="stat">
          <p class="kicker">Utilization</p>
          <p class="stat-value">{{ formatPct(utilization(), 1) }}</p>
          <p class="text-xs text-muted">{{ facility()!.voltageKv }} kV service</p>
        </article>
        <article class="stat">
          <p class="kicker">Health</p>
          <p class="stat-value">{{ facility()!.health }}</p>
          <p class="text-xs text-muted">Power factor {{ formatNumber(facility()!.powerFactor, 2) }}</p>
        </article>
        <article class="stat">
          <p class="kicker">Commissioned</p>
          <p class="stat-value text-2xl">{{ facility()!.commissioned.slice(0, 4) }}</p>
          <p class="text-xs text-muted">{{ assets().length }} monitored assets</p>
        </article>
      </section>

      <section class="mt-4 grid gap-4 xl:grid-cols-5">
        <app-panel class="xl:col-span-3" kicker="Charts" [title]="'Site load · ' + workspace.horizon()">
          <div class="h-72">
            <app-chart [options]="chart()" />
          </div>
        </app-panel>
        <app-panel class="xl:col-span-2" kicker="Work" title="Open incidents">
          <ul class="space-y-2">
            @for (incident of incidents(); track incident.id) {
              <li>
                <a class="queue-row" [routerLink]="['/incidents']" [queryParams]="{ id: incident.id }">
                  <span class="flex items-center justify-between gap-2">
                    <span class="text-sm font-medium">{{ incident.title }}</span>
                    <app-status-pill [label]="SEVERITY_META[incident.severity].label" [tone]="incident.severity" />
                  </span>
                  <span class="mt-1 block text-xs text-muted">
                    {{ incident.id }} · {{ INCIDENT_STATUS_META[incident.status].label }} ·
                    {{ CATEGORY_META[incident.category].label }}
                  </span>
                </a>
              </li>
            } @empty {
              <li class="text-sm text-muted">No open incidents at this site.</li>
            }
          </ul>
        </app-panel>
      </section>

      <section class="mt-4 grid gap-4 xl:grid-cols-5">
        <div class="panel overflow-hidden xl:col-span-3">
          <header class="border-b border-line px-4 py-3">
            <p class="kicker">Register</p>
            <h2 class="font-display text-base font-semibold">Assets</h2>
          </header>
          <table class="gp-table">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Kind</th>
                <th>Temp</th>
                <th>Load</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              @for (asset of assets(); track asset.id) {
                <tr>
                  <td>{{ asset.name }}</td>
                  <td>{{ asset.kind }}</td>
                  <td class="font-mono">{{ asset.temperatureC }}°C</td>
                  <td class="font-mono">{{ asset.loadPct }}%</td>
                  <td><app-status-pill [label]="statusLabel(asset.status)" [tone]="asset.status" /></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <app-panel class="xl:col-span-2" kicker="Record" title="Activity">
          <form class="mb-4" (submit)="submitInspection($event)">
            <label class="field w-full">
              <span>Log inspection</span>
              <textarea rows="3" [value]="note()" (input)="onNote($event)" placeholder="What was checked, and what remains?"></textarea>
            </label>
            @if (noteError()) {
              <p class="mt-2 text-sm text-rose">{{ noteError() }}</p>
            }
            <button class="btn btn-primary mt-3" type="submit" [disabled]="store.pendingIds().has(facilityId())">
              Save inspection
            </button>
          </form>
          <ol class="space-y-3">
            @for (item of activity(); track item.id) {
              <li class="border-l border-line pl-3">
                <p class="text-sm">{{ item.message }}</p>
                <p class="text-xs text-muted">{{ item.actor }} · {{ formatTimestamp(item.at) }} · {{ formatRelative(item.at) }}</p>
              </li>
            }
          </ol>
        </app-panel>
      </section>
    }
  `,
})
export class FacilityDetailPage {
  readonly facilityId = input.required<string>();
  readonly store = inject(OperationsStore);
  private readonly router = inject(Router);
  readonly workspace = inject(WorkspaceStore);
  readonly TYPE_META = TYPE_META;
  readonly REGION_META = REGION_META;
  readonly STATUS_META = STATUS_META;
  readonly SEVERITY_META = SEVERITY_META;
  readonly INCIDENT_STATUS_META = INCIDENT_STATUS_META;
  readonly CATEGORY_META = CATEGORY_META;
  readonly formatMw = formatMw;
  readonly formatPct = formatPct;
  readonly formatNumber = formatNumber;
  readonly formatRelative = formatRelative;
  readonly formatTimestamp = formatTimestamp;
  readonly note = signal('');
  readonly noteError = signal('');

  readonly facility = computed(() => this.store.facility(this.facilityId()));

  readonly assets = computed(() => this.store.assets().filter((asset) => asset.facilityId === this.facilityId()));

  readonly incidents = computed(() =>
    this.store.incidents().filter((incident) => incident.facilityId === this.facilityId() && incident.status !== 'resolved'),
  );

  readonly activity = computed(() =>
    this.store.activities().filter((item) => item.facilityId === this.facilityId()).slice(0, 8),
  );

  readonly chart = computed(() => {
    const bundle = this.store.series()[this.facilityId()];
    const start = this.store.timelineStart();
    const horizon = this.workspace.horizon();
    const actual = bundle?.actual ?? [];
    const forecast = bundle?.forecast ?? [];
    return loadChart(windowSeries(actual, horizon, start), windowSeries(forecast, horizon, start));
  });

  statusLabel(status: string): string {
    return STATUS_META[status as keyof typeof STATUS_META].label;
  }

  utilization(): number {
    const facility = this.facility();
    if (!facility || facility.capacityMw === 0) {
      return 0;
    }
    return (facility.loadMw / facility.capacityMw) * 100;
  }

  onNote(event: Event): void {
    this.note.set((event.target as HTMLTextAreaElement).value);
    this.noteError.set('');
  }

  submitInspection(event: Event): void {
    event.preventDefault();
    const note = this.note().trim();
    if (note.length < MIN_NOTE_LENGTH) {
      this.noteError.set('Write at least 8 characters so the record is useful.');
      return;
    }
    this.store.logInspection(this.facilityId(), note).subscribe({
      next: () => {
        this.note.set('');
        this.noteError.set('');
      },
    });
  }

  back(): void {
    void this.router.navigate(['/infrastructure']);
  }
}
