'use client';
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportCsvDialog = ImportCsvDialog;
const react_1 = require("react");
const papaparse_1 = __importDefault(require("papaparse"));
const react_query_1 = require("@tanstack/react-query");
const backend_1 = require("@/services/backend");
const use_api_client_1 = require("@/hooks/use-api-client");
const button_1 = require("@/components/ui/button");
const dialog_1 = require("@/components/ui/dialog");
const table_1 = require("@/components/ui/table");
const sonner_1 = require("sonner");
function ImportCsvDialog({ scenarioId }) {
    const { apiFetch } = (0, use_api_client_1.useApiClient)();
    const queryClient = (0, react_query_1.useQueryClient)();
    const [open, setOpen] = (0, react_1.useState)(false);
    const [file, setFile] = (0, react_1.useState)(null);
    const [preview, setPreview] = (0, react_1.useState)([]);
    const parseFile = (nextFile) => {
        papaparse_1.default.parse(nextFile, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const rows = results.data;
                setPreview(rows.slice(0, 20));
            },
        });
    };
    const mutation = (0, react_query_1.useMutation)({
        mutationFn: () => backend_1.backend.importBudgetLines(apiFetch, file),
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ['budget-lines', scenarioId] });
            sonner_1.toast.success(`Importacao concluida: ${result.totalRows} linhas`);
            setOpen(false);
        },
    });
    return (<dialog_1.Dialog open={open} onOpenChange={setOpen}>
      <dialog_1.DialogTrigger asChild>
        <button_1.Button variant="outline" size="sm">Importar CSV</button_1.Button>
      </dialog_1.DialogTrigger>
      <dialog_1.DialogContent className="sm:max-w-3xl">
        <dialog_1.DialogHeader>
          <dialog_1.DialogTitle>Importar CSV</dialog_1.DialogTitle>
        </dialog_1.DialogHeader>
        <div className="space-y-4">
          <input type="file" accept=".csv" onChange={(event) => {
            const nextFile = event.target.files?.[0];
            if (nextFile) {
                setFile(nextFile);
                parseFile(nextFile);
            }
        }}/>

          {preview.length > 0 && (<table_1.Table>
              <table_1.TableHeader>
                <table_1.TableRow>
                  {Object.keys(preview[0]).map((key) => (<table_1.TableHead key={key}>{key}</table_1.TableHead>))}
                </table_1.TableRow>
              </table_1.TableHeader>
              <table_1.TableBody>
                {preview.map((row, index) => (<table_1.TableRow key={index}>
                    {Object.values(row).map((value, idx) => (<table_1.TableCell key={idx}>{value}</table_1.TableCell>))}
                  </table_1.TableRow>))}
              </table_1.TableBody>
            </table_1.Table>)}
        </div>
        <div className="mt-4 flex justify-end">
          <button_1.Button onClick={() => mutation.mutate()} disabled={!file || mutation.isPending}>
            {mutation.isPending ? 'Importando...' : 'Enviar'}
          </button_1.Button>
        </div>
      </dialog_1.DialogContent>
    </dialog_1.Dialog>);
}
//# sourceMappingURL=import-csv-dialog.js.map