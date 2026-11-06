import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { filterFacilities } from '../../core/domain/operations';
import { formatMw, formatNumber } from '../../core/domain/format';
import {
  FacilityStatus,
  FacilityType,
  REGION_META,
  STATUS_META,
  STATUS_OPTIONS,
  TYPE_META,
  TYPE_OPTIONS,
} from '../../core/models/domain';
import { OperationsStore } from '../../core/state/operations.store';
import { PreferencesStore } from '../../core/state/preferences.store';
import { WorkspaceStore } from '../../core/state/workspace.store';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { StatusPillComponent } from '../../shared/ui/status-pill.component';

@Component({
  selector: 'app-infrastructure',
  imports: [RouterLink, StatusPillComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.loading()) {
      <div class="panel h-96 animate-pulse"></div>
    } @else {
      <div class="mb-4 flex flex-wrap items-end gap-3">
        <label class="field">
          <span>Search</span>
          <input data-testid="facility-search" type="search" [value]="text()" (input)="onText($event)" placeholder="Name, code, city" />
        </label>
        <label class="field">
          <span>Type</span>
          <select [value]="type()" (change)="onType($event)">
            <option value="all">All types</option>
            @for (option of types; track option.id) {
              <option [value]="option.id">{{ option.label }}</option>
            }
          </select>
        </label>
        <label class="field">
          <span>Status</span>
          <select [value]="status()" (change)="onStatus($event)">
            <option value="all">All statuses</option>
            @for (option of statuses; track option.id) {
              <option [value]="option.id">{{ option.label }}</option>
            }
          </select>
        </label>
        <label class="check-field">
          <input type="checkbox" [checked]="alertingOnly()" (change)="onAlerting($event)" />
          Alerting only
        </label>
        <p class="ml-auto text-sm text-muted">{{ rows().length }} sites</p>
      </div>

      @if (rows().length === 0) {
        <app-empty-state
          icon="funnel"
          title="No facilities match"
          message="The current region, type, status, or search does not match any site. Clear the local filters to see the portfolio again."
          action="Clear filters"
          (acted)="clear()"
        />
      } @else {
        <div class="panel overflow-hidden">
          <table class="gp-table">
            <thead>
              <tr>
                <th><button type="button" (click)="sortBy('name')">Facility {{ marker('name') }}</button></th>
                <th><button type="button" (click)="sortBy('region')">Region {{ marker('region') }}</button></th>
                <th><button type="button" (click)="sortBy('type')">Type {{ marker('type') }}</button></th>
                <th><button type="button" (click)="sortBy('loadMw')">Load {{ marker('loadMw') }}</button></th>
                <th><button type="button" (click)="sortBy('health')">Health {{ marker('health') }}</button></th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              @for (facility of rows(); track facility.id) {
                <tr>
                  <td>
                    <a class="facility-link" [routerLink]="['/infrastructure', facility.id]" [attr.data-testid]="'facility-' + facility.id">
                      <span class="block font-medium">{{ facility.name }}</span>
                      <span class="text-xs text-muted">{{ facility.code }} · {{ facility.city }}</span>
                    </a>
                  </td>
                  <td>{{ regionLabel(facility.region) }}</td>
                  <td>{{ typeLabel(facility.type) }}</td>
                  <td class="font-mono text-sm">
                    {{ formatMw(facility.loadMw) }}
                    <span class="text-muted"> / {{ formatNumber(utilization(facility.loadMw, facility.capacityMw), 0) }}%</span>
                  </td>
                  <td class="font-mono">{{ facility.health }}</td>
                  <td>
                    <app-status-pill [label]="statusLabel(facility.status)" [tone]="facility.status" />
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    }
  `,
})
export class InfrastructurePage {
  readonly store = inject(OperationsStore);
  private readonly workspace = inject(WorkspaceStore);
  private readonly preferences = inject(PreferencesStore);
  readonly REGION_META = REGION_META;
  readonly TYPE_META = TYPE_META;
  readonly STATUS_META = STATUS_META;
  readonly types = TYPE_OPTIONS;
  readonly statuses = STATUS_OPTIONS;
  readonly formatMw = formatMw;
  readonly formatNumber = formatNumber;
  readonly text = signal('');
  readonly type = signal<FacilityType | 'all'>('all');
  readonly status = signal<FacilityStatus | 'all'>('all');
  readonly alertingOnly = signal(false);
  readonly sortKey = signal<'name' | 'region' | 'type' | 'loadMw' | 'health'>('loadMw');
  readonly sortDir = signal<1 | -1>(-1);

  readonly rows = computed(() => {
    const filtered = filterFacilities(this.store.facilitiesView(), {
      region: this.workspace.region(),
      type: this.type(),
      status: this.status(),
      text: this.text(),
      alertingOnly: this.alertingOnly(),
      preferences: this.preferences.snapshot(),
    });
    const key = this.sortKey();
    const dir = this.sortDir();
    return [...filtered].sort((left, right) => {
      const leftValue = this.sortValue(left, key);
      const rightValue = this.sortValue(right, key);
      if (leftValue < rightValue) {
        return -1 * dir;
      }
      if (leftValue > rightValue) {
        return dir;
      }
      return left.name.localeCompare(right.name);
    });
  });

  onText(event: Event): void {
    this.text.set((event.target as HTMLInputElement).value);
  }

  onType(event: Event): void {
    this.type.set((event.target as HTMLSelectElement).value as FacilityType | 'all');
  }

  onStatus(event: Event): void {
    this.status.set((event.target as HTMLSelectElement).value as FacilityStatus | 'all');
  }

  onAlerting(event: Event): void {
    this.alertingOnly.set((event.target as HTMLInputElement).checked);
  }

  clear(): void {
    this.text.set('');
    this.type.set('all');
    this.status.set('all');
    this.alertingOnly.set(false);
  }

  sortBy(key: 'name' | 'region' | 'type' | 'loadMw' | 'health'): void {
    if (this.sortKey() === key) {
      this.sortDir.update((dir) => (dir === 1 ? -1 : 1));
      return;
    }
    this.sortKey.set(key);
    this.sortDir.set(key === 'name' || key === 'region' || key === 'type' ? 1 : -1);
  }

  marker(key: 'name' | 'region' | 'type' | 'loadMw' | 'health'): string {
    if (this.sortKey() !== key) {
      return '';
    }
    return this.sortDir() === 1 ? '↑' : '↓';
  }

  regionLabel(region: string): string {
    return REGION_META[region as keyof typeof REGION_META].label;
  }

  typeLabel(type: string): string {
    return TYPE_META[type as keyof typeof TYPE_META].label;
  }

  statusLabel(status: string): string {
    return STATUS_META[status as keyof typeof STATUS_META].label;
  }

  utilization(load: number, capacity: number): number {
    return capacity === 0 ? 0 : (load / capacity) * 100;
  }

  private sortValue(
    facility: { name: string; region: string; type: string; loadMw: number; health: number },
    key: 'name' | 'region' | 'type' | 'loadMw' | 'health',
  ): string | number {
    if (key === 'region') {
      return this.regionLabel(facility.region);
    }
    if (key === 'type') {
      return this.typeLabel(facility.type);
    }
    return facility[key];
  }
}
