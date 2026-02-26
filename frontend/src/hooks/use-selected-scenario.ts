'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'printbag:scenario';
const SESSION_KEY = 'printbag:scenario:session';
const EVENT_NAME = 'printbag:scenario-change';

export function useSelectedScenario() {
  const [scenarioId, setScenarioId] = useState<string | null>(null);

  useEffect(() => {
    const readFromStorage = () => {
      const stored =
        typeof window !== 'undefined'
          ? window.sessionStorage.getItem(SESSION_KEY) ?? window.localStorage.getItem(STORAGE_KEY)
          : null;
      if (stored) {
        setScenarioId(stored);
      }
    };

    readFromStorage();

    const handleCustom = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (detail) {
        setScenarioId(detail);
      }
    };

    window.addEventListener(EVENT_NAME, handleCustom);
    return () => {
      window.removeEventListener(EVENT_NAME, handleCustom);
    };
  }, []);

  const updateScenario = (id: string) => {
    setScenarioId(id);
    if (typeof window !== 'undefined') {
      // Keep per-tab navigation/context independent.
      window.sessionStorage.setItem(SESSION_KEY, id);
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: id }));
    }
  };

  return { scenarioId, setScenarioId: updateScenario };
}
