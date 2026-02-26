"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BscModule = void 0;
const common_1 = require("@nestjs/common");
const prisma_module_1 = require("../../prisma/prisma.module");
const bsc_controller_1 = require("./bsc.controller");
const bsc_service_1 = require("./bsc.service");
const BscExcelImportService_1 = require("./import/BscExcelImportService");
const bscImports_repo_1 = require("./repositories/bscImports.repo");
const bscPerspective_repo_1 = require("./repositories/bscPerspective.repo");
const bscObjective_repo_1 = require("./repositories/bscObjective.repo");
const bscIndicator_repo_1 = require("./repositories/bscIndicator.repo");
const bscTargets_repo_1 = require("./repositories/bscTargets.repo");
const bscActuals_repo_1 = require("./repositories/bscActuals.repo");
const bscActionPlans_repo_1 = require("./repositories/bscActionPlans.repo");
const bscProjects_repo_1 = require("./repositories/bscProjects.repo");
const bscTasks_repo_1 = require("./repositories/bscTasks.repo");
const bscSnapshots_repo_1 = require("./repositories/bscSnapshots.repo");
let BscModule = class BscModule {
};
exports.BscModule = BscModule;
exports.BscModule = BscModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule],
        controllers: [bsc_controller_1.BscController],
        providers: [
            bsc_service_1.BscService,
            BscExcelImportService_1.BscExcelImportService,
            bscImports_repo_1.BscImportsRepo,
            bscPerspective_repo_1.BscPerspectiveRepo,
            bscObjective_repo_1.BscObjectiveRepo,
            bscIndicator_repo_1.BscIndicatorRepo,
            bscTargets_repo_1.BscTargetsRepo,
            bscActuals_repo_1.BscActualsRepo,
            bscActionPlans_repo_1.BscActionPlansRepo,
            bscProjects_repo_1.BscProjectsRepo,
            bscTasks_repo_1.BscTasksRepo,
            bscSnapshots_repo_1.BscSnapshotsRepo,
        ],
        exports: [BscExcelImportService_1.BscExcelImportService, bsc_service_1.BscService],
    })
], BscModule);
//# sourceMappingURL=bsc.module.js.map