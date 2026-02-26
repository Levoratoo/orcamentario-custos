"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BudgetLinesModule = void 0;
const common_1 = require("@nestjs/common");
const budget_lines_service_1 = require("./budget-lines.service");
const budget_lines_controller_1 = require("./budget-lines.controller");
const prisma_module_1 = require("../prisma/prisma.module");
const audit_module_1 = require("../audit/audit.module");
const cost_centers_module_1 = require("../cost-centers/cost-centers.module");
const accounts_module_1 = require("../accounts/accounts.module");
const scenarios_module_1 = require("../scenarios/scenarios.module");
let BudgetLinesModule = class BudgetLinesModule {
};
exports.BudgetLinesModule = BudgetLinesModule;
exports.BudgetLinesModule = BudgetLinesModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, audit_module_1.AuditModule, cost_centers_module_1.CostCentersModule, accounts_module_1.AccountsModule, scenarios_module_1.ScenariosModule],
        controllers: [budget_lines_controller_1.BudgetLinesController],
        providers: [budget_lines_service_1.BudgetLinesService],
        exports: [budget_lines_service_1.BudgetLinesService],
    })
], BudgetLinesModule);
//# sourceMappingURL=budget-lines.module.js.map