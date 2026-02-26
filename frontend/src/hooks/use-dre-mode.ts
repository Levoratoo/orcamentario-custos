'use client';

import { useEffect, useState } from 'react';
import { DreMode } from '@/services/dre/types';

const STORAGE_KEY = 'printbag:dre-mode';
const SESSION_KEY = 'printbag:dre-mode:session';
const EVENT_NAME = 'printbag:dre-mode-change';

export function useDreMode() {
  const [mode, setMode] = useState<DreMode>('previsto');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.sessionStorage.getItem(SESSION_KEY) ?? window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'previsto' || stored === 'realizado' || stored === 'projetado' || stored === 'dre') {
      setMode(stored);
    }
    const handleModeChange = (event: Event) => {
      const next = (event as CustomEvent<DreMode>).detail;
      if (next === 'previsto' || next === 'realizado' || next === 'projetado' || next === 'dre') {
        setMode(next);
      }
    };
    window.addEventListener(EVENT_NAME, handleModeChange);
    return () => window.removeEventListener(EVENT_NAME, handleModeChange);
  }, []);

  const updateMode = (next: DreMode) => {
    setMode(next);
    if (typeof window !== 'undefined') {
      // Keep mode isolated per browser tab.
      window.sessionStorage.setItem(SESSION_KEY, next);
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: next }));
    }
  };

  return { mode, setMode: updateMode };
}
