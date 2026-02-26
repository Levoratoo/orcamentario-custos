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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const prisma_service_1 = require("../prisma/prisma.service");
const users_service_1 = require("../users/users.service");
const bcrypt = __importStar(require("bcrypt"));
const duration_1 = require("../common/utils/duration");
let AuthService = class AuthService {
    constructor(usersService, prisma, jwtService) {
        this.usersService = usersService;
        this.prisma = prisma;
        this.jwtService = jwtService;
    }
    async login(identifier, password) {
        const user = await this.usersService.findByIdentifier(identifier);
        if (!user) {
            throw new common_1.UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' });
        }
        if (!user.active) {
            throw new common_1.UnauthorizedException({ code: 'USER_INACTIVE', message: 'Usuario desativado' });
        }
        const matches = await bcrypt.compare(password, user.passwordHash);
        if (!matches) {
            throw new common_1.UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' });
        }
        return this.issueTokens(user.id, user.role);
    }
    async refresh(userId, refreshTokenId) {
        const token = await this.prisma.refreshToken.findUnique({ where: { id: refreshTokenId } });
        if (!token || token.userId !== userId || token.revokedAt || token.expiresAt < new Date()) {
            throw new common_1.UnauthorizedException({ code: 'REFRESH_INVALID', message: 'Refresh token invalid' });
        }
        await this.prisma.refreshToken.update({
            where: { id: refreshTokenId },
            data: { revokedAt: new Date() },
        });
        const user = await this.usersService.findById(userId);
        if (!user.active) {
            throw new common_1.UnauthorizedException({ code: 'USER_INACTIVE', message: 'User inactive' });
        }
        return this.issueTokens(user.id, user.role);
    }
    async logout(userId, refreshTokenId) {
        const token = await this.prisma.refreshToken.findUnique({ where: { id: refreshTokenId } });
        if (!token || token.userId !== userId || token.revokedAt) {
            return;
        }
        await this.prisma.refreshToken.update({
            where: { id: refreshTokenId },
            data: { revokedAt: new Date() },
        });
    }
    async changePassword(userId, currentPassword, newPassword) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user || !user.active) {
            throw new common_1.UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' });
        }
        const matches = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!matches) {
            throw new common_1.UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' });
        }
        const passwordHash = await bcrypt.hash(newPassword, 10);
        await this.prisma.user.update({
            where: { id: userId },
            data: { passwordHash, mustChangePassword: false },
        });
    }
    async issueTokens(userId, role) {
        const accessExpiresIn = process.env.JWT_ACCESS_EXPIRES_IN || '365d';
        const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '3650d';
        const refreshTokenId = await this.prisma.refreshToken.create({
            data: {
                userId,
                expiresAt: (0, duration_1.addDurationToDate)(new Date(), refreshExpiresIn),
            },
        });
        const accessToken = await this.jwtService.signAsync({ sub: userId, role }, { secret: process.env.JWT_SECRET, expiresIn: accessExpiresIn });
        const refreshToken = await this.jwtService.signAsync({ sub: userId, role, jti: refreshTokenId.id }, { secret: process.env.JWT_REFRESH_SECRET, expiresIn: refreshExpiresIn });
        return {
            accessToken,
            refreshToken,
            accessTokenExpiresIn: (0, duration_1.parseDurationToSeconds)(accessExpiresIn),
            refreshTokenExpiresIn: (0, duration_1.parseDurationToSeconds)(refreshExpiresIn),
        };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [users_service_1.UsersService,
        prisma_service_1.PrismaService,
        jwt_1.JwtService])
], AuthService);
//# sourceMappingURL=auth.service.js.map