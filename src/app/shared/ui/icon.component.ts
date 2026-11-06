import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, input } from '@angular/core';
import {
  Activity,
  ArrowUpRight,
  BatteryCharging,
  Bell,
  Building,
  ChartColumn,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Factory,
  Funnel,
  Gauge,
  LayoutDashboard,
  MapPin,
  PanelLeft,
  PlugZap,
  Radio,
  School,
  Search,
  Server,
  Settings,
  Share2,
  Siren,
  SunMedium,
  TriangleExclamationPoint,
  Waypoints,
  Workflow,
  X,
  Zap,
} from 'lucide';

const ICONS = {
  activity: Activity,
  'arrow-up-right': ArrowUpRight,
  battery: BatteryCharging,
  bell: Bell,
  building: Building,
  chart: ChartColumn,
  check: Check,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'circle-check': CircleCheck,
  factory: Factory,
  funnel: Funnel,
  gauge: Gauge,
  dashboard: LayoutDashboard,
  pin: MapPin,
  panel: PanelLeft,
  plug: PlugZap,
  radio: Radio,
  school: School,
  search: Search,
  server: Server,
  settings: Settings,
  share: Share2,
  siren: Siren,
  sun: SunMedium,
  alert: TriangleExclamationPoint,
  waypoints: Waypoints,
  workflow: Workflow,
  x: X,
  zap: Zap,
} as const;

export type IconName = keyof typeof ICONS;

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
  host: { class: 'inline-flex shrink-0 items-center justify-center leading-none' },
})
export class IconComponent {
  readonly name = input.required<IconName>();
  private readonly host = inject(ElementRef<HTMLElement>);

  constructor() {
    effect(() => {
      const icon = ICONS[this.name()];
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '1.75');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('width', '1em');
      svg.setAttribute('height', '1em');
      for (const [tag, attrs] of icon) {
        const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
        for (const [key, value] of Object.entries(attrs)) {
          if (value !== undefined) {
            node.setAttribute(key, String(value));
          }
        }
        svg.append(node);
      }
      this.host.nativeElement.replaceChildren(svg);
    });
  }
}
