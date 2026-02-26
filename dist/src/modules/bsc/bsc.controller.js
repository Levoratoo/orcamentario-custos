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
exports.BscController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const client_1 = require("@prisma/client");
const platform_express_1 = require("@nestjs/platform-express");
const bsc_routes_1 = require("./bsc.routes");
const bsc_service_1 = require("./bsc.service");
const BscExcelImportService_1 = require("./import/BscExcelImportService");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const update_indicator_month_actual_dto_1 = require("./dto/update-indicator-month-actual.dto");
const update_indicator_month_target_dto_1 = require("./dto/update-indicator-month-target.dto");
let BscController = class BscController {
    constructor(bscService, importService) {
        this.bscService = bscService;
        this.importService = importService;
    }
    importExcel(file, user, force) {
        const forceImport = force === '1' || force?.toLowerCase() === 'true';
        return this.importService.importExcel(file, user?.sub, forceImport);
    }
    listImports() {
        return this.importService.listImports();
    }
    getImport(id) {
        return this.importService.getImport(id);
    }
    getMap() {
        return this.bscService.getMap();
    }
    getIndicators(perspective, objective, responsible, dataOwner, process, level, keyword, search) {
        const parsedLevel = level ? Number(level) : undefined;
        return this.bscService.getIndicators({
            perspective,
            objective,
            responsible,
            dataOwner,
            process,
            level: parsedLevel != null && Number.isFinite(parsedLevel) ? parsedLevel : undefined,
            keyword,
            search,
        });
    }
    getIndicatorByCode(code) {
        return this.bscService.getIndicatorByCode(code);
    }
    setIndicatorMonthActual(code, body) {
        return this.bscService.setIndicatorMonthActual(code, body);
    }
    setIndicatorMonthTarget(code, body) {
        return this.bscService.setIndicatorMonthTarget(code, body);
    }
    getManagement(year = '2025') {
        return this.bscService.getManagement(Number(year));
    }
    getManagementSummary(year = '2025') {
        return this.bscService.getManagementSummary(Number(year));
    }
    getProjects(snapshot) {
        return this.bscService.getProjects(snapshot);
    }
    getProjectSnapshots() {
        return this.bscService.getProjectSnapshots();
    }
    getProjectTasks(projectId) {
        return this.bscService.getProjectTasks(projectId);
    }
    getTaskSnapshots(taskId) {
        return this.bscService.getTaskSnapshots(taskId);
    }
};
exports.BscController = BscController;
__decorate([
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.CONTROLLER),
    (0, common_1.Post)('import'),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Query)('force')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", void 0)
], BscController.prototype, "importExcel", null);
__decorate([
    (0, common_1.Get)('imports'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], BscController.prototype, "listImports", null);
__decorate([
    (0, common_1.Get)('imports/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], BscController.prototype, "getImport", null);
__decorate([
    (0, common_1.Get)('map'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], BscController.prototype, "getMap", null);
__decorate([
    (0, common_1.Get)('indicators'),
    __param(0, (0, common_1.Query)('perspective')),
    __param(1, (0, common_1.Query)('objective')),
    __param(2, (0, common_1.Query)('responsible')),
    __param(3, (0, common_1.Query)('dataOwner')),
    __param(4, (0, common_1.Query)('process')),
    __param(5, (0, common_1.Query)('level')),
    __param(6, (0, common_1.Query)('keyword')),
    __param(7, (0, common_1.Query)('search')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String, String, String]),
    __metadata("design:returntype", void 0)
], BscController.prototype, "getIndicators", null);
__decorate([
    (0, common_1.Get)('indicators/:code'),
    __param(0, (0, common_1.Param)('code')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], BscController.prototype, "getIndicatorByCode", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.CONTROLLER),
    (0, common_1.Patch)('indicators/:code/month-actual'),
    __param(0, (0, common_1.Param)('code')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_indicator_month_actual_dto_1.UpdateIndicatorMonthActualDto]),
    __metadata("design:returntype", void 0)
], BscController.prototype, "setIndicatorMonthActual", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN, client_1.Role.CONTROLLER),
    (0, common_1.Patch)('indicators/:code/month-target'),
    __param(0, (0, common_1.Param)('code')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_indicator_month_target_dto_1.UpdateIndicatorMonthTargetDto]),
    __metadata("design:returntype", void 0)
], BscController.prototype, "setIndicatorMonthTarget", null);
__decorate([
    (0, common_1.Get)('management'),
    __param(0, (0, common_1.Query)('year')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], BscController.prototype, "getManagement", null);
__decorate([
    (0, common_1.Get)('management/summary'),
    __param(0, (0, common_1.Query)('year')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], BscController.prototype, "getManagementSummary", null);
__decorate([
    (0, common_1.Get)('projects'),
    __param(0, (0, common_1.Query)('snapshot')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], BscController.prototype, "getProjects", null);
__decorate([
    (0, common_1.Get)('projects/snapshots'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], BscController.prototype, "getProjectSnapshots", null);
__decorate([
    (0, common_1.Get)('projects/:projectId/tasks'),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], BscController.prototype, "getProjectTasks", null);
__decorate([
    (0, common_1.Get)('tasks/:taskId/snapshots'),
    __param(0, (0, common_1.Param)('taskId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], BscController.prototype, "getTaskSnapshots", null);
exports.BscController = BscController = __decorate([
    (0, swagger_1.ApiTags)('bsc'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)(bsc_routes_1.BSC_BASE_ROUTE),
    __metadata("design:paramtypes", [bsc_service_1.BscService,
        BscExcelImportService_1.BscExcelImportService])
], BscController);
//# sourceMappingURL=bsc.controller.js.map