'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThemeToggle = ThemeToggle;
const lucide_react_1 = require("lucide-react");
const next_themes_1 = require("next-themes");
const button_1 = require("@/components/ui/button");
function ThemeToggle() {
    const { theme, setTheme } = (0, next_themes_1.useTheme)();
    const isDark = theme === 'dark';
    return (<button_1.Button variant="ghost" size="icon" onClick={() => setTheme(isDark ? 'light' : 'dark')} aria-label="Alternar tema">
      {isDark ? <lucide_react_1.Sun className="h-4 w-4"/> : <lucide_react_1.Moon className="h-4 w-4"/>}
    </button_1.Button>);
}
//# sourceMappingURL=theme-toggle.js.map