'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DreExercicioProjetadoPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dre/analises');
  }, [router]);

  return null;
}
