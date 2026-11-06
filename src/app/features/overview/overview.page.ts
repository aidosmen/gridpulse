import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { demandDelta, sumLoad, windowSeries } from '../../core/domain/operations';
import { formatMw, formatNumber, formatPct, formatRelative, formatSignedPct } from '../../core/domain/format';
import {
  Facility,
  INCIDENT_STATUS_META,
  REGION_META,
  SEVERITY_META,
  STATUS_META,
} from '../../core/models/domain';
import { OperationsStore } from '../../core/state/operations.store';
import { WorkspaceStore } from '../../core/state/workspace.store';
import { loadChart } from '../../shared/charts/chart-options';
import { ChartComponent } from '../../shared/charts/chart.component';
import { KpiCardComponent } from '../../shared/ui/kpi-card.component';
import { PanelComponent } from '../../shared/ui/panel.component';
import { StatusPillComponent } from '../../shared/ui/status-pill.component';
import { FacilityMapComponent } from './facility-map.component';

@Component({
  selector: 'app-overview',
  imports: [KpiCardComponent, PanelComponent, ChartComponent, StatusPillComponent, FacilityMapComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.loading()) {
      <div class="grid gap-4 md:grid-cols-4">
        @for (item of [1, 2, 3, 4]; track item) {
          <div class="panel h-32 animate-pulse"></div>
        }
      </div>
    } @else {
      <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <app-kpi-card
          testId="kpi-demand"
          label="System demand"
          icon="zap"
          [value]="formatMw(summary().demandMw)"
          [hint]="demandHint()"
        />
        <app-kpi-card
          label="Reserve margin"
          icon="gauge"
          [value]="formatPct(summary().reservePct, 1)"
          [hint]="formatMw(summary().capacityMw - summary().demandMw) + ' of headroom'"
        />
        <app-kpi-card
          label="Health index"
          icon="activity"
          [value]="formatNumber(summary().health, 0)"
          hint="Average site health across the selected region"
        />
        <app-kpi-card
          label="Open critical"
          icon="siren"
          [value]="summary().criticalIncidents.toString()"
          [hint]="summary().openIncidents + ' open incidents · ' + summary().alertingFacilities + ' sites alerting'"
        />
      </section>

      <section class="mt-4 grid gap-4 xl:grid-cols-12">
        <app-panel class="xl:col-span-8" kicker="Charts" [title]="'Demand against forecast · ' + workspace.horizon()">
          <div class="h-80">
            <app-chart [options]="loadOptions()" />
          </div>
        </app-panel>
        <app-panel class="xl:col-span-4" kicker="Queue" title="Needs attention">
          <ul class="space-y-2">
            @for (incident of attention(); track incident.id) {
              <li>
                <button type="button" class="queue-row" (click)="openIncident(incident.id)">
                  <span class="flex items-center justify-between gap-2">
                    <span class="text-sm font-medium">{{ incident.title }}</span>
                    <app-status-pill [label]="SEVERITY_META[incident.severity].label" [tone]="incident.severity" />
                  </span>
                  <span class="mt-1 block text-xs text-muted">
                    {{ incident.id }} · {{ INCIDENT_STATUS_META[incident.status].label }} ·
                    {{ formatRelative(incident.updatedAt) }}
                  </span>
                </button>
              </li>
            } @empty {
              <li class="text-sm text-muted">No open incidents in this region.</li>
            }
          </ul>
        </app-panel>
      </section>

      <section class="mt-4 grid gap-4 xl:grid-cols-12">
        <app-panel class="instrument xl:col-span-7" kicker="Geography" title="Live facility posture">
          <div class="h-[440px] overflow-hidden rounded-2xl">
            <app-facility-map [facilities]="store.visibleFacilities()" (selected)="openFacility($event)" />
          </div>
        </app-panel>
        <app-panel class="xl:col-span-5" kicker="Condition" title="Lowest health">
          <ul class="space-y-3">
            @for (facility of weakest(); track facility.id) {
              <li>
                <button type="button" class="health-row" (click)="openFacility(facility)">
                  <span>
                    <span class="block text-sm font-medium">{{ facility.name }}</span>
                    <span class="text-xs text-muted">{{ facility.city }} · {{ REGION_META[facility.region].label }}</span>
                  </span>
                  <span class="flex items-center gap-3">
                    <span class="font-mono text-sm">{{ facility.health }}</span>
                    <app-status-pill [label]="STATUS_META[facility.status].label" [tone]="facility.status" />
                  </span>
                </button>
              </li>
            }
          </ul>
        </app-panel>
      </section>
    }
  `,
})
export class OverviewPage {
  readonly store = inject(OperationsStore);
  private readonly workspace = inject(WorkspaceStore);
  private readonly router = inject(Router);
  readonly SEVERITY_META = SEVERITY_META;
  readonly INCIDENT_STATUS_META = INCIDENT_STATUS_META;
  readonly STATUS_META = STATUS_META;
  readonly REGION_META = REGION_META;
  readonly formatMw = formatMw;
  readonly formatPct = formatPct;
  readonly formatNumber = formatNumber;
  readonly formatRelative = formatRelative;

  readonly summary = this.store.summary;

  readonly attention = computed(() =>
    this.store
      .visibleIncidents()
      .filter((incident) => incident.status !== 'resolved')
      .slice()
      .sort((left, right) => rank(right.severity) - rank(left.severity) || right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, 5),
  );

  readonly weakest = computed(() =>
    this.store
      .visibleFacilities()
      .slice()
      .sort((left, right) => left.health - right.health)
      .slice(0, 6),
  );

  readonly loadOptions = computed(() => {
    const facilities = this.store.visibleFacilities();
    const hourly = sumLoad(this.store.series(), facilities);
    const forecastHourly = facilities.reduce((totals, facility) => {
      const forecast = this.store.series()[facility.id]?.forecast ?? [];
      forecast.forEach((value, index) => {
        totals[index] = (totals[index] ?? 0) + value;
      });
      return totals;
    }, Array.from({ length: hourly.length }, () => 0));
    const start = this.store.timelineStart();
    const horizon = this.workspace.horizon();
    return loadChart(windowSeries(hourly, horizon, start), windowSeries(forecastHourly, horizon, start));
  });

  demandHint(): string {
    const delta = demandDelta(sumLoad(this.store.series(), this.store.visibleFacilities()));
    return `${formatSignedPct(delta)} versus the same hour yesterday`;
  }

  openIncident(id: string): void {
    void this.router.navigate(['/incidents'], { queryParams: { id } });
  }

  openFacility(facility: Facility): void {
    void this.router.navigate(['/infrastructure', facility.id]);
  }
}

function rank(severity: string): number {
  return { low: 0, medium: 1, high: 2, critical: 3 }[severity] ?? 0;
}
