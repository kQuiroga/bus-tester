import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from './api-config';

/**
 * Thin shared wrapper around HttpClient (base URL) and problem+json error mapping, so the
 * connect/send/messages feature components don't each repeat the same plumbing.
 */
@Injectable({ providedIn: 'root' })
export class ApiClientService {
  private readonly http = inject(HttpClient);

  post<T>(path: string, body: unknown) {
    return this.http.post<T>(`${API_BASE_URL}${path}`, body);
  }

  delete<T>(path: string) {
    return this.http.delete<T>(`${API_BASE_URL}${path}`);
  }

  /** Extracts the problem+json `detail` field the API returns, falling back otherwise. */
  static errorDetail(err: unknown, fallback: string): string {
    if (err && typeof err === 'object' && 'error' in err) {
      const inner = (err as { error?: unknown }).error;
      if (inner && typeof inner === 'object' && 'detail' in inner) {
        const detail = (inner as { detail?: unknown }).detail;
        if (typeof detail === 'string' && detail.length > 0) {
          return detail;
        }
      }
    }

    return fallback;
  }
}
