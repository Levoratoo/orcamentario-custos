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
exports.AccountsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
let AccountsService = class AccountsService {
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async list(filters) {
        return this.prisma.account.findMany({
            where: {
                code: filters.code ? { contains: filters.code, mode: 'insensitive' } : undefined,
                category: filters.category ? { contains: filters.category, mode: 'insensitive' } : undefined,
            },
            orderBy: { code: 'asc' },
        });
    }
    async create(dto, actorUserId) {
        const existing = await this.prisma.account.findUnique({ where: { code: dto.code } });
        if (existing) {
            throw new common_1.BadRequestException({ code: 'ACCOUNT_EXISTS', message: 'Account code already exists' });
        }
        const account = await this.prisma.account.create({
            data: {
                code: dto.code,
                name: dto.name,
                category: dto.category,
                active: dto.active ?? true,
            },
        });
        await this.audit.log({
            entityType: 'Account',
            entityId: account.id,
            action: 'CREATE',
            before: null,
            after: account,
            actorUserId,
        });
        return account;
    }
    async update(id, dto, actorUserId) {
        const existing = await this.prisma.account.findUnique({ where: { id } });
        if (!existing) {
            throw new common_1.NotFoundException({ code: 'ACCOUNT_NOT_FOUND', message: 'Account not found' });
        }
        const account = await this.prisma.account.update({
            where: { id },
            data: {
                name: dto.name ?? existing.name,
                category: dto.category ?? existing.category,
                active: dto.active ?? existing.active,
            },
        });
        await this.audit.log({
            entityType: 'Account',
            entityId: account.id,
            action: 'UPDATE',
            before: existing,
            after: account,
            actorUserId,
        });
        return account;
    }
};
exports.AccountsService = AccountsService;
exports.AccountsService = AccountsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, audit_service_1.AuditService])
], AccountsService);
//# sourceMappingURL=accounts.service.js.map