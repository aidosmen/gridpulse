import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { GeoJSONSource, LngLatBounds, Map, NavigationControl, setWorkerUrl } from 'maplibre-gl';
import { Facility, FacilityStatus } from '../../core/models/domain';

const STATUS_COLOR: Record<FacilityStatus, string> = {
  nominal: '#3dcb8c',
  watch: '#e6b15a',
  degraded: '#f07178',
  offline: '#8b9bb0',
  maintenance: '#7eb6ff',
};

@Component({
  selector: 'app-facility-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="map-frame">
      <div #host class="map-host" [hidden]="failed()"></div>
      @if (failed()) {
        <div class="map-fallback">
          <p class="text-sm text-muted">The map style did not load. Choose a site from the list.</p>
          <ul class="map-fallback-list">
            @for (facility of facilities(); track facility.id) {
              <li>
                <button type="button" (click)="selected.emit(facility)">
                  {{ facility.name }}
                  <span class="text-muted">{{ facility.city }}</span>
                </button>
              </li>
            }
          </ul>
        </div>
      }
      @if (!failed()) {
        <ul class="sr-only">
          @for (facility of facilities(); track facility.id) {
            <li>
              <button type="button" (click)="selected.emit(facility)">Open {{ facility.name }}</button>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    .map-frame,
    .map-host,
    .map-fallback {
      height: 100%;
      min-height: 420px;
    }
    .map-fallback {
      overflow: auto;
      padding: 0.75rem;
    }
    .map-fallback-list {
      display: grid;
      gap: 0.35rem;
      margin-top: 0.75rem;
    }
    .map-fallback-list button {
      display: flex;
      width: 100%;
      justify-content: space-between;
      gap: 1rem;
      border: 0;
      border-radius: 0.8rem;
      background: transparent;
      padding: 0.55rem 0.7rem;
      text-align: left;
    }
    .map-fallback-list button:hover {
      background: rgba(62, 224, 197, 0.08);
    }
  `,
})
export class FacilityMapComponent implements OnDestroy {
  readonly facilities = input.required<Facility[]>();
  readonly selected = output<Facility>();
  readonly failed = signal(false);
  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('host');
  private map: Map | null = null;
  private ready = false;
  private fittedKey = '';
  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    afterNextRender(() => {
      const element = this.host().nativeElement;
      setWorkerUrl(new URL('maplibre-gl-worker.mjs', document.baseURI).href);
      const map = new Map({
        container: element,
        style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
        center: [8, 38],
        zoom: 1.35,
      });
      this.map = map;
      map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
      map.on('error', (event) => {
        if (this.ready) {
          return;
        }
        const message = event.error instanceof Error ? event.error.message : '';
        if (/style|worker|fetch|ajax/i.test(message)) {
          this.failMap();
        }
      });
      map.on('load', () => {
        if (this.failed() || this.map !== map) {
          return;
        }
        this.ready = true;
        map.addSource('facilities', { type: 'geojson', data: this.collection() });
        map.addLayer({
          id: 'facility-glow',
          type: 'circle',
          source: 'facilities',
          paint: {
            'circle-radius': 14,
            'circle-color': ['get', 'color'],
            'circle-opacity': 0.18,
          },
        });
        map.addLayer({
          id: 'facility-points',
          type: 'circle',
          source: 'facilities',
          paint: {
            'circle-radius': 6,
            'circle-color': ['get', 'color'],
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#071018',
          },
        });
        map.on('click', 'facility-points', (event) => {
          const feature = event.features?.[0];
          const id = feature?.properties?.['id'];
          const facility = this.facilities().find((item) => item.id === id);
          if (facility) {
            this.selected.emit(facility);
          }
        });
        map.on('mouseenter', 'facility-points', () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'facility-points', () => {
          map.getCanvas().style.cursor = '';
        });
        this.fitIfNeeded(true);
      });
      this.resizeObserver = new ResizeObserver(() => this.map?.resize());
      this.resizeObserver.observe(element);
    });

    effect(() => {
      const data = this.collection();
      if (!this.ready || !this.map || this.failed()) {
        return;
      }
      (this.map.getSource('facilities') as GeoJSONSource | undefined)?.setData(data);
      this.fitIfNeeded(false);
    });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.map?.remove();
    this.map = null;
  }

  private failMap(): void {
    if (this.failed()) {
      return;
    }
    this.failed.set(true);
    this.ready = false;
    this.map?.remove();
    this.map = null;
  }

  private collection(): Parameters<GeoJSONSource['setData']>[0] {
    return {
      type: 'FeatureCollection',
      features: this.facilities().map((facility) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [facility.longitude, facility.latitude] },
        properties: {
          id: facility.id,
          name: facility.name,
          color: STATUS_COLOR[facility.status],
        },
      })),
    };
  }

  private fitIfNeeded(force: boolean): void {
    const key = this.facilities()
      .map((facility) => facility.id)
      .join('|');
    if (!force && key === this.fittedKey) {
      return;
    }
    this.fittedKey = key;
    this.fit();
  }

  private fit(): void {
    const facilities = this.facilities();
    if (!this.map || facilities.length === 0) {
      return;
    }
    const bounds = new LngLatBounds();
    for (const facility of facilities) {
      bounds.extend([facility.longitude, facility.latitude]);
    }
    this.map.fitBounds(bounds, { padding: 48, maxZoom: 4.2, duration: 500 });
  }
}
