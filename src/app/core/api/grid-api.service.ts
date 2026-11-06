import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Activity, IncidentAction, IncidentMutation, PulseUpdate, WorkspaceSnapshot } from '../models/domain';

@Injectable({ providedIn: 'root' })
export class GridApiService {
  private readonly http = inject(HttpClient);

  bootstrap(): Observable<WorkspaceSnapshot> {
    return this.http.get<WorkspaceSnapshot>('/api/bootstrap');
  }

  pulse(): Observable<PulseUpdate> {
    return this.http.post<PulseUpdate>('/api/pulse', {});
  }

  transition(id: string, action: IncidentAction, note?: string): Observable<IncidentMutation> {
    return this.http.post<IncidentMutation>(`/api/incidents/${id}/${action}`, { note });
  }

  logInspection(facilityId: string, note: string): Observable<{ activity: Activity }> {
    return this.http.post<{ activity: Activity }>(`/api/facilities/${facilityId}/inspections`, { note });
  }
}
