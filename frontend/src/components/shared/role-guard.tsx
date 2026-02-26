'use client';

import { ReactNode } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { Card } from '@/components/ui/card';
import { Role } from '@/lib/types';

interface RoleGuardProps {
  roles: Role[];
  children: ReactNode;
}

export function RoleGuard({ roles, children }: RoleGuardProps) {
  const { user } = useAuth();
  if (!user) return null;
  if (!roles.includes(user.role)) {
    return (
      <Card className="rounded-2xl p-6 text-center text-muted-foreground">
        Voce nao tem permissao para acessar esta area.
      </Card>
    );
  }
  return <>{children}</>;
}
