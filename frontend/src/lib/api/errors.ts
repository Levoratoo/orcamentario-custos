import { ApiError } from '@/lib/types';

export async function parseApiError(response: Response): Promise<ApiError> {
  try {
    const payload = (await response.json()) as ApiError;
    return {
      code: payload.code || 'HTTP_ERROR',
      message: payload.message || response.statusText,
      details: payload.details,
    };
  } catch {
    return { code: 'HTTP_ERROR', message: response.statusText };
  }
}

export function getErrorMessage(error: unknown, fallback = 'Falha inesperada') {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: string }).message);
  }
  return fallback;
}

export async function parseJsonSafe(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
