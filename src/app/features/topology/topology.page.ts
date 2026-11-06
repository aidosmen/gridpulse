import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import cytoscape, { Core, ElementDefinition } from 'cytoscape';
import { REGION_META, STATUS_META, TopologyNode } from '../../core/models/domain';
import { OperationsStore } from '../../core/state/operations.store';
import { WorkspaceStore } from '../../core/state/workspace.store';
import { formatMw } from '../../core/domain/format';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { StatusPillComponent } from '../../shared/ui/status-pill.component';

@Component({
  selector: 'app-topology',
  imports: [EmptyStateComponent, StatusPillComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.loading()) {
      <div class="panel h-[640px] animate-pulse"></div>
    } @else {
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p class="max-w-2xl text-sm leading-6 text-muted">
          Regional hubs collect site flow. Edge width follows megawatts. Stressed paths are the ones touching a degraded or offline site.
        </p>
        <label class="check-field">
          <input type="checkbox" [checked]="stressedOnly()" (change)="onStressed($event)" />
          Stressed paths only
        </label>
      </div>
      <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div class="instrument panel overflow-hidden">
          <div #host class="topology-host"></div>
        </div>
        <aside class="panel p-4">
          @if (selected(); as node) {
            <p class="kicker">{{ node.kind === 'hub' ? 'Regional hub' : 'Facility' }}</p>
            <h2 class="mt-2 font-display text-2xl tracking-tight">{{ node.label }}</h2>
            <div class="mt-3">
              <app-status-pill [label]="STATUS_META[node.status].label" [tone]="node.status" />
            </div>
            <dl class="mt-5 space-y-3 text-sm">
              <div class="flex justify-between gap-3">
                <dt class="text-muted">Region</dt>
                <dd>{{ REGION_META[node.region].label }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-muted">Connected flow</dt>
                <dd class="font-mono">{{ formatMw(flow()) }}</dd>
              </div>
            </dl>
            @if (node.facilityId) {
              <button type="button" class="btn btn-primary mt-6" (click)="openFacility(node.facilityId!)">
                Open facility
              </button>
            }
          } @else {
            <app-empty-state
              icon="waypoints"
              title="Select a node"
              message="Choose a hub or facility on the graph to read its status and connected flow."
            />
          }
        </aside>
      </div>
    }
  `,
  styles: `
    .topology-host {
      height: 680px;
    }
  `,
})
export class TopologyPage implements OnDestroy {
  readonly store = inject(OperationsStore);
  private readonly workspace = inject(WorkspaceStore);
  private readonly router = inject(Router);
  readonly STATUS_META = STATUS_META;
  readonly REGION_META = REGION_META;
  readonly formatMw = formatMw;
  readonly stressedOnly = signal(false);
  readonly selectedId = signal<string | null>(null);
  private readonly host = viewChild<ElementRef<HTMLDivElement>>('host');
  private cy: Core | null = null;
  private elementKey = '';
  private resizeObserver: ResizeObserver | null = null;

  readonly elements = computed(() => this.buildElements());

  readonly selected = computed(() => {
    const id = this.selectedId();
    return this.store.topologyView().nodes.find((node) => node.id === id) ?? null;
  });

  readonly flow = computed(() => {
    const id = this.selectedId();
    if (!id) {
      return 0;
    }
    return this.store
      .topologyView()
      .edges.filter((edge) => edge.source === id || edge.target === id)
      .reduce((sum, edge) => sum + edge.flowMw, 0);
  });

  constructor() {
    effect(() => {
      const element = this.host()?.nativeElement;
      if (!element || this.cy) {
        return;
      }
      this.mount(element);
    });
    effect(() => {
      const elements = this.elements();
      const cy = this.cy;
      if (!cy) {
        return;
      }
      const key = elements.map((element) => String(element.data['id'] ?? '')).join('|');
      if (key === this.elementKey) {
        for (const element of elements) {
          const id = String(element.data['id'] ?? '');
          cy.getElementById(id).data(element.data);
        }
        return;
      }
      this.elementKey = key;
      cy.elements().remove();
      cy.add(elements);
      cy.layout({ name: 'cose', animate: false, padding: 36, nodeRepulsion: 9000 } as cytoscape.LayoutOptions).run();
    });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.cy?.destroy();
    this.cy = null;
  }

  onStressed(event: Event): void {
    this.stressedOnly.set((event.target as HTMLInputElement).checked);
    this.selectedId.set(null);
  }

  openFacility(id: string): void {
    void this.router.navigate(['/infrastructure', id]);
  }

  private mount(element: HTMLDivElement): void {
    if (this.cy) {
      return;
    }
    this.cy = cytoscape({
      container: element,
      elements: this.elements(),
      minZoom: 0.4,
      maxZoom: 2.2,
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(label)',
            color: '#d5e0ea',
            'font-size': 11,
            'text-valign': 'bottom',
            'text-margin-y': 8,
            'background-color': '#3dcb8c',
            width: 18,
            height: 18,
            'text-outline-width': 0,
          },
        },
        {
          selector: 'node[kind = "hub"]',
          style: { shape: 'diamond', width: 26, height: 26, 'background-color': '#e6b15a' },
        },
        { selector: 'node[status = "degraded"]', style: { 'background-color': '#f07178' } },
        { selector: 'node[status = "offline"]', style: { 'background-color': '#7d8b9c' } },
        { selector: 'node[status = "watch"]', style: { 'background-color': '#e6b15a' } },
        { selector: 'node[status = "maintenance"]', style: { 'background-color': '#7eb6ff' } },
        { selector: 'node[status = "nominal"]', style: { 'background-color': '#3dcb8c' } },
        {
          selector: 'edge',
          style: {
            width: 'mapData(flow, 0, 500, 1, 7)',
            'line-color': 'rgba(62, 224, 197, 0.45)',
            'curve-style': 'bezier',
            'target-arrow-shape': 'triangle',
            'target-arrow-color': 'rgba(62, 224, 197, 0.8)',
            'arrow-scale': 0.8,
          },
        },
        {
          selector: 'edge[?stressed]',
          style: { 'line-color': '#f07178', 'target-arrow-color': '#f07178' },
        },
        {
          selector: 'node:selected',
          style: { 'border-width': 2, 'border-color': '#3ee0c5' },
        },
      ],
      layout: { name: 'cose', animate: false, padding: 36 },
    });
    this.cy.on('tap', 'node', (event) => {
      const id = String(event.target.id());
      this.selectedId.set(id);
    });
    this.cy.on('tap', (event) => {
      if (event.target === this.cy) {
        this.selectedId.set(null);
      }
    });
    this.resizeObserver = new ResizeObserver(() => this.cy?.resize());
    this.resizeObserver.observe(element);
    this.elementKey = this.elements()
      .map((elementDefinition) => String(elementDefinition.data['id'] ?? ''))
      .join('|');
  }

  private buildElements(): ElementDefinition[] {
    const region = this.workspace.region();
    const stressedOnly = this.stressedOnly();
    const nodes = this.store.topologyView().nodes.filter((node) => {
      if (region !== 'all' && node.region !== region) {
        return false;
      }
      if (!stressedOnly || node.kind === 'hub') {
        return true;
      }
      return node.status === 'degraded' || node.status === 'offline';
    });
    const ids = new Set(nodes.map((node) => node.id));
    const edges = this.store.topologyView().edges.filter((edge) => {
      if (!ids.has(edge.source) || !ids.has(edge.target)) {
        return false;
      }
      return !stressedOnly || edge.stressed;
    });
    return [
      ...nodes.map((node) => ({ data: this.nodeData(node) })),
      ...edges.map((edge) => ({
        data: { id: edge.id, source: edge.source, target: edge.target, flow: edge.flowMw, stressed: edge.stressed },
      })),
    ];
  }

  private nodeData(node: TopologyNode) {
    return {
      id: node.id,
      label: node.kind === 'hub' ? node.label : node.label.split(' ')[0],
      kind: node.kind,
      status: node.status,
    };
  }
}
