'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function BscPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/bsc/map');
  }, [router]);

  return null;
}
