'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = DashboardPage;
const react_1 = require("react");
const react_query_1 = require("@tanstack/react-query");
const backend_1 = require("@/services/backend");
const use_api_client_1 = require("@/hooks/use-api-client");
const use_selected_scenario_1 = require("@/hooks/use-selected-scenario");
const scenario_selector_1 = require("@/components/shared/scenario-selector");
const card_1 = require("@/components/ui/card");
const badge_1 = require("@/components/ui/badge");
const formatters_1 = require("@/lib/formatters");
const auth_provider_1 = require("@/components/providers/auth-provider");
const recharts_1 = require("recharts");
const button_1 = require("@/components/ui/button");
const sonner_1 = require("sonner");
const errors_1 = require("@/lib/api/errors");
function DashboardPage() {
    const { apiFetch } = (0, use_api_client_1.useApiClient)();
    const { scenarioId } = (0, use_selected_scenario_1.useSelectedScenario)();
    const { user } = (0, auth_provider_1.useAuth)();
    const { data: scenarios = [] } = (0, react_query_1.useQuery)({ queryKey: ['scenarios'], queryFn: () => backend_1.backend.listScenarios(apiFetch) });
    const selected = scenarios.find((item) => item.id === scenarioId);
    const { data: summaryByCostCenter } = (0, react_query_1.useQuery)({
        queryKey: ['summary', scenarioId, 'costCenter'],
        queryFn: () => backend_1.backend.summary(apiFetch, scenarioId, 'costCenter'),
        enabled: Boolean(scenarioId),
    });
    const { data: summaryByAccount } = (0, react_query_1.useQuery)({
        queryKey: ['summary', scenarioId, 'account'],
        queryFn: () => backend_1.backend.summary(apiFetch, scenarioId, 'account'),
        enabled: Boolean(scenarioId),
    });
    const totals = (0, react_1.useMemo)(() => {
        const items = summaryByCostCenter?.items || [];
        const totalByMonth = formatters_1.monthKeys.reduce((acc, key) => {
            acc[key] = items.reduce((sum, item) => sum + (0, formatters_1.parseDecimal)(item.monthlyValues[key]), 0);
            return acc;
        }, {});
        const annualTotal = Object.values(totalByMonth).reduce((sum, val) => sum + val, 0);
        return { totalByMonth, annualTotal };
    }, [summaryByCostCenter]);
    const topCostCenters = (0, react_1.useMemo)(() => {
        const items = summaryByCostCenter?.items || [];
        return [...items]
            .map((item) => ({
            name: item.groupName,
            total: (0, formatters_1.parseDecimal)(item.total),
        }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);
    }, [summaryByCostCenter]);
    const topAccounts = (0, react_1.useMemo)(() => {
        const items = summaryByAccount?.items || [];
        return [...items]
            .map((item) => ({
            name: item.groupName,
            total: (0, formatters_1.parseDecimal)(item.total),
        }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);
    }, [summaryByAccount]);
    const lineData = formatters_1.monthKeys.map((key) => ({
        month: key,
        total: totals.totalByMonth[key] || 0,
    }));
    const barData = topCostCenters.map((item) => ({
        name: item.name,
        total: item.total,
    }));
    const handleStatus = async (action) => {
        if (!selected)
            return;
        try {
            await backend_1.backend.updateScenarioStatus(apiFetch, selected.id, action);
            sonner_1.toast.success('Status atualizado');
        }
        catch (error) {
            sonner_1.toast.error((0, errors_1.getErrorMessage)(error, 'Falha ao atualizar'));
        }
    };
    return (<div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visao executiva do cenario selecionado.</p>
        </div>
        <scenario_selector_1.ScenarioSelector />
      </div>

      {selected && (<div className="flex flex-wrap items-center gap-3">
          <badge_1.Badge variant="secondary">Status: {selected.status}</badge_1.Badge>
          {(user?.role === 'ADMIN' || user?.role === 'CONTROLLER') && (<div className="flex flex-wrap gap-2">
              <button_1.Button size="sm" variant="outline" onClick={() => handleStatus('submit')}>
                Submeter
              </button_1.Button>
              <button_1.Button size="sm" variant="outline" onClick={() => handleStatus('reopen')}>
                Reabrir
              </button_1.Button>
              <button_1.Button size="sm" variant="outline" onClick={() => handleStatus('approve')}>
                Aprovar
              </button_1.Button>
              <button_1.Button size="sm" variant="outline" onClick={() => handleStatus('lock')}>
                Travar
              </button_1.Button>
            </div>)}
        </div>)}

      {!selected && (<card_1.Card className="rounded-2xl p-6 text-center text-muted-foreground">
          Selecione um cenario para visualizar os indicadores.
        </card_1.Card>)}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <card_1.Card className="rounded-2xl">
          <card_1.CardHeader>
            <card_1.CardTitle>Total anual</card_1.CardTitle>
          </card_1.CardHeader>
          <card_1.CardContent className="text-2xl font-semibold">
            {(0, formatters_1.formatCurrencyBRL)(totals.annualTotal)}
          </card_1.CardContent>
        </card_1.Card>
        {user?.role === 'COORDINATOR' && (<card_1.Card className="rounded-2xl">
            <card_1.CardHeader>
              <card_1.CardTitle>Meu escopo</card_1.CardTitle>
            </card_1.CardHeader>
            <card_1.CardContent className="text-2xl font-semibold">
              {(0, formatters_1.formatCurrencyBRL)(totals.annualTotal)}
            </card_1.CardContent>
          </card_1.Card>)}
        <card_1.Card className="rounded-2xl">
          <card_1.CardHeader>
            <card_1.CardTitle>Total mes atual</card_1.CardTitle>
          </card_1.CardHeader>
          <card_1.CardContent className="text-2xl font-semibold">
            {(0, formatters_1.formatCurrencyBRL)(totals.totalByMonth[formatters_1.monthKeys[new Date().getMonth()]] || 0)}
          </card_1.CardContent>
        </card_1.Card>
        <card_1.Card className="rounded-2xl">
          <card_1.CardHeader>
            <card_1.CardTitle>Top centros de custo</card_1.CardTitle>
          </card_1.CardHeader>
          <card_1.CardContent className="space-y-1 text-sm">
            {topCostCenters.map((item) => (<div key={item.name} className="flex items-center justify-between">
                <span>{item.name}</span>
                <span className="font-medium">{(0, formatters_1.formatCurrencyBRL)(item.total)}</span>
              </div>))}
          </card_1.CardContent>
        </card_1.Card>
        <card_1.Card className="rounded-2xl">
          <card_1.CardHeader>
            <card_1.CardTitle>Top contas</card_1.CardTitle>
          </card_1.CardHeader>
          <card_1.CardContent className="space-y-1 text-sm">
            {topAccounts.map((item) => (<div key={item.name} className="flex items-center justify-between">
                <span>{item.name}</span>
                <span className="font-medium">{(0, formatters_1.formatCurrencyBRL)(item.total)}</span>
              </div>))}
          </card_1.CardContent>
        </card_1.Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <card_1.Card className="rounded-2xl">
          <card_1.CardHeader>
            <card_1.CardTitle>Total por mes</card_1.CardTitle>
          </card_1.CardHeader>
          <card_1.CardContent className="h-64">
            <recharts_1.ResponsiveContainer width="100%" height="100%">
              <recharts_1.AreaChart data={lineData}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.6}/>
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <recharts_1.CartesianGrid strokeDasharray="3 3"/>
                <recharts_1.XAxis dataKey="month"/>
                <recharts_1.YAxis tickFormatter={(value) => `R$ ${value / 1000}k`}/>
                <recharts_1.Tooltip formatter={(value) => (0, formatters_1.formatCurrencyBRL)(value)}/>
                <recharts_1.Area type="monotone" dataKey="total" stroke="#22c55e" fillOpacity={1} fill="url(#colorTotal)"/>
              </recharts_1.AreaChart>
            </recharts_1.ResponsiveContainer>
          </card_1.CardContent>
        </card_1.Card>
        <card_1.Card className="rounded-2xl">
          <card_1.CardHeader>
            <card_1.CardTitle>Top centros de custo</card_1.CardTitle>
          </card_1.CardHeader>
          <card_1.CardContent className="h-64">
            <recharts_1.ResponsiveContainer width="100%" height="100%">
              <recharts_1.BarChart data={barData}>
                <recharts_1.CartesianGrid strokeDasharray="3 3"/>
                <recharts_1.XAxis dataKey="name" hide/>
                <recharts_1.YAxis tickFormatter={(value) => `R$ ${value / 1000}k`}/>
                <recharts_1.Tooltip formatter={(value) => (0, formatters_1.formatCurrencyBRL)(value)}/>
                <recharts_1.Bar dataKey="total" fill="#16a34a" radius={[6, 6, 0, 0]}/>
              </recharts_1.BarChart>
            </recharts_1.ResponsiveContainer>
          </card_1.CardContent>
        </card_1.Card>
      </div>
    </div>);
}
//# sourceMappingURL=page.js.map