"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseDurationToSeconds = parseDurationToSeconds;
exports.addDurationToDate = addDurationToDate;
function parseDurationToSeconds(value) {
    const match = value.match(/^(\d+)([smhd])$/);
    if (!match) {
        return 0;
    }
    const amount = Number(match[1]);
    const unit = match[2];
    switch (unit) {
        case 's':
            return amount;
        case 'm':
            return amount * 60;
        case 'h':
            return amount * 3600;
        case 'd':
            return amount * 86400;
        default:
            return 0;
    }
}
function addDurationToDate(date, value) {
    const seconds = parseDurationToSeconds(value);
    return new Date(date.getTime() + seconds * 1000);
}
//# sourceMappingURL=duration.js.map