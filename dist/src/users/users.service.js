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
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const bcrypt = __importStar(require("bcrypt"));
const audit_service_1 = require("../audit/audit.service");
const client_1 = require("@prisma/client");
let UsersService = class UsersService {
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    normalizeUsername(username) {
        return username?.trim().toLowerCase();
    }
    async list(page, pageSize) {
        const skip = (page - 1) * pageSize;
        const [items, total] = await this.prisma.$transaction([
            this.prisma.user.findMany({
                skip,
                take: pageSize,
                orderBy: { createdAt: 'desc' },
                select: { id: true, name: true, username: true, email: true, role: true, mustChangePassword: true, active: true, createdAt: true, updatedAt: true },
            }),
            this.prisma.user.count(),
        ]);
        return { items, total, page, pageSize };
    }
    async findById(id) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            select: { id: true, name: true, username: true, email: true, role: true, mustChangePassword: true, active: true, createdAt: true, updatedAt: true },
        });
        if (!user) {
            throw new common_1.NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found' });
        }
        return user;
    }
    async findByEmail(email) {
        return this.prisma.user.findUnique({ where: { email } });
    }
    async findByUsername(username) {
        return this.prisma.user.findUnique({ where: { username } });
    }
    async findByIdentifier(identifier) {
        return this.prisma.user.findFirst({
            where: { OR: [{ username: identifier }, { email: identifier }] },
        });
    }
    async create(dto, actorUserId) {
        const username = this.normalizeUsername(dto.username);
        const existing = await this.prisma.user.findFirst({
            where: {
                OR: [{ username }, dto.email ? { email: dto.email } : undefined].filter(Boolean),
            },
        });
        if (existing) {
            throw new common_1.BadRequestException({ code: 'USER_IN_USE', message: 'Username or email already in use' });
        }
        const passwordHash = await bcrypt.hash(dto.password || '123456', 10);
        const user = await this.prisma.user.create({
            data: {
                name: dto.name,
                username: username,
                email: dto.email ?? null,
                role: dto.role ?? client_1.Role.COORDINATOR,
                passwordHash,
                mustChangePassword: dto.mustChangePassword ?? true,
                active: dto.active ?? true,
            },
        });
        await this.audit.log({
            entityType: 'User',
            entityId: user.id,
            action: 'CREATE',
            before: null,
            after: user,
            actorUserId,
        });
        const { passwordHash: _passwordHash, ...safe } = user;
        return safe;
    }
    async update(id, dto, actorUserId) {
        const existing = await this.findById(id);
        const nextUsername = dto.username ? this.normalizeUsername(dto.username) : existing.username;
        const nextEmail = dto.email ?? existing.email ?? null;
        const duplicate = await this.prisma.user.findFirst({
            where: {
                OR: [
                    nextUsername ? { username: nextUsername } : undefined,
                    nextEmail ? { email: nextEmail } : undefined,
                ].filter(Boolean),
                NOT: { id },
            },
        });
        if (duplicate) {
            throw new common_1.BadRequestException({ code: 'USER_IN_USE', message: 'Username or email already in use' });
        }
        const data = {
            name: dto.name ?? existing.name,
            username: nextUsername,
            email: nextEmail,
            role: dto.role ?? existing.role,
            mustChangePassword: dto.mustChangePassword ?? existing.mustChangePassword,
            active: dto.active ?? existing.active,
        };
        if (dto.password) {
            data.passwordHash = await bcrypt.hash(dto.password, 10);
        }
        const user = await this.prisma.user.update({ where: { id }, data });
        await this.audit.log({
            entityType: 'User',
            entityId: user.id,
            action: 'UPDATE',
            before: existing,
            after: user,
            actorUserId,
        });
        const { passwordHash: _passwordHash, ...safe } = user;
        return safe;
    }
    async deactivate(id, actorUserId) {
        const existing = await this.findById(id);
        const user = await this.prisma.user.update({ where: { id }, data: { active: false } });
        await this.audit.log({
            entityType: 'User',
            entityId: user.id,
            action: 'UPDATE',
            before: existing,
            after: user,
            actorUserId,
        });
        const { passwordHash: _passwordHash, ...safe } = user;
        return safe;
    }
    async resetPassword(id, actorUserId, newPassword) {
        const existing = await this.prisma.user.findUnique({ where: { id } });
        if (!existing) {
            throw new common_1.NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found' });
        }
        const passwordHash = await bcrypt.hash(newPassword || '123456', 10);
        const user = await this.prisma.user.update({
            where: { id },
            data: { passwordHash, mustChangePassword: true },
        });
        await this.audit.log({
            entityType: 'User',
            entityId: user.id,
            action: 'UPDATE',
            before: existing,
            after: user,
            actorUserId,
        });
        return { success: true };
    }
    async updateProfile(userId, data) {
        const existing = await this.findById(userId);
        const nextUsername = data.username ? this.normalizeUsername(data.username) : existing.username;
        if (nextUsername !== existing.username) {
            const duplicate = await this.prisma.user.findFirst({
                where: { username: nextUsername, NOT: { id: userId } },
            });
            if (duplicate) {
                throw new common_1.BadRequestException({ code: 'USER_IN_USE', message: 'Username already in use' });
            }
        }
        const updated = await this.prisma.user.update({
            where: { id: userId },
            data: {
                name: data.name ?? existing.name,
                username: nextUsername,
            },
            select: { id: true, name: true, username: true, email: true, role: true, mustChangePassword: true, active: true, createdAt: true, updatedAt: true },
        });
        return updated;
    }
    async changeMyPassword(userId, currentPassword, newPassword) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user || !user.active) {
            throw new common_1.BadRequestException({ code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' });
        }
        const matches = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!matches) {
            throw new common_1.BadRequestException({ code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' });
        }
        const passwordHash = await bcrypt.hash(newPassword, 10);
        await this.prisma.user.update({
            where: { id: userId },
            data: { passwordHash, mustChangePassword: false },
        });
        return { success: true };
    }
    async syncUserAssignments(targetUserId, accountIds, createdById) {
        const existing = await this.prisma.user.findUnique({ where: { id: targetUserId } });
        if (!existing) {
            throw new common_1.NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found' });
        }
        const uniqueIds = Array.from(new Set(accountIds));
        await this.prisma.$transaction(async (tx) => {
            await tx.userAccountAssignment.deleteMany({
                where: { userId: targetUserId, accountId: { notIn: uniqueIds } },
            });
            await Promise.all(uniqueIds.map((accountId) => tx.userAccountAssignment.upsert({
                where: { userId_accountId: { userId: targetUserId, accountId } },
                update: {},
                create: { userId: targetUserId, accountId, createdById },
            })));
        });
        return { success: true };
    }
    async listUserAssignments(targetUserId) {
        const user = await this.prisma.user.findUnique({ where: { id: targetUserId } });
        if (!user) {
            throw new common_1.NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found' });
        }
        const assignments = await this.prisma.userAccountAssignment.findMany({
            where: { userId: targetUserId },
            select: { accountId: true },
        });
        const accounts = await this.prisma.planningAccount.findMany({
            orderBy: [{ proacaoId: 'asc' }, { orderIndex: 'asc' }],
            include: { proacao: true },
        });
        return {
            user: { id: user.id, name: user.name, username: user.username },
            assignedAccountIds: assignments.map((item) => item.accountId),
            accounts: accounts.map((account) => ({
                id: account.id,
                code: account.code,
                label: account.label,
                name: account.name,
                proacao: { id: account.proacao.id, name: account.proacao.name },
            })),
        };
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, audit_service_1.AuditService])
], UsersService);
//# sourceMappingURL=users.service.js.map