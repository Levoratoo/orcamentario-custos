'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthProvider = AuthProvider;
exports.useAuth = useAuth;
const react_1 = require("react");
const navigation_1 = require("next/navigation");
const auth_1 = require("@/lib/api/auth");
const AuthContext = (0, react_1.createContext)(undefined);
function AuthProvider({ children }) {
    const [user, setUser] = (0, react_1.useState)(null);
    const [accessToken, setAccessToken] = (0, react_1.useState)(null);
    const [isLoading, setIsLoading] = (0, react_1.useState)(true);
    const router = (0, navigation_1.useRouter)();
    const refresh = async () => {
        try {
            const refreshed = await auth_1.apiAuth.refresh();
            setAccessToken(refreshed.accessToken);
            setUser(refreshed.user);
            return refreshed.accessToken;
        }
        catch {
            setAccessToken(null);
            setUser(null);
            return null;
        }
    };
    const login = async (email, password) => {
        const result = await auth_1.apiAuth.login(email, password);
        setAccessToken(result.accessToken);
        setUser(result.user);
        router.push('/dashboard');
    };
    const logout = async () => {
        await auth_1.apiAuth.logout();
        setAccessToken(null);
        setUser(null);
        router.push('/login');
    };
    (0, react_1.useEffect)(() => {
        const init = async () => {
            await refresh();
            setIsLoading(false);
        };
        init();
    }, []);
    (0, react_1.useEffect)(() => {
        if (!isLoading && !user && typeof window !== 'undefined' && window.location.pathname !== '/login') {
            router.push('/login');
        }
    }, [isLoading, user, router]);
    const value = (0, react_1.useMemo)(() => ({ user, accessToken, isLoading, login, logout, refresh, setAccessToken }), [user, accessToken, isLoading]);
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
function useAuth() {
    const ctx = (0, react_1.useContext)(AuthContext);
    if (!ctx) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return ctx;
}
//# sourceMappingURL=auth-provider.js.map