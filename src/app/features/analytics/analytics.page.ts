import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { regionEnergy, windowSeries } from '../../core/domain/operations';
import { formatMw, formatNumber, formatPct } from '../../core/domain/format';
import { REGION_META, STATUS_META } from '../../core/models/domain';
import { OperationsStore } from '../../core/state/operations.store';
import { WorkspaceStore } from '../../core/state/workspace.store';
import { compareChart, regionChart } from '../../shared/charts/chart-options';
import { ChartComponent } from '../../shared/charts/chart.component';
import { PanelComponent } from '../../shared/ui/panel.component';
import { StatusPillComponent } from '../../shared/ui/status-pill.component';

@Component({
  selector: 'app-analytics',
  imports: [PanelComponent, ChartComponent, StatusPillComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.loading()) {
      <div class="grid gap-4 xl:grid-cols-2">
        <div class="panel h-80 animate-pulse"></div>
        <div class="panel h-80 animate-pulse"></div>
      </div>
    } @else {
      <section class="grid gap-4 xl:grid-cols-5">
        <app-panel class="xl:col-span-3" kicker="Energy" [title]="'Delivered energy · ' + workspace.horizon()">
          <div class="h-80">
            <app-chart [options]="regions()" />
          </div>
        </app-panel>
        <app-panel class="xl:col-span-2" kicker="Intensity" title="Highest utilization">
          <ol class="space-y-3">
            @for (row of ranking(); track row.id; let index = $index) {
              <li class="flex items-center gap-3">
                <span class="font-mono text-xs text-muted">{{ index + 1 }}</span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm">{{ row.name }}</span>
                  <span class="meter mt-1"><span [style.width.%]="row.utilization"></span></span>
                </span>
                <span class="font-mono text-sm">{{ formatPct(row.utilization, 0) }}</span>
              </li>
            }
          </ol>
        </app-panel>
      </section>

      <section class="mt-4">
        <app-panel kicker="Compare" title="Two sites, same horizon">
          <div panel-actions class="flex flex-wrap gap-2">
            <label class="field">
              <span>Left</span>
              <select [value]="leftId()" (change)="onLeft($event)">
                @for (facility of store.visibleFacilities(); track facility.id) {
                  <option [value]="facility.id">{{ facility.name }}</option>
                }
              </select>
            </label>
            <label class="field">
              <span>Right</span>
              <select [value]="rightId()" (change)="onRight($event)">
                @for (facility of store.visibleFacilities(); track facility.id) {
                  <option [value]="facility.id">{{ facility.name }}</option>
                }
              </select>
            </label>
          </div>
          <div class="h-80">
            <app-chart [options]="comparison()" />
          </div>
          @if (left() && right()) {
            <div class="mt-4 grid gap-3 md:grid-cols-2">
              <article class="stat">
                <div class="flex items-center justify-between">
                  <p class="text-sm font-medium">{{ left()!.name }}</p>
                  <app-status-pill [label]="STATUS_META[left()!.status].label" [tone]="left()!.status" />
                </div>
                <p class="mt-2 font-mono text-lg">{{ formatMw(left()!.loadMw) }}</p>
                <p class="text-xs text-muted">Health {{ left()!.health }} · {{ formatNumber(left()!.powerFactor, 2) }} pf</p>
              </article>
              <article class="stat">
                <div class="flex items-center justify-between">
                  <p class="text-sm font-medium">{{ right()!.name }}</p>
                  <app-status-pill [label]="STATUS_META[right()!.status].label" [tone]="right()!.status" />
                </div>
                <p class="mt-2 font-mono text-lg">{{ formatMw(right()!.loadMw) }}</p>
                <p class="text-xs text-muted">Health {{ right()!.health }} · {{ formatNumber(right()!.powerFactor, 2) }} pf</p>
              </article>
            </div>
          }
        </app-panel>
      </section>
    }
  `,
})
export class AnalyticsPage {
  readonly store = inject(OperationsStore);
  readonly workspace = inject(WorkspaceStore);
  readonly formatMw = formatMw;
  readonly formatPct = formatPct;
  readonly formatNumber = formatNumber;
  readonly STATUS_META = STATUS_META;
  readonly leftId = signal('aurora');
  readonly rightId = signal('gulf');

  readonly ranking = computed(() =>
    this.store
      .visibleFacilities()
      .map((facility) => ({
        id: facility.id,
        name: facility.name,
        utilization: facility.capacityMw === 0 ? 0 : (facility.loadMw / facility.capacityMw) * 100,
      }))
      .sort((left, right) => right.utilization - left.utilization)
      .slice(0, 6),
  );

  readonly regions = computed(() => {
    const rows = regionEnergy(this.store.visibleFacilities(), this.store.series(), this.workspace.horizon());
    return regionChart(
      rows.map((row) => REGION_META[row.region].label),
      rows.map((row) => row.mwh),
    );
  });

  readonly left = computed(() => this.store.visibleFacilities().find((facility) => facility.id === this.leftId()) ?? null);
  readonly right = computed(() => this.store.visibleFacilities().find((facility) => facility.id === this.rightId()) ?? null);

  readonly comparison = computed(() => {
    const start = this.store.timelineStart();
    const horizon = this.workspace.horizon();
    const left = this.left();
    const right = this.right();
    const leftSeries = windowSeries(this.store.series()[left?.id ?? '']?.actual ?? [], horizon, start);
    const rightSeries = windowSeries(this.store.series()[right?.id ?? '']?.actual ?? [], horizon, start);
    return compareChart(leftSeries.labels, leftSeries.values, rightSeries.values, left?.name ?? 'Left', right?.name ?? 'Right');
  });

  constructor() {
    effect(() => {
      const ids = this.store.visibleFacilities().map((facility) => facility.id);
      const left = this.leftId();
      const right = this.rightId();
      const nextLeft = ids.includes(left) ? left : (ids[0] ?? '');
      const nextRight = ids.includes(right) && right !== nextLeft ? right : (ids.find((id) => id !== nextLeft) ?? nextLeft);
      if (nextLeft !== left) {
        this.leftId.set(nextLeft);
      }
      if (nextRight !== right) {
        this.rightId.set(nextRight);
      }
    });
  }

  onLeft(event: Event): void {
    this.leftId.set((event.target as HTMLSelectElement).value);
  }

  onRight(event: Event): void {
    this.rightId.set((event.target as HTMLSelectElement).value);
  }
}
