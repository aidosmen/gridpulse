import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from '../../core/state/toast.service';

@Component({
  selector: 'app-toast-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toast-stack" aria-live="polite">
      @for (message of toasts.messages(); track message.id) {
        <article class="toast" [attr.data-severity]="message.severity" role="status">
          <p class="toast-summary">{{ message.summary }}</p>
          <p class="toast-detail">{{ message.detail }}</p>
          <button type="button" class="toast-close" aria-label="Dismiss notification" (click)="toasts.dismiss(message.id)">
            ×
          </button>
        </article>
      }
    </div>
  `,
})
export class ToastHostComponent {
  readonly toasts = inject(ToastService);
}
