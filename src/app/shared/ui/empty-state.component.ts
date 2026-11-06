import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconComponent, IconName } from './icon.component';

@Component({
  selector: 'app-empty-state',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty-state">
      <app-icon [name]="icon()" class="text-3xl text-cyan" />
      <h2 class="mt-4 font-display text-xl text-ink-text">{{ title() }}</h2>
      <p class="mt-2 max-w-md text-sm leading-6 text-muted">{{ message() }}</p>
      @if (action()) {
        <button type="button" class="btn btn-primary mt-5" (click)="acted.emit()">{{ action() }}</button>
      }
    </div>
  `,
})
export class EmptyStateComponent {
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly icon = input<IconName>('radio');
  readonly action = input<string>();
  readonly acted = output<void>();
}
