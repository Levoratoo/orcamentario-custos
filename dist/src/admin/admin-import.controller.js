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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminImportController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const prisma_service_1 = require("../prisma/prisma.service");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const client_1 = require("@prisma/client");
const realized_baseline_importer_1 = require("../dre/realized-baseline.importer");
const historical_importer_1 = require("../planning/historical-importer");
let AdminImportController = class AdminImportController {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async importRealizado2026() {
        const filePath = (0, realized_baseline_importer_1.resolveRealizadoBaselineFile)();
        if (!filePath) {
            return { ok: false, message: 'Arquivo baseline nao encontrado' };
        }
        const summary = await (0, realized_baseline_importer_1.importRealizadoBaseline2026)(this.prisma, filePath);
        return { ok: true, summary };
    }
    async importBootstrap() {
        const summary = await (0, historical_importer_1.importHistoricalPlanning)(this.prisma, process.cwd());
        return { ok: true, summary };
    }
};
exports.AdminImportController = AdminImportController;
__decorate([
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    (0, common_1.Post)('realizado-2026'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdminImportController.prototype, "importRealizado2026", null);
__decorate([
    (0, roles_decorator_1.Roles)(client_1.Role.ADMIN),
    (0, common_1.Post)('bootstrap'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdminImportController.prototype, "importBootstrap", null);
exports.AdminImportController = AdminImportController = __decorate([
    (0, swagger_1.ApiTags)('admin-import'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('admin/import'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AdminImportController);
//# sourceMappingURL=admin-import.controller.js.map