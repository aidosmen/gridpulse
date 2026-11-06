import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { formatRelative, formatTimestamp } from '../../core/domain/format';
import { MIN_NOTE_LENGTH, resolveSelectedIncident } from '../../core/domain/operations';
import {
  CATEGORY_META,
  INCIDENT_STATUS_META,
  IncidentStatus,
  SEVERITY_META,
  Severity,
} from '../../core/models/domain';
import { OperationsStore } from '../../core/state/operations.store';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { StatusPillComponent } from '../../shared/ui/status-pill.component';

@Component({
  selector: 'app-incidents',
  imports: [RouterLink, StatusPillComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.loading()) {
      <div class="panel h-[640px] animate-pulse"></div>
    } @else {
      <div class="mb-4 flex flex-wrap items-end gap-3">
        <div class="segmented" role="group" aria-label="Severity">
          <button type="button" [class.is-selected]="severity() === 'all'" (click)="severity.set('all')">All</button>
          @for (option of severities; track option) {
            <button type="button" [class.is-selected]="severity() === option" (click)="severity.set(option)">
              {{ SEVERITY_META[option].label }}
            </button>
          }
        </div>
        <label class="field">
          <span>Status</span>
          <select [value]="status()" (change)="onStatus($event)">
            <option value="active">Active</option>
            <option value="all">Any status</option>
            @for (option of statuses; track option) {
              <option [value]="option">{{ INCIDENT_STATUS_META[option].label }}</option>
            }
          </select>
        </label>
        <p class="ml-auto text-sm text-muted">{{ filtered().length }} in view</p>
      </div>

      @if (filtered().length === 0 && !selection().incident) {
        <app-empty-state
          icon="circle-check"
          title="Queue is clear"
          message="Nothing in this region matches the severity and status filters."
          action="Show active work"
          (acted)="reset()"
        />
      } @else {
        <div class="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
          <ul class="panel max-h-[720px] space-y-1 overflow-auto p-2">
            @for (incident of filtered(); track incident.id) {
              <li>
                <button
                  type="button"
                  class="queue-row"
                  [class.is-selected]="incident.id === selection().incident?.id"
                  [attr.data-testid]="'incident-' + incident.id"
                  (click)="choose(incident.id)"
                >
                  <span class="flex items-center justify-between gap-2">
                    <span class="font-mono text-xs text-muted">{{ incident.id }}</span>
                    <app-status-pill [label]="SEVERITY_META[incident.severity].label" [tone]="incident.severity" />
                  </span>
                  <span class="mt-1 block text-left text-sm font-medium">{{ incident.title }}</span>
                  <span class="mt-1 block text-left text-xs text-muted">
                    {{ facilityName(incident.facilityId) }} · {{ formatRelative(incident.updatedAt) }}
                  </span>
                </button>
              </li>
            }
          </ul>

          @if (selection().incident; as incident) {
            <article class="panel p-5">
              @if (selection().hiddenByFilter) {
                <p class="mb-4 rounded-xl border border-line bg-panel-2 px-3 py-3 text-sm">
                  This incident is hidden by the current filters. Actions still apply to {{ incident.id }}.
                  <button type="button" class="btn btn-ghost ml-2" (click)="reset()">Show it in the queue</button>
                </p>
              }
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p class="kicker">{{ incident.id }} · {{ CATEGORY_META[incident.category].label }}</p>
                  <h2 class="mt-1 font-display text-2xl tracking-tight">{{ incident.title }}</h2>
                </div>
                <div class="flex gap-2">
                  <app-status-pill [label]="SEVERITY_META[incident.severity].label" [tone]="incident.severity" />
                  <app-status-pill [label]="INCIDENT_STATUS_META[incident.status].label" [tone]="incident.status" />
                </div>
              </div>
              <p class="mt-4 max-w-3xl text-sm leading-6 text-muted">{{ incident.summary }}</p>
              <dl class="mt-5 grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt class="text-muted">Site</dt>
                  <dd>{{ facilityName(incident.facilityId) }}</dd>
                </div>
                <div>
                  <dt class="text-muted">Assignee</dt>
                  <dd>{{ incident.assignee }}</dd>
                </div>
                <div>
                  <dt class="text-muted">Updated</dt>
                  <dd>{{ formatTimestamp(incident.updatedAt) }}</dd>
                </div>
              </dl>
              @if (incident.resolution) {
                <p class="mt-4 rounded-xl border border-line bg-panel-2 px-3 py-3 text-sm">{{ incident.resolution }}</p>
              }

              <div class="mt-6 flex flex-wrap gap-2">
                @if (incident.status === 'open') {
                  <button
                    type="button"
                    class="btn btn-primary"
                    data-testid="acknowledge"
                    [disabled]="store.pendingIds().has(incident.id)"
                    (click)="store.acknowledge(incident.id)"
                  >
                    Acknowledge
                  </button>
                }
                @if (incident.status === 'acknowledged') {
                  <button type="button" class="btn btn-primary" [disabled]="store.pendingIds().has(incident.id)" (click)="store.investigate(incident.id)">
                    Start investigation
                  </button>
                }
                @if (incident.status === 'acknowledged' || incident.status === 'investigating') {
                  <button type="button" class="btn btn-ghost" data-testid="open-resolve" (click)="openResolve()">
                    Resolve
                  </button>
                }
                @if (incident.status === 'resolved') {
                  <button type="button" class="btn btn-ghost" [disabled]="store.pendingIds().has(incident.id)" (click)="store.reopen(incident.id)">Reopen</button>
                }
                <a class="btn btn-ghost" [routerLink]="['/infrastructure', incident.facilityId]">Open facility</a>
              </div>

              <h3 class="mt-8 font-display text-base">Timeline</h3>
              <ol class="mt-3 space-y-3">
                @for (item of timeline(); track item.id) {
                  <li class="border-l border-line pl-3">
                    <p class="text-sm">{{ item.message }}</p>
                    <p class="text-xs text-muted">{{ item.actor }} · {{ formatTimestamp(item.at) }}</p>
                  </li>
                }
              </ol>
            </article>
          } @else {
            <app-empty-state
              icon="siren"
              [title]="selectedId() ? 'Incident is outside this view' : 'Select an incident'"
              [message]="selectedId() ? 'That id is not in the current region snapshot.' : 'Choose an incident from the queue. The open record always matches the id in the address bar.'"
            />
          }
        </div>
      }

      @if (resolveOpen()) {
        <div class="dialog-backdrop" (click)="closeResolve(false)">
          <div
            class="dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="resolve-title"
            aria-describedby="resolve-help"
            (click)="$event.stopPropagation()"
            (keydown)="onDialogKey($event)"
          >
            <h2 id="resolve-title" class="font-display text-lg">Resolve incident</h2>
            <p id="resolve-help" class="mt-2 text-sm leading-6 text-muted">
              Record what changed in the field. The note stays on the incident and in the site activity log.
            </p>
            <textarea
              #resolveNote
              class="mt-3 w-full"
              rows="4"
              [value]="resolution()"
              (input)="onResolution($event)"
              [attr.aria-invalid]="resolveError() ? true : null"
              [attr.aria-describedby]="resolveError() ? 'resolve-error' : null"
              placeholder="What was found, what was changed, and what was verified?"
            ></textarea>
            @if (resolveError()) {
              <p id="resolve-error" class="mt-2 text-sm text-rose">{{ resolveError() }}</p>
            }
            <div class="mt-4 flex justify-end gap-2">
              <button type="button" class="btn btn-ghost" (click)="closeResolve(false)">Cancel</button>
              <button type="button" class="btn btn-primary" data-testid="confirm-resolve" (click)="confirmResolve()">
                Resolve incident
              </button>
            </div>
          </div>
        </div>
      }
    }
  `,
})
export class IncidentsPage {
  readonly store = inject(OperationsStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly SEVERITY_META = SEVERITY_META;
  readonly INCIDENT_STATUS_META = INCIDENT_STATUS_META;
  readonly CATEGORY_META = CATEGORY_META;
  readonly formatRelative = formatRelative;
  readonly formatTimestamp = formatTimestamp;
  readonly severities: Severity[] = ['critical', 'high', 'medium', 'low'];
  readonly statuses: IncidentStatus[] = ['open', 'acknowledged', 'investigating', 'resolved'];
  readonly severity = signal<Severity | 'all'>('all');
  readonly status = signal<IncidentStatus | 'active' | 'all'>('active');
  readonly selectedId = signal<string | null>(null);
  readonly resolveOpen = signal(false);
  readonly resolution = signal('');
  readonly resolveError = signal('');
  private readonly resolveNote = viewChild<ElementRef<HTMLTextAreaElement>>('resolveNote');
  private restoreFocus: HTMLElement | null = null;

  readonly filtered = computed(() => {
    const severity = this.severity();
    const status = this.status();
    return this.store
      .visibleIncidents()
      .filter((incident) => (severity === 'all' ? true : incident.severity === severity))
      .filter((incident) => {
        if (status === 'all') {
          return true;
        }
        if (status === 'active') {
          return incident.status !== 'resolved';
        }
        return incident.status === status;
      })
      .slice()
      .sort((left, right) => severityRank(right.severity) - severityRank(left.severity) || right.updatedAt.localeCompare(left.updatedAt));
  });

  readonly selection = computed(() =>
    resolveSelectedIncident(this.store.visibleIncidents(), this.filtered(), this.selectedId()),
  );

  readonly timeline = computed(() => {
    const id = this.selection().incident?.id;
    return this.store.activities().filter((item) => item.incidentId === id);
  });

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const id = params.get('id');
      this.selectedId.set(id);
    });
    effect(() => {
      if (this.resolveOpen()) {
        this.resolveNote()?.nativeElement.focus();
      }
    });
  }

  choose(id: string): void {
    this.selectedId.set(id);
    void this.router.navigate([], { relativeTo: this.route, queryParams: { id }, queryParamsHandling: 'merge' });
  }

  onStatus(event: Event): void {
    this.status.set((event.target as HTMLSelectElement).value as IncidentStatus | 'active' | 'all');
  }

  onResolution(event: Event): void {
    this.resolution.set((event.target as HTMLTextAreaElement).value);
  }

  reset(): void {
    this.severity.set('all');
    this.status.set('active');
  }

  facilityName(id: string): string {
    return this.store.facilities().find((facility) => facility.id === id)?.name ?? id;
  }

  openResolve(): void {
    this.restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.resolveError.set('');
    this.resolveOpen.set(true);
  }

  closeResolve(restore: boolean): void {
    this.resolveOpen.set(false);
    if (restore) {
      this.restoreFocus?.focus();
    }
  }

  confirmResolve(): void {
    const incident = this.selection().incident;
    const note = this.resolution().trim();
    if (!incident || incident.id !== this.selectedId()) {
      return;
    }
    if (note.length < MIN_NOTE_LENGTH) {
      this.resolveError.set('Add a resolution note of at least 8 characters.');
      return;
    }
    this.store.resolve(incident.id, note).subscribe({
      next: () => {
        this.resolution.set('');
        this.resolveError.set('');
        this.closeResolve(true);
      },
    });
  }

  onDialogKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeResolve(true);
      return;
    }
    if (event.key !== 'Tab') {
      return;
    }
    const root = event.currentTarget;
    if (!(root instanceof HTMLElement)) {
      return;
    }
    const focusable = [...root.querySelectorAll<HTMLElement>('textarea, button, input, select, a[href]')].filter(
      (element) => !element.hasAttribute('disabled'),
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) {
      return;
    }
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}

function severityRank(severity: Severity): number {
  return { low: 0, medium: 1, high: 2, critical: 3 }[severity];
}
