'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScenarioSelector = ScenarioSelector;
const react_1 = require("react");
const react_query_1 = require("@tanstack/react-query");
const lucide_react_1 = require("lucide-react");
const popover_1 = require("@/components/ui/popover");
const button_1 = require("@/components/ui/button");
const command_1 = require("@/components/ui/command");
const utils_1 = require("@/lib/utils");
const backend_1 = require("@/services/backend");
const use_api_client_1 = require("@/hooks/use-api-client");
const use_selected_scenario_1 = require("@/hooks/use-selected-scenario");
function ScenarioSelector() {
    const { apiFetch } = (0, use_api_client_1.useApiClient)();
    const { scenarioId, setScenarioId } = (0, use_selected_scenario_1.useSelectedScenario)();
    const { data = [] } = (0, react_query_1.useQuery)({ queryKey: ['scenarios'], queryFn: () => backend_1.backend.listScenarios(apiFetch) });
    const selected = (0, react_1.useMemo)(() => data.find((item) => item.id === scenarioId) || data[0], [data, scenarioId]);
    (0, react_1.useEffect)(() => {
        if (!scenarioId && selected) {
            setScenarioId(selected.id);
        }
    }, [scenarioId, selected, setScenarioId]);
    return (<popover_1.Popover>
      <popover_1.PopoverTrigger asChild>
        <button_1.Button variant="outline" className="w-[240px] justify-between">
          <span>{selected ? selected.name : 'Selecione um cenario'}</span>
          <lucide_react_1.ChevronsUpDown className="h-4 w-4 opacity-60"/>
        </button_1.Button>
      </popover_1.PopoverTrigger>
      <popover_1.PopoverContent className="w-[260px] p-0" align="start">
        <command_1.Command>
          <command_1.CommandInput placeholder="Buscar cenario"/>
          <command_1.CommandList>
            <command_1.CommandEmpty>Nenhum cenario</command_1.CommandEmpty>
            <command_1.CommandGroup>
              {data.map((item) => (<command_1.CommandItem key={item.id} value={item.name} onSelect={() => setScenarioId(item.id)}>
                  <lucide_react_1.Check className={(0, utils_1.cn)('mr-2 h-4 w-4', item.id === selected?.id ? 'opacity-100' : 'opacity-0')}/>
                  {item.name}
                </command_1.CommandItem>))}
            </command_1.CommandGroup>
          </command_1.CommandList>
        </command_1.Command>
      </popover_1.PopoverContent>
    </popover_1.Popover>);
}
//# sourceMappingURL=scenario-selector.js.map