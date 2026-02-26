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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BudgetItemsController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const budget_items_service_1 = require("./budget-items.service");
const create_budget_item_dto_1 = require("./dto/create-budget-item.dto");
const update_budget_item_dto_1 = require("./dto/update-budget-item.dto");
const update_budget_item_values_dto_1 = require("./dto/update-budget-item-values.dto");
const apply_value_dto_1 = require("./dto/apply-value.dto");
const copy_from_month_dto_1 = require("./dto/copy-from-month.dto");
const distribute_total_dto_1 = require("./dto/distribute-total.dto");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
let BudgetItemsController = class BudgetItemsController {
    constructor(service) {
        this.service = service;
    }
    create(dto, user) {
        return this.service.create(dto, user);
    }
    update(id, dto, user) {
        return this.service.update(id, dto, user);
    }
    remove(id, user) {
        return this.service.delete(id, user);
    }
    updateValues(id, dto, user) {
        return this.service.updateValues(id, dto, user);
    }
    applyValue(id, dto, user) {
        return this.service.applyValue(id, dto, user);
    }
    copyFromMonth(id, dto, user) {
        return this.service.copyFromMonth(id, dto, user);
    }
    distributeTotal(id, dto, user) {
        return this.service.distributeTotal(id, dto, user);
    }
};
exports.BudgetItemsController = BudgetItemsController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_budget_item_dto_1.CreateBudgetItemDto, Object]),
    __metadata("design:returntype", void 0)
], BudgetItemsController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_budget_item_dto_1.UpdateBudgetItemDto, Object]),
    __metadata("design:returntype", void 0)
], BudgetItemsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], BudgetItemsController.prototype, "remove", null);
__decorate([
    (0, common_1.Put)(':id/values'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_budget_item_values_dto_1.UpdateBudgetItemValuesDto, Object]),
    __metadata("design:returntype", void 0)
], BudgetItemsController.prototype, "updateValues", null);
__decorate([
    (0, common_1.Post)(':id/apply-value'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, apply_value_dto_1.ApplyValueDto, Object]),
    __metadata("design:returntype", void 0)
], BudgetItemsController.prototype, "applyValue", null);
__decorate([
    (0, common_1.Post)(':id/copy-from-month'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, copy_from_month_dto_1.CopyFromMonthDto, Object]),
    __metadata("design:returntype", void 0)
], BudgetItemsController.prototype, "copyFromMonth", null);
__decorate([
    (0, common_1.Post)(':id/distribute-total'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, distribute_total_dto_1.DistributeTotalDto, Object]),
    __metadata("design:returntype", void 0)
], BudgetItemsController.prototype, "distributeTotal", null);
exports.BudgetItemsController = BudgetItemsController = __decorate([
    (0, common_1.Controller)('budget-items'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    __metadata("design:paramtypes", [budget_items_service_1.BudgetItemsService])
], BudgetItemsController);
//# sourceMappingURL=budget-items.controller.js.map