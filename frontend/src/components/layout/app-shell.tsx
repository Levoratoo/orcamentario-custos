'use client';

import { ReactNode, useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { useAuth } from '@/components/providers/auth-provider';
import { usePathname, useRouter } from 'next/navigation';

export function AppShell({ children }: { children: ReactNode }) {
  const { isLoading, user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!user || user.role !== 'COORDINATOR') return;
    const allowed = pathname.startsWith('/planejamento') || pathname.startsWith('/minha-conta');
    if (!allowed) {
      router.replace('/planejamento');
    }
  }, [user, pathname, router]);

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar className="hidden lg:flex" />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-background px-5 py-6 lg:px-7">{children}</main>
      </div>
    </div>
  );
}
