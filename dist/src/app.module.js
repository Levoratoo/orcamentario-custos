"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const nestjs_pino_1 = require("nestjs-pino");
const crypto_1 = require("crypto");
const prisma_module_1 = require("./prisma/prisma.module");
const auth_module_1 = require("./auth/auth.module");
const users_module_1 = require("./users/users.module");
const cost_centers_module_1 = require("./cost-centers/cost-centers.module");
const accounts_module_1 = require("./accounts/accounts.module");
const scenarios_module_1 = require("./scenarios/scenarios.module");
const budget_lines_module_1 = require("./budget-lines/budget-lines.module");
const audit_module_1 = require("./audit/audit.module");
const imports_module_1 = require("./imports/imports.module");
const account_plans_module_1 = require("./account-plans/account-plans.module");
const budgets_module_1 = require("./budgets/budgets.module");
const dre_module_1 = require("./dre/dre.module");
const budget_items_module_1 = require("./budget-items/budget-items.module");
const sponsors_module_1 = require("./sponsors/sponsors.module");
const closing_month_module_1 = require("./closing-month/closing-month.module");
const planning_module_1 = require("./planning/planning.module");
const bsc_module_1 = require("./modules/bsc/bsc.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            nestjs_pino_1.LoggerModule.forRoot({
                pinoHttp: {
                    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
                    genReqId: (req, res) => {
                        const existing = req.headers['x-request-id'];
                        const id = Array.isArray(existing) ? existing[0] : existing;
                        const requestId = id || (0, crypto_1.randomUUID)();
                        res.setHeader('x-request-id', requestId);
                        return requestId;
                    },
                },
            }),
            prisma_module_1.PrismaModule,
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            cost_centers_module_1.CostCentersModule,
            accounts_module_1.AccountsModule,
            scenarios_module_1.ScenariosModule,
            budget_lines_module_1.BudgetLinesModule,
            budgets_module_1.BudgetsModule,
            dre_module_1.DreModule,
            budget_items_module_1.BudgetItemsModule,
            sponsors_module_1.SponsorsModule,
            closing_month_module_1.ClosingMonthModule,
            planning_module_1.PlanningModule,
            bsc_module_1.BscModule,
            audit_module_1.AuditModule,
            imports_module_1.ImportsModule,
            account_plans_module_1.AccountPlansModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map