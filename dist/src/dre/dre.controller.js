"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DreController = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const roles_guard_1 = require("../common/guards/roles.guard");
const dre_service_1 = require("./dre.service");
let DreController = class DreController {
    constructor(service) {
        this.service = service;
    }
    getTree(budgetId, mode, actualBudgetId) {
        return this.service.getTree(budgetId, mode ?? 'BUDGET', actualBudgetId);
    }
    getExerciseAccumulated(year, cutoffMonth) {
        return this.service.getExerciseAccumulated(Number(year), cutoffMonth ? Number(cutoffMonth) : undefined);
    }
    getExerciseMonthly(year, month) {
        return this.service.getExerciseMonthly(Number(year), month ? Number(month) : undefined);
    }
    auditAgainstExpandedSheet(year, budgetId) {
        return this.service.auditAgainstExpandedSheet(year ? Number(year) : 2026, budgetId);
    }
    autoFixFromExpandedSheet(body) {
        return this.service.autoFixFromExpandedSheet(body?.year ?? 2026, body?.budgetId);
    }
};
exports.DreController = DreController;
__decorate([
    (0, common_1.Get)('tree'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.CONTROLLER, client_1.Role.COORDINATOR),
    __param(0, (0, common_1.Query)('budgetId')),
    __param(1, (0, common_1.Query)('mode')),
    __param(2, (0, common_1.Query)('actualBudgetId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], DreController.prototype, "getTree", null);
__decorate([
    (0, common_1.Get)('exercicio-acumulado'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.CONTROLLER, client_1.Role.COORDINATOR),
    __param(0, (0, common_1.Query)('year')),
    __param(1, (0, common_1.Query)('cutoffMonth')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], DreController.prototype, "getExerciseAccumulated", null);
__decorate([
    (0, common_1.Get)('exercicio-mensal'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.CONTROLLER, client_1.Role.COORDINATOR),
    __param(0, (0, common_1.Query)('year')),
    __param(1, (0, common_1.Query)('month')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], DreController.prototype, "getExerciseMonthly", null);
__decorate([
    (0, common_1.Get)('audit'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.CONTROLLER),
    __param(0, (0, common_1.Query)('year')),
    __param(1, (0, common_1.Query)('budgetId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], DreController.prototype, "auditAgainstExpandedSheet", null);
__decorate([
    (0, common_1.Post)('audit/fix'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.CONTROLLER),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], DreController.prototype, "autoFixFromExpandedSheet", null);
exports.DreController = DreController = __decorate([
    (0, common_1.Controller)('dre'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [dre_service_1.DreService])
], DreController);
//# sourceMappingURL=dre.controller.js.map