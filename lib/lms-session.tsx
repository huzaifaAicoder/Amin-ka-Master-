import * as Auth from "@/lib/_core/auth";
import { trpc } from "@/lib/trpc";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type LmsUser = {
  id: number;
  openId: string;
  fullName: string | null;
  email: string | null;
  mobile: string | null;
  loginMethod: string | null;
  role: "student" | "teacher" | "admin" | "super_admin";
  avatarUrl: string | null;
  createdAt: Date | string;
};

type SessionContextValue = {
  user: LmsUser | null;
  loading: boolean;
  completeLogin: (payload: { user: LmsUser; session: { token: string } }) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const LmsSessionContext = createContext<SessionContextValue | undefined>(undefined);

export function LmsSessionProvider({ children }: { children: React.ReactNode }) {
  const [tokenReady, setTokenReady] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [localUser, setLocalUser] = useState<LmsUser | null>(null);
  const utils = trpc.useUtils();
  const meQuery = trpc.auth.me.useQuery(undefined, { enabled: tokenReady && hasToken, retry: false });
  const logoutMutation = trpc.auth.logout.useMutation();

  useEffect(() => {
    void (async () => {
      const [token, cachedUser] = await Promise.all([Auth.getSessionToken(), Auth.getUserInfo()]);
      // A previous development build created this session without individual staff authentication.
      // It is explicitly retired so phone previews must use the secure portal login flow.
      if ((cachedUser as LmsUser | null)?.openId === "local_demo_super_admin") {
        await Promise.all([Auth.removeSessionToken(), Auth.clearUserInfo()]);
        setHasToken(false);
        setLocalUser(null);
        setTokenReady(true);
        return;
      }
      setHasToken(Boolean(token));
      setLocalUser((cachedUser as LmsUser | null) ?? null);
      setTokenReady(true);
    })();
  }, []);

  useEffect(() => {
    if (meQuery.data) {
      setLocalUser(meQuery.data);
      void Auth.setUserInfo(meQuery.data);
    }
    if (meQuery.isError) {
      setLocalUser(null);
      setHasToken(false);
      void Promise.all([Auth.removeSessionToken(), Auth.clearUserInfo()]);
    }
  }, [meQuery.data, meQuery.isError]);

  const completeLogin = useCallback(async (payload: { user: LmsUser; session: { token: string } }) => {
    await Promise.all([Auth.setSessionToken(payload.session.token), Auth.setUserInfo(payload.user)]);
    setLocalUser(payload.user);
    setHasToken(true);
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } finally {
      await Promise.all([Auth.removeSessionToken(), Auth.clearUserInfo()]);
      utils.auth.me.setData(undefined, null);
      setLocalUser(null);
      setHasToken(false);
    }
  }, [logoutMutation, utils.auth.me]);

  const refresh = useCallback(async () => {
    if (hasToken) await meQuery.refetch();
  }, [hasToken, meQuery]);

  const value = useMemo<SessionContextValue>(
    () => ({
      user: meQuery.data ?? localUser,
      loading: !tokenReady || (hasToken && meQuery.isLoading),
      completeLogin,
      logout,
      refresh,
    }),
    [completeLogin, hasToken, localUser, logout, meQuery.data, meQuery.isLoading, refresh, tokenReady],
  );

  return <LmsSessionContext.Provider value={value}>{children}</LmsSessionContext.Provider>;
}

export function useLmsSession() {
  const context = useContext(LmsSessionContext);
  if (!context) throw new Error("useLmsSession must be used inside LmsSessionProvider");
  return context;
}
