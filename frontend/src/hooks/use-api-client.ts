'use client';

import { useAuth } from '@/components/providers/auth-provider';
import { createApiClient } from '@/lib/api/client';

export function useApiClient() {
  const { accessToken, refresh } = useAuth();
  return createApiClient({ accessToken, refresh });
}
