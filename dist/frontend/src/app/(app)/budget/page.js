'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = BudgetPage;
const react_query_1 = require("@tanstack/react-query");
const scenario_selector_1 = require("@/components/shared/scenario-selector");
const use_api_client_1 = require("@/hooks/use-api-client");
const backend_1 = require("@/services/backend");
const use_selected_scenario_1 = require("@/hooks/use-selected-scenario");
const budget_grid_1 = require("@/features/budget/budget-grid");
const card_1 = require("@/components/ui/card");
const checkbox_1 = require("@/components/ui/checkbox");
const auth_provider_1 = require("@/components/providers/auth-provider");
const react_1 = require("react");
function BudgetPage() {
    const { apiFetch } = (0, use_api_client_1.useApiClient)();
    const { scenarioId } = (0, use_selected_scenario_1.useSelectedScenario)();
    const { user } = (0, auth_provider_1.useAuth)();
    const [onlyMine, setOnlyMine] = (0, react_1.useState)(true);
    const { data: costCenters = [] } = (0, react_query_1.useQuery)({
        queryKey: ['cost-centers'],
        queryFn: () => backend_1.backend.listCostCenters(apiFetch),
    });
    const { data: accounts = [] } = (0, react_query_1.useQuery)({
        queryKey: ['accounts'],
        queryFn: () => backend_1.backend.listAccounts(apiFetch),
    });
    const { data: scenarios = [] } = (0, react_query_1.useQuery)({
        queryKey: ['scenarios'],
        queryFn: () => backend_1.backend.listScenarios(apiFetch),
    });
    const selectedScenario = scenarios.find((item) => item.id === scenarioId);
    const readOnly = selectedScenario?.status !== 'DRAFT';
    const visibleCostCenters = onlyMine && user ? costCenters.filter((cc) => cc.ownerCoordinatorId === user.id) : costCenters;
    return (<div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Grid Orcamentario</h1>
          <p className="text-sm text-muted-foreground">Edite valores mes a mes por centro de custo.</p>
        </div>
        <scenario_selector_1.ScenarioSelector />
      </div>

      {user?.role === 'COORDINATOR' && (<div className="flex items-center gap-2 text-sm text-muted-foreground">
          <checkbox_1.Checkbox checked={onlyMine} onCheckedChange={(value) => setOnlyMine(Boolean(value))}/>
          Somente meus centros de custo
        </div>)}

      {selectedScenario && selectedScenario.status !== 'DRAFT' && (<card_1.Card className="rounded-2xl border border-amber-400/40 bg-amber-50/40 p-4 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          Este cenario esta em modo somente leitura ({selectedScenario.status}).
        </card_1.Card>)}

      {!scenarioId ? (<card_1.Card className="rounded-2xl p-6 text-center text-muted-foreground">
          Selecione um cenario para iniciar o planejamento.
        </card_1.Card>) : (<budget_grid_1.BudgetGrid scenarioId={scenarioId} costCenters={visibleCostCenters} accounts={accounts} readOnly={readOnly}/>)}
    </div>);
}
//# sourceMappingURL=page.js.map