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
exports.BscTargetsRepo = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../prisma/prisma.service");
let BscTargetsRepo = class BscTargetsRepo {
    constructor(prisma) {
        this.prisma = prisma;
    }
    upsertYearTarget(indicatorId, year, targetValue, rawValue) {
        return this.prisma.bscIndicatorYearTarget.upsert({
            where: { indicatorId_year: { indicatorId, year } },
            update: { targetValue, rawValue },
            create: { indicatorId, year, targetValue, rawValue },
        });
    }
    upsertMonthTarget(indicatorId, year, month, targetValue, rawValue) {
        return this.prisma.bscIndicatorMonthTarget.upsert({
            where: { indicatorId_year_month: { indicatorId, year, month } },
            update: { targetValue, rawValue },
            create: { indicatorId, year, month, targetValue, rawValue },
        });
    }
};
exports.BscTargetsRepo = BscTargetsRepo;
exports.BscTargetsRepo = BscTargetsRepo = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BscTargetsRepo);
//# sourceMappingURL=bscTargets.repo.js.map