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
exports.BudgetLinesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const budget_lines_service_1 = require("./budget-lines.service");
const create_budget_line_dto_1 = require("./dto/create-budget-line.dto");
const update_budget_line_dto_1 = require("./dto/update-budget-line.dto");
const bulk_upsert_dto_1 = require("./dto/bulk-upsert.dto");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const client_1 = require("@prisma/client");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
let BudgetLinesController = class BudgetLinesController {
    constructor(service) {
        this.service = service;
    }
    async create(dto, user) {
        return this.service.create(dto, user);
    }
    async list(scenarioId, costCenterId, accountId, page = '1', pageSize = '20', user) {
        return this.service.list({ scenarioId, costCenterId, accountId }, user, Number(page), Number(pageSize));
    }
    async update(id, dto, user) {
        return this.service.update(id, dto, user);
    }
    async delete(id, user) {
        return this.service.delete(id, user);
    }
    async bulkUpsert(dto, user) {
        return this.service.bulkUpsert(dto, user);
    }
    async summary(scenarioId, groupBy = 'costCenter', user) {
        return this.service.summary(scenarioId, groupBy, user);
    }
};
exports.BudgetLinesController = BudgetLinesController;
__decorate([
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.CONTROLLER, client_1.Role.COORDINATOR),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_budget_line_dto_1.CreateBudgetLineDto, Object]),
    __metadata("design:returntype", Promise)
], BudgetLinesController.prototype, "create", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.CONTROLLER, client_1.Role.COORDINATOR),
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('scenarioId')),
    __param(1, (0, common_1.Query)('costCenterId')),
    __param(2, (0, common_1.Query)('accountId')),
    __param(3, (0, common_1.Query)('page')),
    __param(4, (0, common_1.Query)('pageSize')),
    __param(5, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], BudgetLinesController.prototype, "list", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.CONTROLLER, client_1.Role.COORDINATOR),
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_budget_line_dto_1.UpdateBudgetLineDto, Object]),
    __metadata("design:returntype", Promise)
], BudgetLinesController.prototype, "update", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.CONTROLLER, client_1.Role.COORDINATOR),
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], BudgetLinesController.prototype, "delete", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.CONTROLLER, client_1.Role.COORDINATOR),
    (0, common_1.Post)('bulk-upsert'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [bulk_upsert_dto_1.BulkUpsertDto, Object]),
    __metadata("design:returntype", Promise)
], BudgetLinesController.prototype, "bulkUpsert", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.CONTROLLER, client_1.Role.COORDINATOR),
    (0, common_1.Get)('summary'),
    __param(0, (0, common_1.Query)('scenarioId')),
    __param(1, (0, common_1.Query)('groupBy')),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], BudgetLinesController.prototype, "summary", null);
exports.BudgetLinesController = BudgetLinesController = __decorate([
    (0, swagger_1.ApiTags)('budget-lines'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('budget-lines'),
    __metadata("design:paramtypes", [budget_lines_service_1.BudgetLinesService])
], BudgetLinesController);
//# sourceMappingURL=budget-lines.controller.js.map