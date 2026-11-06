import { Injectable, signal } from '@angular/core';

export interface ToastMessage {
  id: number;
  severity: 'success' | 'warn' | 'error';
  summary: string;
  detail: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  readonly messages = signal<ToastMessage[]>([]);

  add(message: Omit<ToastMessage, 'id'> & { life?: number }): void {
    const id = this.nextId++;
    this.messages.update((items) => [
      ...items,
      { id, severity: message.severity, summary: message.summary, detail: message.detail },
    ]);
    const life = message.life ?? 4000;
    setTimeout(() => this.dismiss(id), life);
  }

  dismiss(id: number): void {
    this.messages.update((items) => items.filter((item) => item.id !== id));
  }
}
