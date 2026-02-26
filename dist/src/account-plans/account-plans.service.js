"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountPlansService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const account_plans_importer_1 = require("./account-plans.importer");
const fs = __importStar(require("fs"));
let AccountPlansService = class AccountPlansService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async importFromXlsx(file) {
        if (!file) {
            throw new common_1.BadRequestException({ code: 'FILE_REQUIRED', message: 'Arquivo XLSX obrigatorio' });
        }
        const buffer = file.buffer ?? (file.path ? fs.readFileSync(file.path) : null);
        if (!buffer) {
            throw new common_1.BadRequestException({ code: 'FILE_BUFFER_MISSING', message: 'Arquivo nao pode ser lido' });
        }
        const { rows, errors } = (0, account_plans_importer_1.parseAccountPlanXlsx)(buffer);
        const summary = await (0, account_plans_importer_1.importAccountPlanRows)(this.prisma, rows, errors);
        await this.prisma.importJob.create({
            data: {
                fileName: file.originalname,
                totalRows: summary.total,
                inserted: summary.inserted,
                updated: summary.updated,
                errors: summary.errors,
            },
        });
        return summary;
    }
    async list(filters) {
        const where = {
            isAtiva: true,
            type: filters.tipo ?? undefined,
            parentId: filters.parentId ?? undefined,
            level: filters.nivel ?? undefined,
        };
        if (filters.search) {
            where.OR = [
                { code: { contains: filters.search, mode: 'insensitive' } },
                { description: { contains: filters.search, mode: 'insensitive' } },
                { classification: { contains: filters.search, mode: 'insensitive' } },
            ];
        }
        if (filters.tree) {
            const items = await this.prisma.accountPlan.findMany({
                where,
                orderBy: { classification: 'asc' },
            });
            const tree = this.buildTree(items);
            return { items: tree, total: items.length };
        }
        const page = Math.max(filters.page ?? 1, 1);
        const pageSize = Math.min(Math.max(filters.pageSize ?? 20, 1), 100);
        const skip = (page - 1) * pageSize;
        const [items, total] = await this.prisma.$transaction([
            this.prisma.accountPlan.findMany({ where, skip, take: pageSize, orderBy: { classification: 'asc' } }),
            this.prisma.accountPlan.count({ where }),
        ]);
        return { items, total, page, pageSize };
    }
    async update(id, dto) {
        const existing = await this.prisma.accountPlan.findUnique({ where: { id } });
        if (!existing) {
            throw new common_1.NotFoundException({ code: 'ACCOUNT_PLAN_NOT_FOUND', message: 'Conta nao encontrada' });
        }
        return this.prisma.accountPlan.update({
            where: { id },
            data: {
                description: dto.description ?? existing.description,
                isAtiva: dto.isAtiva ?? existing.isAtiva,
            },
        });
    }
    async deactivate(id) {
        const existing = await this.prisma.accountPlan.findUnique({ where: { id } });
        if (!existing) {
            throw new common_1.NotFoundException({ code: 'ACCOUNT_PLAN_NOT_FOUND', message: 'Conta nao encontrada' });
        }
        return this.prisma.accountPlan.update({
            where: { id },
            data: { isAtiva: false },
        });
    }
    buildTree(items) {
        const map = new Map();
        const roots = [];
        items.forEach((item) => {
            map.set(item.id, { ...item, children: [] });
        });
        items.forEach((item) => {
            const node = map.get(item.id);
            if (item.parentId && map.has(item.parentId)) {
                map.get(item.parentId).children.push(node);
            }
            else {
                roots.push(node);
            }
        });
        return roots;
    }
};
exports.AccountPlansService = AccountPlansService;
exports.AccountPlansService = AccountPlansService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AccountPlansService);
//# sourceMappingURL=account-plans.service.js.map