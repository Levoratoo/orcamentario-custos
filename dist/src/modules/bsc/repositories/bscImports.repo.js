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
exports.BscImportsRepo = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../prisma/prisma.service");
let BscImportsRepo = class BscImportsRepo {
    constructor(prisma) {
        this.prisma = prisma;
    }
    findSuccessfulByHash(fileHash) {
        return this.prisma.bscImport.findFirst({
            where: { fileHash, status: client_1.BscImportStatus.SUCCESS },
            orderBy: { startedAt: 'desc' },
        });
    }
    createStart(data) {
        return this.prisma.bscImport.create({ data });
    }
    finishSuccess(id, warnings, counters) {
        return this.prisma.bscImport.update({
            where: { id },
            data: {
                status: client_1.BscImportStatus.SUCCESS,
                finishedAt: new Date(),
                warnings,
                counters,
            },
        });
    }
    finishPartial(id, warnings, counters) {
        return this.prisma.bscImport.update({
            where: { id },
            data: {
                status: client_1.BscImportStatus.PARTIAL,
                finishedAt: new Date(),
                warnings,
                counters,
            },
        });
    }
    finishFailed(id, warnings, counters, errorMessage) {
        return this.prisma.bscImport.update({
            where: { id },
            data: {
                status: client_1.BscImportStatus.FAILED,
                finishedAt: new Date(),
                warnings,
                counters,
                errorMessage,
            },
        });
    }
    list() {
        return this.prisma.bscImport.findMany({
            orderBy: { startedAt: 'desc' },
            take: 100,
        });
    }
    findById(id) {
        return this.prisma.bscImport.findUnique({ where: { id } });
    }
};
exports.BscImportsRepo = BscImportsRepo;
exports.BscImportsRepo = BscImportsRepo = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BscImportsRepo);
//# sourceMappingURL=bscImports.repo.js.map