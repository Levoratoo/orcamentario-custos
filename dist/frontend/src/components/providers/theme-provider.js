'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThemeProvider = ThemeProvider;
const next_themes_1 = require("next-themes");
function ThemeProvider({ children }) {
    return (<next_themes_1.ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </next_themes_1.ThemeProvider>);
}
//# sourceMappingURL=theme-provider.js.map