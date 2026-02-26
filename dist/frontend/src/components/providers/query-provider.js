'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryProvider = QueryProvider;
const react_query_1 = require("@tanstack/react-query");
const react_1 = require("react");
function QueryProvider({ children }) {
    const [client] = (0, react_1.useState)(() => new react_query_1.QueryClient({
        defaultOptions: {
            queries: { staleTime: 30_000, retry: 1 },
            mutations: { retry: 0 },
        },
    }));
    return <react_query_1.QueryClientProvider client={client}>{children}</react_query_1.QueryClientProvider>;
}
//# sourceMappingURL=query-provider.js.map