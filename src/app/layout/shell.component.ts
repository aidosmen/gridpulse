import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { OperationsStore } from '../core/state/operations.store';
import { PreferencesStore } from '../core/state/preferences.store';
import { EmptyStateComponent } from '../shared/ui/empty-state.component';
import { ToastHostComponent } from '../shared/ui/toast-host.component';
import { HeaderComponent } from './header.component';
import { SidebarComponent } from './sidebar.component';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, SidebarComponent, HeaderComponent, EmptyStateComponent, ToastHostComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="shell" [class.density-compact]="preferences.compact()">
      @if (navOpen()) {
        <button type="button" class="nav-backdrop" aria-label="Close navigation" (click)="navOpen.set(false)"></button>
      }
      <app-sidebar [mobileOpen]="navOpen()" (navigated)="navOpen.set(false)" />
      <div class="flex min-w-0 flex-1 flex-col">
        <app-header [menuOpen]="navOpen()" (menu)="navOpen.update((open) => !open)" />
        <main class="min-h-0 flex-1 overflow-auto px-5 py-5">
          @if (store.error()) {
            <app-empty-state
              icon="alert"
              title="Operations feed unavailable"
              message="GridPulse could not load the synthetic operations snapshot. Retry the feed to restore the workspace."
              action="Retry feed"
              (acted)="store.load()"
            />
          } @else {
            <router-outlet />
          }
        </main>
      </div>
    </div>
    <app-toast-host />
  `,
})
export class ShellComponent {
  readonly store = inject(OperationsStore);
  readonly preferences = inject(PreferencesStore);
  readonly navOpen = signal(false);
}
