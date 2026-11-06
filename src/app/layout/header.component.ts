import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs/operators';
import { formatRelative } from '../core/domain/format';
import {
  INCIDENT_STATUS_META,
  OPERATOR,
  REGION_OPTIONS,
  RegionFilter,
  SEVERITY_META,
} from '../core/models/domain';
import { OperationsStore } from '../core/state/operations.store';
import { WorkspaceStore } from '../core/state/workspace.store';
import { IconComponent } from '../shared/ui/icon.component';

interface SearchHit {
  id: string;
  kind: 'facility' | 'incident';
  title: string;
  meta: string;
  route: string;
  query?: Record<string, string>;
}

@Component({
  selector: 'app-header',
  imports: [CdkOverlayOrigin, CdkConnectedOverlay, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="header">
      <button
        type="button"
        class="icon-button mobile-only"
        aria-label="Open navigation"
        [attr.aria-expanded]="menuOpen()"
        (click)="menu.emit()"
      >
        <app-icon name="panel" />
      </button>
      <div class="min-w-0">
        <p class="kicker">{{ kicker() }}</p>
        <h1 class="font-display text-2xl leading-none tracking-tight">{{ title() }}</h1>
      </div>

      <div class="header-search relative min-w-[16rem] flex-1" cdkOverlayOrigin #searchOrigin="cdkOverlayOrigin">
        <label class="search-field">
          <app-icon name="search" class="text-muted" />
          <input
            data-testid="global-search"
            type="search"
            placeholder="Search facilities and incidents"
            [value]="query()"
            (input)="onQuery($event)"
            (focus)="paletteOpen.set(true)"
            (keydown)="onSearchKey($event)"
            role="combobox"
            aria-autocomplete="list"
            [attr.aria-expanded]="paletteOpen()"
            aria-controls="search-results"
          />
        </label>
        <ng-template
          cdkConnectedOverlay
          [cdkConnectedOverlayOrigin]="searchOrigin"
          [cdkConnectedOverlayOpen]="paletteOpen() && hits().length > 0"
          [cdkConnectedOverlayPositions]="positions"
          [cdkConnectedOverlayWidth]="searchWidth"
          (overlayOutsideClick)="paletteOpen.set(false)"
        >
          <ul id="search-results" class="palette" role="listbox">
            @for (hit of hits(); track hit.id; let index = $index) {
              <li>
                <button
                  type="button"
                  role="option"
                  [attr.aria-selected]="index === activeIndex()"
                  class="palette-item"
                  [class.is-active]="index === activeIndex()"
                  (click)="openHit(hit)"
                >
                  <app-icon [name]="hit.kind === 'facility' ? 'building' : 'siren'" />
                  <span>
                    <span class="block text-sm text-ink-text">{{ hit.title }}</span>
                    <span class="block text-xs text-muted">{{ hit.meta }}</span>
                  </span>
                </button>
              </li>
            }
          </ul>
        </ng-template>
      </div>

      <div class="flex flex-wrap items-center justify-end gap-2">
        <label class="field header-region">
          <span class="sr-only">Operating region</span>
          <select aria-label="Operating region" [value]="workspace.region()" (change)="onRegion($event)">
            @for (option of regionOptions; track option.value) {
              <option [value]="option.value">{{ option.label }}</option>
            }
          </select>
        </label>
        <div class="segmented" role="group" aria-label="Chart time horizon">
          @for (option of horizons; track option.id) {
            <button
              type="button"
              [attr.aria-pressed]="workspace.horizon() === option.id"
              [class.is-selected]="workspace.horizon() === option.id"
              (click)="workspace.horizon.set(option.id)"
            >
              {{ option.label }}
            </button>
          }
        </div>
        <div class="relative">
          <button
            type="button"
            class="icon-button"
            cdkOverlayOrigin
            #alertsOrigin="cdkOverlayOrigin"
            aria-label="Open alerts"
            [attr.aria-expanded]="alertsOpen()"
            aria-controls="alert-results"
            (click)="alertsOpen.update((open) => !open)"
            (keydown.escape)="alertsOpen.set(false)"
          >
            <app-icon name="bell" />
            @if (alerts().length) {
              <span class="badge">{{ alerts().length }}</span>
            }
          </button>
          <ng-template
            cdkConnectedOverlay
            [cdkConnectedOverlayOrigin]="alertsOrigin"
            [cdkConnectedOverlayOpen]="alertsOpen()"
            [cdkConnectedOverlayPositions]="alertPositions"
            cdkConnectedOverlayPanelClass="gp-dropdown"
            (overlayOutsideClick)="alertsOpen.set(false)"
            (overlayKeydown)="onAlertsKey($event)"
          >
            <div id="alert-results" class="dropdown-panel" role="region" aria-label="Unresolved priority">
              <p class="kicker px-3 pt-3">Unresolved priority</p>
              @if (alerts().length === 0) {
                <p class="px-3 py-4 text-sm text-muted">No critical or high incidents in this region.</p>
              } @else {
                <ul>
                  @for (alert of alerts(); track alert.id) {
                    <li>
                      <button type="button" class="alert-item" (click)="openIncident(alert.id)">
                        <span class="block text-sm">{{ alert.title }}</span>
                        <span class="mt-1 block text-xs text-muted">
                          {{ alert.id }} · {{ formatRelative(alert.updatedAt) }}
                        </span>
                      </button>
                    </li>
                  }
                </ul>
              }
            </div>
          </ng-template>
        </div>
        <div class="operator">
          <span class="avatar">{{ operator.initials }}</span>
          <span class="hidden min-[1180px]:block">
            <span class="block text-sm leading-tight">{{ operator.name }}</span>
            <span class="block text-xs text-muted">{{ operator.role }}</span>
          </span>
        </div>
      </div>
    </header>
  `,
})
export class HeaderComponent {
  private readonly router = inject(Router);
  readonly workspace = inject(WorkspaceStore);
  readonly store = inject(OperationsStore);
  readonly operator = OPERATOR;
  readonly formatRelative = formatRelative;
  readonly menuOpen = input(false);
  readonly menu = output<void>();
  readonly title = signal('Overview');
  readonly kicker = signal('System posture');
  readonly query = signal('');
  readonly paletteOpen = signal(false);
  readonly alertsOpen = signal(false);
  readonly activeIndex = signal(0);
  readonly searchWidth = 420;
  readonly positions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 8 },
  ];
  readonly alertPositions: ConnectedPosition[] = [
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 8 },
  ];
  readonly horizons = [
    { id: '24h' as const, label: '24h' },
    { id: '7d' as const, label: '7d' },
    { id: '30d' as const, label: '30d' },
  ];
  readonly regionOptions = [
    { label: 'All regions', value: 'all' as RegionFilter },
    ...REGION_OPTIONS.map((region) => ({ label: region.label, value: region.id })),
  ];

  readonly hits = computed<SearchHit[]>(() => {
    const text = this.query().trim().toLowerCase();
    if (text.length < 2) {
      return [];
    }
    const facilities = this.store.facilities()
      .filter((facility) => `${facility.name} ${facility.code} ${facility.city}`.toLowerCase().includes(text))
      .slice(0, 5)
      .map((facility) => ({
        id: facility.id,
        kind: 'facility' as const,
        title: facility.name,
        meta: `${facility.code} · ${facility.city}`,
        route: `/infrastructure/${facility.id}`,
      }));
    const incidents = this.store.incidents()
      .filter((incident) => `${incident.id} ${incident.title}`.toLowerCase().includes(text))
      .slice(0, 5)
      .map((incident) => ({
        id: incident.id,
        kind: 'incident' as const,
        title: incident.title,
        meta: `${incident.id} · ${SEVERITY_META[incident.severity].label} · ${INCIDENT_STATUS_META[incident.status].label}`,
        route: '/incidents',
        query: { id: incident.id },
      }));
    return [...facilities, ...incidents].slice(0, 8);
  });

  readonly alerts = computed(() =>
    this.store
      .visibleIncidents()
      .filter(
        (incident) =>
          incident.status !== 'resolved' && (incident.severity === 'critical' || incident.severity === 'high'),
      )
      .slice(0, 6),
  );

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.syncTitle());
    this.syncTitle();
  }

  onAlertsKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.alertsOpen.set(false);
    }
  }

  onRegion(event: Event): void {
    this.workspace.region.set((event.target as HTMLSelectElement).value as RegionFilter);
  }

  onQuery(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.query.set(value);
    this.activeIndex.set(0);
    this.paletteOpen.set(true);
  }

  onSearchKey(event: KeyboardEvent): void {
    const hits = this.hits();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.activeIndex.update((index) => Math.min(index + 1, Math.max(hits.length - 1, 0)));
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeIndex.update((index) => Math.max(index - 1, 0));
    }
    if (event.key === 'Enter') {
      const hit = hits[this.activeIndex()];
      if (hit) {
        this.openHit(hit);
      }
    }
    if (event.key === 'Escape') {
      this.paletteOpen.set(false);
    }
  }

  openHit(hit: SearchHit): void {
    this.paletteOpen.set(false);
    this.query.set('');
    void this.router.navigate([hit.route], { queryParams: hit.query });
  }

  openIncident(id: string): void {
    this.alertsOpen.set(false);
    void this.router.navigate(['/incidents'], { queryParams: { id } });
  }

  private syncTitle(): void {
    let route = this.router.routerState.snapshot.root;
    while (route.firstChild) {
      route = route.firstChild;
    }
    const data = route.data;
    this.title.set(typeof data['title'] === 'string' ? data['title'] : 'GridPulse');
    this.kicker.set(typeof data['kicker'] === 'string' ? data['kicker'] : 'Energy infrastructure');
  }
}
