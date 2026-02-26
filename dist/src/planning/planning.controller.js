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
exports.PlanningController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const platform_express_1 = require("@nestjs/platform-express");
const planning_service_1 = require("./planning.service");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const client_1 = require("@prisma/client");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const update_planning_value_dto_1 = require("./dto/update-planning-value.dto");
const finalize_planning_dto_1 = require("./dto/finalize-planning.dto");
let PlanningController = class PlanningController {
    constructor(planningService) {
        this.planningService = planningService;
    }
    async listProacoes(user, userId) {
        return this.planningService.listProacoes(user, userId);
    }
    async listYears(user, userId) {
        return this.planningService.listYears(user, userId);
    }
    async getGrid(user, proacaoId, year, userId) {
        return this.planningService.getGrid(user, proacaoId, Number(year), userId);
    }
    async summary(user, proacaoId, year, userId) {
        return this.planningService.getSummary(user, proacaoId, Number(year), userId);
    }
    async audit(user, proacaoId, year, userId) {
        return this.planningService.auditConsistency(user, proacaoId, Number(year), userId);
    }
    async updateValue(user, dto) {
        return this.planningService.updateValue(user, dto);
    }
    async finalize(user, dto) {
        return this.planningService.finalize(user, dto);
    }
    async import(file, user) {
        if (!file) {
            return { inserted: 0, updated: 0, skipped: 0 };
        }
        return this.planningService.importFromXlsx(file, user.sub);
    }
};
exports.PlanningController = PlanningController;
__decorate([
    (0, common_1.Get)('proacoes'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], PlanningController.prototype, "listProacoes", null);
__decorate([
    (0, common_1.Get)('years'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], PlanningController.prototype, "listYears", null);
__decorate([
    (0, common_1.Get)('grid'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('proacaoId')),
    __param(2, (0, common_1.Query)('year')),
    __param(3, (0, common_1.Query)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], PlanningController.prototype, "getGrid", null);
__decorate([
    (0, common_1.Get)('summary'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('proacaoId')),
    __param(2, (0, common_1.Query)('year')),
    __param(3, (0, common_1.Query)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], PlanningController.prototype, "summary", null);
__decorate([
    (0, common_1.Get)('audit'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('proacaoId')),
    __param(2, (0, common_1.Query)('year')),
    __param(3, (0, common_1.Query)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], PlanningController.prototype, "audit", null);
__decorate([
    (0, common_1.Patch)('value'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_planning_value_dto_1.UpdatePlanningValueDto]),
    __metadata("design:returntype", Promise)
], PlanningController.prototype, "updateValue", null);
__decorate([
    (0, common_1.Post)('finalize'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, finalize_planning_dto_1.FinalizePlanningDto]),
    __metadata("design:returntype", Promise)
], PlanningController.prototype, "finalize", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    (0, common_1.Post)('import'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PlanningController.prototype, "import", null);
exports.PlanningController = PlanningController = __decorate([
    (0, swagger_1.ApiTags)('planning'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('planning'),
    __metadata("design:paramtypes", [planning_service_1.PlanningService])
], PlanningController);
//# sourceMappingURL=planning.controller.js.map