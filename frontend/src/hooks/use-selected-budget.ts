'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'printbag:budget';
const SESSION_KEY = 'printbag:budget:session';
const EVENT_NAME = 'printbag:budget-change';

export function useSelectedBudget() {
  const [budgetId, setBudgetId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage.getItem(SESSION_KEY) ?? window.localStorage.getItem(STORAGE_KEY);
  });

  useEffect(() => {
    const readFromStorage = () => {
      const stored =
        typeof window !== 'undefined'
          ? window.sessionStorage.getItem(SESSION_KEY) ?? window.localStorage.getItem(STORAGE_KEY)
          : null;
      if (stored) {
        setBudgetId(stored);
      }
    };

    readFromStorage();

    const handleCustom = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (detail) {
        setBudgetId(detail);
      }
    };

    window.addEventListener(EVENT_NAME, handleCustom);
    return () => {
      window.removeEventListener(EVENT_NAME, handleCustom);
    };
  }, []);

  const updateBudget = (id: string) => {
    setBudgetId(id);
    if (typeof window !== 'undefined') {
      // Keep per-tab navigation/context independent.
      window.sessionStorage.setItem(SESSION_KEY, id);
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: id }));
    }
  };

  return { budgetId, setBudgetId: updateBudget };
}
