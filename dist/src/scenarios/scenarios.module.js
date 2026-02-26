"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScenariosModule = void 0;
const common_1 = require("@nestjs/common");
const scenarios_service_1 = require("./scenarios.service");
const scenarios_controller_1 = require("./scenarios.controller");
const prisma_module_1 = require("../prisma/prisma.module");
const audit_module_1 = require("../audit/audit.module");
let ScenariosModule = class ScenariosModule {
};
exports.ScenariosModule = ScenariosModule;
exports.ScenariosModule = ScenariosModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, audit_module_1.AuditModule],
        controllers: [scenarios_controller_1.ScenariosController],
        providers: [scenarios_service_1.ScenariosService],
        exports: [scenarios_service_1.ScenariosService],
    })
], ScenariosModule);
//# sourceMappingURL=scenarios.module.js.map