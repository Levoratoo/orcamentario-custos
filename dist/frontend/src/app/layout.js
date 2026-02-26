"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.metadata = void 0;
exports.default = RootLayout;
const google_1 = require("next/font/google");
require("./globals.css");
const app_providers_1 = require("@/components/providers/app-providers");
const inter = (0, google_1.Inter)({ subsets: ['latin'] });
exports.metadata = {
    title: 'Printbag | Planejamento Orcamentario',
    description: 'Planejamento Orcamentario por Coordenador',
};
function RootLayout({ children }) {
    return (<html lang="pt-BR" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen antialiased`}>
        <app_providers_1.AppProviders>{children}</app_providers_1.AppProviders>
      </body>
    </html>);
}
//# sourceMappingURL=layout.js.map