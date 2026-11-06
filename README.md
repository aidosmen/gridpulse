# GridPulse

**Live demo:** [https://soft-torrone-08049a.netlify.app/overview](https://soft-torrone-08049a.netlify.app/overview)

GridPulse is an Angular 22 enterprise infrastructure monitoring demo. It is a dark, high-density operations workspace for demand, site health, network flow, and incident response across a fictional energy portfolio. Operations managers, energy analysts, and facility engineers can filter a region, inspect a site, follow an incident through its workflow, and see the same facility state on the map, badges, and topology graph.

All facility, incident, and telemetry data is synthetic. No real backend is connected. The browser answers `/api/*` locally, and nothing is sent off the machine.

## Screenshots

This repository does not include interface screenshots. The [live demo](https://soft-torrone-08049a.netlify.app/overview) is the current production build and shows Overview, Infrastructure, Network Topology, Incidents, Analytics, and Settings.

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

## Features

- **Overview.** Demand, reserve, and alerting KPIs, a demand-against-forecast chart, and a MapLibre map of the visible facilities.
- **Infrastructure.** Filterable site register and a facility page with assets, site-load history, open incidents, and inspection notes.
- **Network topology.** Cytoscape graph whose flows and stress are derived from the current facility load and status.
- **Incidents.** Acknowledge, investigate, resolve, and reopen. The incident in the URL is the one that receives the action.
- **Analytics.** Regional energy and a side-by-side facility comparison for the selected chart horizon.
- **Settings.** Load and health thresholds stored in this browser. A nominal or watch site that crosses a threshold is shown as degraded on badges, the map, alerting counts, and topology.
- **Shell.** Region filter, 24h / 7d / 30d chart horizon, global search, and a responsive navigation drawer.

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

`npm run build` runs the Angular production build (`ng build`; production is the default configuration). There is no server bundle. The browser `index.html` is written to `dist/gridpulse/browser`, next to the hashed scripts and styles, `favicon.svg`, `favicon.ico`, and `maplibre-gl-worker.mjs`.

Netlify settings live in `netlify.toml`:

- Build command: `npm run build`
- Publish directory: `dist/gridpulse/browser`
- Node.js `22.23.4`, the same version as `.nvmrc`
- Every path that is not a real file rewrites to `/index.html` with status 200, so a direct visit or refresh of `/overview`, `/infrastructure`, `/infrastructure/:facilityId`, `/topology`, `/incidents`, `/analytics`, or `/settings` loads the app
- Pretty URLs are off, so those routes are not redirected to a trailing slash

`<base href="/">` matches a site deployed at the domain root. Favicons and the MapLibre worker are requested from that root (`/favicon.svg`, `/maplibre-gl-worker.mjs`). The worker response is served as `text/javascript`. The facility map still requests the CARTO dark style and tiles; if that request fails, the overview shows a keyboard-accessible site list instead.

Demo mode needs no backend, environment variables, or secrets. `/api/*` is answered in the browser by `DemoBackend`. Connect this repository in Netlify and leave the build command and publish directory from `netlify.toml`.

This repository is licensed under the MIT license. See `LICENSE`. Third-party packages keep their own licenses.
