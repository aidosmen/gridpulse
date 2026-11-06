import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { isAlerting } from '../../core/domain/operations';
import { OPERATOR } from '../../core/models/domain';
import { OperationsStore } from '../../core/state/operations.store';
import { PreferencesStore } from '../../core/state/preferences.store';
import { PanelComponent } from '../../shared/ui/panel.component';

@Component({
  selector: 'app-settings',
  imports: [PanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.8fr)]">
      <app-panel kicker="Envelope" title="Operating thresholds">
        <p class="max-w-2xl text-sm leading-6 text-muted">
          These limits decide which sites carry an alerting state on Overview, Infrastructure, and the live toast stream.
          They stay in this browser.
        </p>

        <label class="mt-6 block">
          <span class="flex items-baseline justify-between">
            <span class="text-sm">Load alert</span>
            <span class="font-mono text-sm text-cyan">{{ preferences.loadAlertPct() }}%</span>
          </span>
          <input
            class="range mt-3"
            type="range"
            min="70"
            max="98"
            [value]="preferences.loadAlertPct()"
            (input)="onLoad($event)"
            aria-label="Load alert"
          />
        </label>

        <label class="mt-6 block">
          <span class="flex items-baseline justify-between">
            <span class="text-sm">Health floor</span>
            <span class="font-mono text-sm text-cyan">{{ preferences.healthFloor() }}</span>
          </span>
          <input
            class="range mt-3"
            type="range"
            min="40"
            max="95"
            [value]="preferences.healthFloor()"
            (input)="onHealth($event)"
            aria-label="Health floor"
          />
        </label>

        <div class="mt-6 flex items-center justify-between gap-4 rounded-2xl border border-line px-4 py-3">
          <div>
            <p class="text-sm font-medium">Critical crossing toasts</p>
            <p class="text-xs text-muted">Notify when a site newly leaves the envelope.</p>
          </div>
          <button
            type="button"
            class="switch"
            role="switch"
            aria-label="Critical crossing toasts"
            [attr.aria-checked]="preferences.notifyCritical()"
            (click)="preferences.notifyCritical.set(!preferences.notifyCritical())"
          ></button>
        </div>

        <div class="mt-3 flex items-center justify-between gap-4 rounded-2xl border border-line px-4 py-3">
          <div>
            <p class="text-sm font-medium">Compact density</p>
            <p class="text-xs text-muted">Tighten the workspace padding for control-room screens.</p>
          </div>
          <button
            type="button"
            class="switch"
            role="switch"
            aria-label="Compact density"
            [attr.aria-checked]="preferences.compact()"
            (click)="preferences.compact.set(!preferences.compact())"
          ></button>
        </div>
      </app-panel>

      <div class="space-y-4">
        <app-panel kicker="Effect" title="Sites outside the envelope">
          <p class="font-mono text-5xl tracking-tight text-cyan">{{ alerting().length }}</p>
          <ul class="mt-4 space-y-2 text-sm">
            @for (facility of alerting(); track facility.id) {
              <li class="flex justify-between gap-3">
                <span>{{ facility.name }}</span>
                <span class="font-mono text-muted">{{ facility.health }}</span>
              </li>
            }
          </ul>
        </app-panel>
        <app-panel kicker="Operator" title="Session">
          <p class="text-sm">{{ operator.name }}</p>
          <p class="text-xs text-muted">{{ operator.role }}</p>
          <p class="mt-4 text-sm leading-6 text-muted">
            GridPulse is a demonstration workspace. Incident decisions, inspections, and thresholds are stored in this browser session and are not sent to a remote service.
          </p>
        </app-panel>
      </div>
    </div>
  `,
})
export class SettingsPage {
  readonly preferences = inject(PreferencesStore);
  readonly store = inject(OperationsStore);
  readonly operator = OPERATOR;
  readonly alerting = computed(() =>
    this.store.visibleFacilities().filter((facility) => isAlerting(facility, this.preferences.snapshot())),
  );

  onLoad(event: Event): void {
    this.preferences.setLoadAlert(Number((event.target as HTMLInputElement).value));
  }

  onHealth(event: Event): void {
    this.preferences.setHealthFloor(Number((event.target as HTMLInputElement).value));
  }
}
