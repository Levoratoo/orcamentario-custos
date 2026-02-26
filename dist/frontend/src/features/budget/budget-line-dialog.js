'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BudgetLineDialog = BudgetLineDialog;
const react_1 = require("react");
const react_query_1 = require("@tanstack/react-query");
const use_api_client_1 = require("@/hooks/use-api-client");
const backend_1 = require("@/services/backend");
const formatters_1 = require("@/lib/formatters");
const button_1 = require("@/components/ui/button");
const dialog_1 = require("@/components/ui/dialog");
const input_1 = require("@/components/ui/input");
const select_1 = require("@/components/ui/select");
const textarea_1 = require("@/components/ui/textarea");
const sonner_1 = require("sonner");
function BudgetLineDialog({ scenarioId, costCenters, accounts }) {
    const { apiFetch } = (0, use_api_client_1.useApiClient)();
    const queryClient = (0, react_query_1.useQueryClient)();
    const [open, setOpen] = (0, react_1.useState)(false);
    const [costCenterId, setCostCenterId] = (0, react_1.useState)('');
    const [accountId, setAccountId] = (0, react_1.useState)('');
    const [description, setDescription] = (0, react_1.useState)('');
    const [driverType, setDriverType] = (0, react_1.useState)('FIXED');
    const [assumptions, setAssumptions] = (0, react_1.useState)('');
    const [value, setValue] = (0, react_1.useState)('0.00');
    const mutation = (0, react_query_1.useMutation)({
        mutationFn: () => backend_1.backend.createBudgetLine(apiFetch, {
            scenarioId,
            costCenterId,
            accountId,
            description,
            driverType,
            assumptions,
            monthlyValues: (0, formatters_1.normalizeMonthly)(Object.fromEntries(formatters_1.monthKeys.map((key) => [key, value]))),
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['budget-lines', scenarioId] });
            sonner_1.toast.success('Linha criada');
            setOpen(false);
        },
    });
    return (<dialog_1.Dialog open={open} onOpenChange={setOpen}>
      <dialog_1.DialogTrigger asChild>
        <button_1.Button size="sm">Adicionar Linha</button_1.Button>
      </dialog_1.DialogTrigger>
      <dialog_1.DialogContent className="sm:max-w-lg">
        <dialog_1.DialogHeader>
          <dialog_1.DialogTitle>Nova linha orcamentaria</dialog_1.DialogTitle>
        </dialog_1.DialogHeader>
        <div className="space-y-3">
          <select_1.Select value={costCenterId} onValueChange={setCostCenterId}>
            <select_1.SelectTrigger>
              <select_1.SelectValue placeholder="Centro de Custo"/>
            </select_1.SelectTrigger>
            <select_1.SelectContent>
              {costCenters.map((cc) => (<select_1.SelectItem key={cc.id} value={cc.id}>
                  {cc.code} - {cc.name}
                </select_1.SelectItem>))}
            </select_1.SelectContent>
          </select_1.Select>
          <select_1.Select value={accountId} onValueChange={setAccountId}>
            <select_1.SelectTrigger>
              <select_1.SelectValue placeholder="Conta"/>
            </select_1.SelectTrigger>
            <select_1.SelectContent>
              {accounts.map((acc) => (<select_1.SelectItem key={acc.id} value={acc.id}>
                  {acc.code} - {acc.name}
                </select_1.SelectItem>))}
            </select_1.SelectContent>
          </select_1.Select>
          <input_1.Input placeholder="Descricao" value={description} onChange={(event) => setDescription(event.target.value)}/>
          <select_1.Select value={driverType} onValueChange={setDriverType}>
            <select_1.SelectTrigger>
              <select_1.SelectValue placeholder="Driver"/>
            </select_1.SelectTrigger>
            <select_1.SelectContent>
              {['FIXED', 'HEADCOUNT', 'PERCENT_PAYROLL', 'CONTRACT', 'CONSUMPTION', 'OTHER'].map((item) => (<select_1.SelectItem key={item} value={item}>{item}</select_1.SelectItem>))}
            </select_1.SelectContent>
          </select_1.Select>
          <textarea_1.Textarea placeholder="Premissas" value={assumptions} onChange={(event) => setAssumptions(event.target.value)}/>
          <input_1.Input placeholder="Valor padrao (todos meses)" value={value} onChange={(event) => setValue(event.target.value)}/>
        </div>
        <div className="mt-4 flex justify-end">
          <button_1.Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !costCenterId || !accountId}>
            {mutation.isPending ? 'Salvando...' : 'Salvar'}
          </button_1.Button>
        </div>
      </dialog_1.DialogContent>
    </dialog_1.Dialog>);
}
//# sourceMappingURL=budget-line-dialog.js.map