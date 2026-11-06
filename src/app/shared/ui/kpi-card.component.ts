import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent, IconName } from './icon.component';

@Component({
  selector: 'app-kpi-card',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="panel kpi-card" [attr.data-testid]="testId()">
      <div class="flex items-center justify-between gap-3">
        <p class="kicker">{{ label() }}</p>
        <app-icon [name]="icon()" class="text-lg text-cyan" />
      </div>
      <p class="mt-4 font-mono text-[1.85rem] leading-none tracking-tight text-ink-text">{{ value() }}</p>
      <p class="mt-3 text-sm text-muted">{{ hint() }}</p>
    </article>
  `,
})
export class KpiCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly hint = input.required<string>();
  readonly icon = input.required<IconName>();
  readonly testId = input<string>();
}
