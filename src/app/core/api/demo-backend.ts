import { HttpErrorResponse, HttpRequest, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import {
  Activity,
  Asset,
  Facility,
  IncidentAction,
  OPERATOR,
  PulseUpdate,
  WorkspaceSnapshot,
} from '../models/domain';
import { describeTransition, makeActivity, MIN_NOTE_LENGTH, round1, transitionIncident } from '../domain/operations';
import { createSeed } from '../data/seed';

interface ApiSuccess {
  ok: true;
  status: number;
  body: unknown;
  delayMs: number;
}

interface ApiFailure {
  ok: false;
  status: number;
  message: string;
  delayMs: number;
}

@Injectable({ providedIn: 'root' })
export class DemoBackend {
  private snapshot: WorkspaceSnapshot = createSeed();

  handle(request: HttpRequest<unknown>): Observable<HttpResponse<unknown>> {
    const path = new URL(request.url, 'http://gridpulse.local').pathname;
    const result = this.dispatch(request.method, path, request.body);
    if (!result.ok) {
      return throwError(
        () =>
          new HttpErrorResponse({
            status: result.status,
            url: request.url,
            error: { message: result.message },
          }),
      ).pipe(delay(result.delayMs));
    }
    return of(new HttpResponse({ status: result.status, body: result.body })).pipe(delay(result.delayMs));
  }

  private dispatch(method: string, path: string, body: unknown): ApiSuccess | ApiFailure {
    if (method === 'GET' && path === '/api/bootstrap') {
      return { ok: true, status: 200, body: structuredClone(this.snapshot), delayMs: 180 };
    }
    if (method === 'POST' && path === '/api/pulse') {
      return { ok: true, status: 200, body: this.pulse(), delayMs: 0 };
    }

    const incidentMatch = path.match(/^\/api\/incidents\/([^/]+)\/(acknowledge|investigate|resolve|reopen)$/);
    if (method === 'POST' && incidentMatch) {
      const id = decodeURIComponent(incidentMatch[1] ?? '');
      const action = incidentMatch[2] as IncidentAction;
      return this.mutateIncident(id, action, body);
    }

    const inspectionMatch = path.match(/^\/api\/facilities\/([^/]+)\/inspections$/);
    if (method === 'POST' && inspectionMatch) {
      return this.logInspection(decodeURIComponent(inspectionMatch[1] ?? ''), body);
    }

    return { ok: false, status: 404, message: 'That operations endpoint does not exist.', delayMs: 40 };
  }

  private mutateIncident(id: string, action: IncidentAction, body: unknown): ApiSuccess | ApiFailure {
    const current = this.snapshot.incidents.find((incident) => incident.id === id);
    if (!current) {
      return { ok: false, status: 404, message: 'Incident was not found.', delayMs: 80 };
    }
    const note = typeof body === 'object' && body && 'note' in body ? String(body.note ?? '') : undefined;
    const at = new Date().toISOString();
    const result = transitionIncident(current, action, at, note);
    if (!result.ok || !result.incident) {
      return { ok: false, status: 409, message: result.message, delayMs: 80 };
    }
    const activity = makeActivity(`act-${id}-${at}`, result.incident, describeTransition(action, result.incident), OPERATOR.name, at);
    this.snapshot = {
      ...this.snapshot,
      incidents: this.snapshot.incidents.map((incident) => (incident.id === id ? result.incident ?? incident : incident)),
      activities: [activity, ...this.snapshot.activities],
    };
    return { ok: true, status: 200, body: { incident: result.incident, activity }, delayMs: 120 };
  }

  private logInspection(facilityId: string, body: unknown): ApiSuccess | ApiFailure {
    const facility = this.snapshot.facilities.find((item) => item.id === facilityId);
    if (!facility) {
      return { ok: false, status: 404, message: 'Facility was not found.', delayMs: 80 };
    }
    const note = typeof body === 'object' && body && 'note' in body ? String(body.note ?? '').trim() : '';
    if (note.length < MIN_NOTE_LENGTH) {
      return { ok: false, status: 409, message: 'Inspection notes need at least 8 characters.', delayMs: 80 };
    }
    const at = new Date().toISOString();
    const activity: Activity = {
      id: `inspection-${facilityId}-${at}`,
      at,
      actor: OPERATOR.name,
      facilityId,
      message: `Inspection logged. ${note}`,
    };
    this.snapshot = { ...this.snapshot, activities: [activity, ...this.snapshot.activities] };
    return { ok: true, status: 200, body: { activity }, delayMs: 120 };
  }

  private pulse(): PulseUpdate {
    const previousLoad = new Map(this.snapshot.facilities.map((facility) => [facility.id, facility.loadMw]));
    const tails: Record<string, number> = {};
    const facilities: Facility[] = this.snapshot.facilities.map((facility) => {
      if (facility.status === 'offline') {
        tails[facility.id] = 0;
        return facility;
      }
      const drift = (Math.random() - 0.48) * facility.capacityMw * 0.01;
      const loadMw = round1(clamp(facility.loadMw + drift, 0, facility.capacityMw * 0.98));
      tails[facility.id] = loadMw;
      return { ...facility, loadMw };
    });
    const series = { ...this.snapshot.series };
    for (const facility of facilities) {
      const bundle = series[facility.id];
      if (!bundle) {
        continue;
      }
      const actual = bundle.actual.slice();
      actual[actual.length - 1] = facility.loadMw;
      series[facility.id] = { ...bundle, actual };
    }
    const assets = this.snapshot.assets.map((asset) => scaleAsset(asset, previousLoad, facilities));
    this.snapshot = { ...this.snapshot, facilities, series, assets };
    return { facilities: structuredClone(facilities), assets: structuredClone(assets), tails };
  }
}

function scaleAsset(asset: Asset, previousLoad: Map<string, number>, facilities: Facility[]): Asset {
  const facility = facilities.find((item) => item.id === asset.facilityId);
  const before = previousLoad.get(asset.facilityId) ?? 0;
  if (!facility || facility.status === 'offline' || before <= 0) {
    return asset;
  }
  return { ...asset, loadPct: round1(clamp((asset.loadPct * facility.loadMw) / before, 0, 99)) };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
