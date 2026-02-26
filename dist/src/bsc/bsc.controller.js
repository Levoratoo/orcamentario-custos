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
const platform_express_1 = require("@nestjs/platform-express");
const swagger_1 = require("@nestjs/swagger");
const client_1 = require("@prisma/client");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const bsc_import_service_1 = require("./bsc-import.service");
const bsc_service_1 = require("./bsc.service");
let BscController = class BscController {
    constructor(importService, bscService) {
        this.importService = importService;
        this.bscService = bscService;
    }
    async import(file, user) {
        return this.importService.importExcel(file, user?.sub);
    }
    async imports() {
        return this.importService.listImports();
    }
    async importById(id) {
        return this.importService.getImport(id);
    }
    async map() {
        return this.bscService.getMap();
    }
    async indicators(perspective, objective, responsible, process, search) {
        return this.bscService.getIndicators({
            perspective,
            objective,
            responsible,
            process,
            search,
        });
    }
    async indicatorByCode(code) {
        return this.bscService.getIndicatorByCode(code);
    }
    async management(year = '2025') {
        return this.bscService.getManagement(Number(year));
    }
    async managementSummary(year = '2025') {
        return this.bscService.getManagementSummary(Number(year));
    }
    async projects(snapshot) {
        return this.bscService.getProjects(snapshot);
    }
    async projectSnapshots() {
        return this.bscService.getProjectSnapshots();
    }
    async projectTasks(projectId) {
        return this.bscService.getProjectTasks(projectId);
    }
    async taskSnapshots(taskId) {
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
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], BscController.prototype, "import", null);
__decorate([
    (0, common_1.Get)('imports'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], BscController.prototype, "imports", null);
__decorate([
    (0, common_1.Get)('imports/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], BscController.prototype, "importById", null);
__decorate([
    (0, common_1.Get)('map'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], BscController.prototype, "map", null);
__decorate([
    (0, common_1.Get)('indicators'),
    __param(0, (0, common_1.Query)('perspective')),
    __param(1, (0, common_1.Query)('objective')),
    __param(2, (0, common_1.Query)('responsible')),
    __param(3, (0, common_1.Query)('process')),
    __param(4, (0, common_1.Query)('search')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], BscController.prototype, "indicators", null);
__decorate([
    (0, common_1.Get)('indicators/:code'),
    __param(0, (0, common_1.Param)('code')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], BscController.prototype, "indicatorByCode", null);
__decorate([
    (0, common_1.Get)('management'),
    __param(0, (0, common_1.Query)('year')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BscController.prototype, "management", null);
__decorate([
    (0, common_1.Get)('management/summary'),
    __param(0, (0, common_1.Query)('year')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BscController.prototype, "managementSummary", null);
__decorate([
    (0, common_1.Get)('projects'),
    __param(0, (0, common_1.Query)('snapshot')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], BscController.prototype, "projects", null);
__decorate([
    (0, common_1.Get)('projects/snapshots'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], BscController.prototype, "projectSnapshots", null);
__decorate([
    (0, common_1.Get)('projects/:projectId/tasks'),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], BscController.prototype, "projectTasks", null);
__decorate([
    (0, common_1.Get)('tasks/:taskId/snapshots'),
    __param(0, (0, common_1.Param)('taskId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], BscController.prototype, "taskSnapshots", null);
exports.BscController = BscController = __decorate([
    (0, swagger_1.ApiTags)('bsc'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('bsc'),
    __metadata("design:paramtypes", [bsc_import_service_1.BscImportService,
        bsc_service_1.BscService])
], BscController);
//# sourceMappingURL=bsc.controller.js.map