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
exports.SponsorsController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const sponsors_service_1 = require("./sponsors.service");
const create_sponsor_dto_1 = require("./dto/create-sponsor.dto");
const update_sponsor_dto_1 = require("./dto/update-sponsor.dto");
let SponsorsController = class SponsorsController {
    constructor(service) {
        this.service = service;
    }
    myAccounts(budgetId, user) {
        return this.service.listMyAccounts(budgetId, user);
    }
    accountDetails(accountCode, budgetId, costCenterId, user) {
        return this.service.getAccountDetails(accountCode, budgetId, costCenterId ?? null, user);
    }
    listSponsors(query) {
        return this.service.listSponsors(query);
    }
    createSponsor(dto) {
        return this.service.createSponsor(dto);
    }
    updateSponsor(id, dto) {
        return this.service.updateSponsor(id, dto);
    }
    removeSponsor(id) {
        return this.service.deleteSponsor(id);
    }
    importSponsors(file) {
        return this.service.importSponsors(file);
    }
};
exports.SponsorsController = SponsorsController;
__decorate([
    (0, common_1.Get)('sponsors/my-accounts'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.CONTROLLER, client_1.Role.COORDINATOR),
    __param(0, (0, common_1.Query)('budgetId')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], SponsorsController.prototype, "myAccounts", null);
__decorate([
    (0, common_1.Get)('accounts/:accountCode/budget-details'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.CONTROLLER, client_1.Role.COORDINATOR),
    __param(0, (0, common_1.Param)('accountCode')),
    __param(1, (0, common_1.Query)('budgetId')),
    __param(2, (0, common_1.Query)('costCenterId')),
    __param(3, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object]),
    __metadata("design:returntype", void 0)
], SponsorsController.prototype, "accountDetails", null);
__decorate([
    (0, common_1.Get)('admin/sponsors'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    __param(0, (0, common_1.Query)('query')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SponsorsController.prototype, "listSponsors", null);
__decorate([
    (0, common_1.Post)('admin/sponsors'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_sponsor_dto_1.CreateSponsorDto]),
    __metadata("design:returntype", void 0)
], SponsorsController.prototype, "createSponsor", null);
__decorate([
    (0, common_1.Patch)('admin/sponsors/:id'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_sponsor_dto_1.UpdateSponsorDto]),
    __metadata("design:returntype", void 0)
], SponsorsController.prototype, "updateSponsor", null);
__decorate([
    (0, common_1.Delete)('admin/sponsors/:id'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SponsorsController.prototype, "removeSponsor", null);
__decorate([
    (0, common_1.Post)('admin/sponsors/import'),
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SponsorsController.prototype, "importSponsors", null);
exports.SponsorsController = SponsorsController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [sponsors_service_1.SponsorsService])
], SponsorsController);
//# sourceMappingURL=sponsors.controller.js.map