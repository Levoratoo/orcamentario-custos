import { ApiError } from '@/lib/types';
import { parseApiError } from '@/lib/api/errors';

export interface ApiClientOptions {
  accessToken?: string | null;
  refresh?: () => Promise<string | null>;
}

export function createApiClient(options: ApiClientOptions) {
  const apiFetch = async <T>(path: string, init?: RequestInit, retry = true): Promise<T> => {
    const headers = new Headers(init?.headers);
    if (options.accessToken) {
      headers.set('Authorization', `Bearer ${options.accessToken}`);
    }
    if (!headers.has('Content-Type') && !(init?.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(`/api/backend${path}`, {
      ...init,
      headers,
    });

    if (response.status === 401 && retry && options.refresh) {
      const nextToken = await options.refresh();
      if (nextToken) {
        options.accessToken = nextToken;
        return apiFetch(path, init, false);
      }
    }

    if (!response.ok) {
      throw await parseApiError(response);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  };

  return { apiFetch };
}

export function isApiError(error: unknown): error is ApiError {
  return Boolean(error && typeof error === 'object' && 'code' in error && 'message' in error);
}
