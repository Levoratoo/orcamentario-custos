'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AccountsPage;
const react_1 = require("react");
const react_query_1 = require("@tanstack/react-query");
const backend_1 = require("@/services/backend");
const use_api_client_1 = require("@/hooks/use-api-client");
const card_1 = require("@/components/ui/card");
const role_guard_1 = require("@/components/shared/role-guard");
const button_1 = require("@/components/ui/button");
const table_1 = require("@/components/ui/table");
const dialog_1 = require("@/components/ui/dialog");
const input_1 = require("@/components/ui/input");
const sonner_1 = require("sonner");
function AccountsPage() {
    const { apiFetch } = (0, use_api_client_1.useApiClient)();
    const queryClient = (0, react_query_1.useQueryClient)();
    const [open, setOpen] = (0, react_1.useState)(false);
    const [code, setCode] = (0, react_1.useState)('');
    const [name, setName] = (0, react_1.useState)('');
    const [category, setCategory] = (0, react_1.useState)('');
    const { data = [] } = (0, react_query_1.useQuery)({ queryKey: ['accounts'], queryFn: () => backend_1.backend.listAccounts(apiFetch) });
    const createMutation = (0, react_query_1.useMutation)({
        mutationFn: () => backend_1.backend.createAccount(apiFetch, { code, name, category, active: true }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
            sonner_1.toast.success('Conta criada');
            setOpen(false);
        },
    });
    return (<role_guard_1.RoleGuard roles={['ADMIN', 'CONTROLLER']}>
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Contas</h1>
          <p className="text-sm text-muted-foreground">Cadastro de contas gerenciais.</p>
        </div>
        <dialog_1.Dialog open={open} onOpenChange={setOpen}>
          <dialog_1.DialogTrigger asChild>
            <button_1.Button>Criar conta</button_1.Button>
          </dialog_1.DialogTrigger>
          <dialog_1.DialogContent>
            <dialog_1.DialogHeader>
              <dialog_1.DialogTitle>Nova conta</dialog_1.DialogTitle>
            </dialog_1.DialogHeader>
            <div className="space-y-3">
              <input_1.Input placeholder="Codigo" value={code} onChange={(event) => setCode(event.target.value)}/>
              <input_1.Input placeholder="Nome" value={name} onChange={(event) => setName(event.target.value)}/>
              <input_1.Input placeholder="Categoria" value={category} onChange={(event) => setCategory(event.target.value)}/>
            </div>
            <div className="mt-4 flex justify-end">
              <button_1.Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Salvando...' : 'Salvar'}
              </button_1.Button>
            </div>
          </dialog_1.DialogContent>
        </dialog_1.Dialog>
      </div>

      <card_1.Card className="rounded-2xl">
        <table_1.Table>
          <table_1.TableHeader>
            <table_1.TableRow>
              <table_1.TableHead>Codigo</table_1.TableHead>
              <table_1.TableHead>Nome</table_1.TableHead>
              <table_1.TableHead>Categoria</table_1.TableHead>
            </table_1.TableRow>
          </table_1.TableHeader>
          <table_1.TableBody>
            {data.map((account) => (<table_1.TableRow key={account.id}>
                <table_1.TableCell>{account.code}</table_1.TableCell>
                <table_1.TableCell>{account.name}</table_1.TableCell>
                <table_1.TableCell>{account.category}</table_1.TableCell>
              </table_1.TableRow>))}
          </table_1.TableBody>
        </table_1.Table>
      </card_1.Card>
      </div>
    </role_guard_1.RoleGuard>);
}
//# sourceMappingURL=page.js.map