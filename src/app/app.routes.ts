import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./layout/shell.component').then((module) => module.ShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      {
        path: 'overview',
        loadComponent: () => import('./features/overview/overview.page').then((module) => module.OverviewPage),
        data: { title: 'Overview', kicker: 'System posture' },
      },
      {
        path: 'infrastructure',
        loadComponent: () =>
          import('./features/infrastructure/infrastructure.page').then((module) => module.InfrastructurePage),
        data: { title: 'Infrastructure', kicker: 'Sites and assets' },
      },
      {
        path: 'infrastructure/:facilityId',
        loadComponent: () =>
          import('./features/infrastructure/facility-detail.page').then((module) => module.FacilityDetailPage),
        data: { title: 'Facility', kicker: 'Asset register' },
      },
      {
        path: 'topology',
        loadComponent: () => import('./features/topology/topology.page').then((module) => module.TopologyPage),
        data: { title: 'Network Topology', kicker: 'Flow and stress' },
      },
      {
        path: 'incidents',
        loadComponent: () => import('./features/incidents/incidents.page').then((module) => module.IncidentsPage),
        data: { title: 'Incidents', kicker: 'Response queue' },
      },
      {
        path: 'analytics',
        loadComponent: () => import('./features/analytics/analytics.page').then((module) => module.AnalyticsPage),
        data: { title: 'Analytics', kicker: 'Energy and drift' },
      },
      {
        path: 'settings',
        loadComponent: () => import('./features/settings/settings.page').then((module) => module.SettingsPage),
        data: { title: 'Settings', kicker: 'Operating envelope' },
      },
    ],
  },
  { path: '**', redirectTo: 'overview' },
];
