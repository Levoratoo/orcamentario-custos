import { ApiError } from '@/lib/types';
import { parseApiError } from '@/lib/api/errors';
import { portfolioDemoRequest } from '@/lib/portfolio-demo';

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
    try {
      return await portfolioDemoRequest<T>(path, { ...init, headers }, options.accessToken);
    } catch (error) {
      const isUnauthorizedError =
        Boolean(error && typeof error === 'object' && 'code' in error) &&
        ['UNAUTHORIZED', 'NO_REFRESH'].includes(String((error as ApiError).code));

      if (isUnauthorizedError && retry && options.refresh) {
        const nextToken = await options.refresh();
        if (nextToken) {
          options.accessToken = nextToken;
          return apiFetch(path, init, false);
        }
      }

      if (isApiError(error)) {
        throw error;
      }
      if (error instanceof Response) {
        throw await parseApiError(error);
      }
      throw { code: 'HTTP_ERROR', message: 'Falha inesperada no provider mock.' } as ApiError;
    }
  };

  return { apiFetch };
}

export function isApiError(error: unknown): error is ApiError {
  return Boolean(error && typeof error === 'object' && 'code' in error && 'message' in error);
}
