import { User } from '@/lib/types';
import { parseJsonSafe } from '@/lib/api/errors';

interface LoginResponse {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshTokenExpiresIn: number;
  user: User | null;
}

interface RefreshResponse {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshTokenExpiresIn: number;
  user: User | null;
}

export const apiAuth = {
  async login(identifier: string, password: string): Promise<LoginResponse> {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    });

    const payload = await parseJsonSafe(response);
    if (!response.ok) {
      throw payload || { message: response.statusText || 'Falha ao autenticar' };
    }

    return payload as LoginResponse;
  },

  async refresh(): Promise<RefreshResponse> {
    const response = await fetch('/api/auth/refresh', { method: 'POST' });
    const payload = await parseJsonSafe(response);
    if (!response.ok) {
      throw payload || { message: response.statusText || 'Falha ao renovar' };
    }
    return payload as RefreshResponse;
  },

  async logout(): Promise<void> {
    await fetch('/api/auth/logout', { method: 'POST' });
  },
};
