'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useSelectedScenario = useSelectedScenario;
const react_1 = require("react");
const STORAGE_KEY = 'printbag:scenario';
function useSelectedScenario() {
    const [scenarioId, setScenarioId] = (0, react_1.useState)(null);
    (0, react_1.useEffect)(() => {
        const stored = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
        if (stored) {
            setScenarioId(stored);
        }
    }, []);
    const updateScenario = (id) => {
        setScenarioId(id);
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(STORAGE_KEY, id);
        }
    };
    return { scenarioId, setScenarioId: updateScenario };
}
//# sourceMappingURL=use-selected-scenario.js.map