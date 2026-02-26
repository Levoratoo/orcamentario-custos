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
const bsc_controller_1 = require("./bsc.controller");
const bsc_import_service_1 = require("./bsc-import.service");
const bsc_service_1 = require("./bsc.service");
let BscModule = class BscModule {
};
exports.BscModule = BscModule;
exports.BscModule = BscModule = __decorate([
    (0, common_1.Module)({
        controllers: [bsc_controller_1.BscController],
        providers: [bsc_import_service_1.BscImportService, bsc_service_1.BscService],
    })
], BscModule);
//# sourceMappingURL=bsc.module.js.map