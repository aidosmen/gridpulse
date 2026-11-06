import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IconComponent, IconName } from '../shared/ui/icon.component';

interface NavItem {
  path: string;
  label: string;
  hint: string;
  icon: IconName;
}

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="sidebar" [class.is-collapsed]="collapsed()" [class.is-mobile-open]="mobileOpen()" (keydown.escape)="navigated.emit()">
      <div class="flex items-center gap-3 px-3">
        <span class="mark" aria-hidden="true"></span>
        @if (!collapsed()) {
          <div>
            <p class="font-display text-lg leading-none tracking-tight">GridPulse</p>
            <p class="mt-1 text-[11px] uppercase tracking-[0.18em] text-muted">Infrastructure</p>
          </div>
        }
      </div>

      <nav class="mt-8 flex flex-1 flex-col gap-1" aria-label="Primary">
        @for (item of items; track item.path) {
          <a
            [routerLink]="item.path"
            routerLinkActive="is-active"
            class="nav-link"
            [attr.title]="collapsed() ? item.label : null"
            (click)="navigated.emit()"
          >
            <app-icon [name]="item.icon" class="text-lg" />
            @if (!collapsed()) {
              <span>
                <span class="block text-sm font-medium">{{ item.label }}</span>
                <span class="block text-xs text-muted">{{ item.hint }}</span>
              </span>
            }
          </a>
        }
      </nav>

      <button type="button" class="nav-link desktop-only mt-4" (click)="collapsed.update((value) => !value)">
        <app-icon [name]="collapsed() ? 'chevron-right' : 'chevron-left'" class="text-lg" />
        @if (!collapsed()) {
          <span class="text-sm">Collapse</span>
        }
      </button>
    </aside>
  `,
})
export class SidebarComponent {
  readonly mobileOpen = input(false);
  readonly navigated = output<void>();
  readonly collapsed = signal(false);
  readonly items: NavItem[] = [
    { path: '/overview', label: 'Overview', hint: 'System posture', icon: 'dashboard' },
    { path: '/infrastructure', label: 'Infrastructure', hint: 'Sites and assets', icon: 'building' },
    { path: '/topology', label: 'Network Topology', hint: 'Flow and stress', icon: 'waypoints' },
    { path: '/incidents', label: 'Incidents', hint: 'Response queue', icon: 'siren' },
    { path: '/analytics', label: 'Analytics', hint: 'Energy and drift', icon: 'chart' },
    { path: '/settings', label: 'Settings', hint: 'Thresholds', icon: 'settings' },
  ];
}
