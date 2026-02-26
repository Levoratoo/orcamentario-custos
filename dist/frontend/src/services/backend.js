"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.backend = void 0;
exports.backend = {
    me: (apiFetch) => apiFetch('/me'),
    listScenarios: (apiFetch) => apiFetch('/scenarios'),
    createScenario: (apiFetch, data) => apiFetch('/scenarios', { method: 'POST', body: JSON.stringify(data) }),
    updateScenarioStatus: (apiFetch, id, action) => apiFetch(`/scenarios/${id}/${action}`, { method: 'POST' }),
    listAccounts: (apiFetch) => apiFetch('/accounts'),
    createAccount: (apiFetch, data) => apiFetch('/accounts', { method: 'POST', body: JSON.stringify(data) }),
    listCostCenters: (apiFetch) => apiFetch('/cost-centers'),
    createCostCenter: (apiFetch, data) => apiFetch('/cost-centers', { method: 'POST', body: JSON.stringify(data) }),
    setCostCenterOwner: (apiFetch, id, ownerCoordinatorId) => apiFetch(`/cost-centers/${id}/owner`, { method: 'PUT', body: JSON.stringify({ ownerCoordinatorId }) }),
    listBudgetLines: (apiFetch, filters) => {
        const params = new URLSearchParams();
        if (filters.scenarioId)
            params.set('scenarioId', filters.scenarioId);
        if (filters.costCenterId)
            params.set('costCenterId', filters.costCenterId);
        if (filters.accountId)
            params.set('accountId', filters.accountId);
        if (filters.page)
            params.set('page', String(filters.page));
        if (filters.pageSize)
            params.set('pageSize', String(filters.pageSize));
        return apiFetch(`/budget-lines?${params.toString()}`);
    },
    createBudgetLine: (apiFetch, data) => apiFetch('/budget-lines', { method: 'POST', body: JSON.stringify(data) }),
    updateBudgetLine: (apiFetch, id, data) => apiFetch(`/budget-lines/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteBudgetLine: (apiFetch, id) => apiFetch(`/budget-lines/${id}`, { method: 'DELETE' }),
    bulkUpsert: (apiFetch, data) => apiFetch('/budget-lines/bulk-upsert', { method: 'POST', body: JSON.stringify(data) }),
    summary: (apiFetch, scenarioId, groupBy) => apiFetch(`/budget-lines/summary?scenarioId=${scenarioId}&groupBy=${groupBy}`),
    importBudgetLines: (apiFetch, file) => {
        const formData = new FormData();
        formData.append('file', file);
        return apiFetch('/imports/budget-lines', { method: 'POST', body: formData });
    },
};
//# sourceMappingURL=backend.js.map