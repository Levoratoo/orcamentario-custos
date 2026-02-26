'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ImportOrcamentoCoordenadoresPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/planejamento');
  }, [router]);

  return null;
}
