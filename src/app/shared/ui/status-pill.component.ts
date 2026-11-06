import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-status-pill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="status-pill" [attr.data-tone]="tone()">{{ label() }}</span>`,
})
export class StatusPillComponent {
  readonly label = input.required<string>();
  readonly tone = input.required<string>();
}
