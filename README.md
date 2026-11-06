# GridPulse

Energy infrastructure intelligence for operations managers, energy analysts, and facility engineers. GridPulse is a fictional enterprise workspace: it monitors demand, site health, network flow, and incident response across a portfolio of synthetic facilities.

## Stack

- Angular 22, standalone components, signals, zoneless change detection, strict TypeScript
- Lazy feature routes and `HttpClient` against an in-browser operations API
- Tailwind CSS design system, including tables, dialogs, sliders, switches, and toasts
- Apache ECharts via ngx-echarts
- MapLibre GL for the facility map
- Cytoscape.js for network topology
- Angular CDK overlay for global search
- Lucide icon nodes rendered in a small icon component (`lucide-angular` does not yet support Angular 22)
- Vitest unit tests and Playwright end-to-end tests

Node `^22.22.3`, `^24.15.0`, or newer is required. See `.nvmrc`.

## Run

```bash
npm install
npm start
```

Open `http://127.0.0.1:4200`. The workspace starts in demo mode: synthetic operations data, no login, and no remote backend.

```bash
npm test
npm run e2e
```

Playwright needs Chromium: `npx playwright install chromium`.

## Product workflows

- Filter the operating region from the header. Overview, infrastructure, incidents, topology, analytics, and settings all use that region.
- The 24h / 7d / 30d control is the chart horizon. It changes demand, site-load, energy, and comparison charts. It does not change the live demand KPI, incident queue, or topology. The demand KPI compares the latest hour with the same hour yesterday.
- Search facilities and incidents from the header and jump directly to them.
- Review site load, assets, and history. Log an inspection note onto the facility activity record. The note stays in the form until the save succeeds.
- Acknowledge an incident, start an investigation, resolve it with a note, or reopen it. The address bar id is the incident that receives the action, even when filters hide it from the queue. Invalid transitions are rejected.
- Adjust load and health thresholds in Settings. A nominal or watch site that crosses a threshold is shown as degraded everywhere: badges, the map, alerting counts, and topology stress. Alerting toasts use the same limits. Preferences stay in this browser.

Status badges, map colors, alerting counts, and topology edges are projections of the current facility load, health, and operating status. Asset load moves with the site load on each live pulse. Topology flow is derived from that same load rather than stored as a separate snapshot.

Demo data is generated in `src/app/core/data/seed.ts` and served by `DemoBackend` through an HTTP interceptor. The UI calls `/api/*` the same way it would call a remote service. Nothing is sent off the machine.

## Architecture

```text
src/app
  core/models     domain types
  core/domain     pure rules: alerting, presentation, incident selection, chart windows, topology projection
  core/data       synthetic seed
  core/api        HttpClient service and the in-memory demo backend
  core/state      signal stores for operations, workspace, and preferences
  layout          shell, sidebar, header
  features        overview, infrastructure, topology, incidents, analytics, settings
  shared          icons, panels, charts
```

`OperationsStore` holds the latest snapshot and exposes `facilitiesView`, which applies the current thresholds before pages render. Commands return observables and clear their pending flag per facility or incident. Pages clear forms only after a successful result.

## Deployment

`npm run build` writes a static app to `dist/gridpulse/browser`. Host it with SPA fallback to `index.html`. The MapLibre worker is copied to `maplibre-gl-worker.mjs` and loaded relative to `<base href>`, so a non-root base path works. The facility map still requests the CARTO dark style and tiles; if that request fails, the overview shows a keyboard-accessible site list instead.

This repository is licensed under the MIT license. See `LICENSE`. Third-party packages keep their own licenses.
