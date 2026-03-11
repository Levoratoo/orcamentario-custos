import { User } from '@/lib/types';
import { portfolioDemoAuth } from '@/lib/portfolio-demo';

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
    return portfolioDemoAuth.login(identifier, password);
  },

  async refresh(): Promise<RefreshResponse> {
    return portfolioDemoAuth.refresh();
  },

  async logout(): Promise<void> {
    await portfolioDemoAuth.logout();
  },
};
