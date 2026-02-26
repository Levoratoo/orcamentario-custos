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
exports.CostCentersController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const cost_centers_service_1 = require("./cost-centers.service");
const create_cost_center_dto_1 = require("./dto/create-cost-center.dto");
const update_cost_center_dto_1 = require("./dto/update-cost-center.dto");
const set_owner_dto_1 = require("./dto/set-owner.dto");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const client_1 = require("@prisma/client");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
let CostCentersController = class CostCentersController {
    constructor(service) {
        this.service = service;
    }
    async list(code, ownerId) {
        return this.service.list({ code, ownerId });
    }
    async create(dto, user) {
        return this.service.create(dto, user.sub);
    }
    async update(id, dto, user) {
        return this.service.update(id, dto, user.sub);
    }
    async setOwner(id, dto, user) {
        return this.service.setOwner(id, dto.ownerCoordinatorId ?? null, user.sub);
    }
};
exports.CostCentersController = CostCentersController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('code')),
    __param(1, (0, common_1.Query)('ownerId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], CostCentersController.prototype, "list", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.CONTROLLER),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_cost_center_dto_1.CreateCostCenterDto, Object]),
    __metadata("design:returntype", Promise)
], CostCentersController.prototype, "create", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.CONTROLLER),
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_cost_center_dto_1.UpdateCostCenterDto, Object]),
    __metadata("design:returntype", Promise)
], CostCentersController.prototype, "update", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.CONTROLLER),
    (0, common_1.Put)(':id/owner'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, set_owner_dto_1.SetOwnerDto, Object]),
    __metadata("design:returntype", Promise)
], CostCentersController.prototype, "setOwner", null);
exports.CostCentersController = CostCentersController = __decorate([
    (0, swagger_1.ApiTags)('cost-centers'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('cost-centers'),
    __metadata("design:paramtypes", [cost_centers_service_1.CostCentersService])
], CostCentersController);
//# sourceMappingURL=cost-centers.controller.js.map