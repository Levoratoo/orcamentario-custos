'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppProviders = AppProviders;
const theme_provider_1 = require("@/components/providers/theme-provider");
const query_provider_1 = require("@/components/providers/query-provider");
const auth_provider_1 = require("@/components/providers/auth-provider");
const sonner_1 = require("@/components/ui/sonner");
function AppProviders({ children }) {
    return (<theme_provider_1.ThemeProvider>
      <query_provider_1.QueryProvider>
        <auth_provider_1.AuthProvider>
          {children}
          <sonner_1.Toaster richColors closeButton position="top-right"/>
        </auth_provider_1.AuthProvider>
      </query_provider_1.QueryProvider>
    </theme_provider_1.ThemeProvider>);
}
//# sourceMappingURL=app-providers.js.map