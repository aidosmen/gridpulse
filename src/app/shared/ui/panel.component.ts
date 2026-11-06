import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel flex h-full flex-col">
      @if (title()) {
        <header class="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            @if (kicker()) {
              <p class="kicker">{{ kicker() }}</p>
            }
            <h2 class="font-display text-base font-semibold tracking-tight text-ink-text">{{ title() }}</h2>
          </div>
          <ng-content select="[panel-actions]" />
        </header>
      }
      <div class="min-h-0 flex-1 p-4">
        <ng-content />
      </div>
    </section>
  `,
})
export class PanelComponent {
  readonly title = input<string>();
  readonly kicker = input<string>();
}
