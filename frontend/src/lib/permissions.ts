import { Role } from '@/lib/types';

export function canEditSponsors(role?: Role) {
  return role === 'ADMIN';
}
