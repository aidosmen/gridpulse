import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import { provideEchartsCore } from 'ngx-echarts';
import type { EChartsCoreOption } from 'echarts/core';
import { echarts } from './echarts-setup';

@Component({
  selector: 'app-chart',
  imports: [NgxEchartsDirective],
  providers: [provideEchartsCore({ echarts })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block h-full min-h-0' },
  template: `<div echarts [options]="options()" class="h-full w-full"></div>`,
})
export class ChartComponent {
  readonly options = input.required<EChartsCoreOption>();
}
