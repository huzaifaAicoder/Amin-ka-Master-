import "@/global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { ActivityIndicator, Platform, View } from "react-native";
import "@/lib/_core/nativewind-pressable";
import { ThemeProvider } from "@/lib/theme-provider";
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import type { EdgeInsets, Metrics, Rect } from "react-native-safe-area-context";

import { trpc, createTRPCClient } from "@/lib/trpc";
import { initManusRuntime, subscribeSafeAreaInsets } from "@/lib/_core/manus-runtime";
import { LmsSessionProvider, useLmsSession } from "@/lib/lms-session";
import { OwnerPermissionsShortcut } from "@/components/owner-permissions-shortcut";
import { MediaMaintenanceShortcut } from "@/components/media-maintenance-shortcut";

const DEFAULT_WEB_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const DEFAULT_WEB_FRAME: Rect = { x: 0, y: 0, width: 0, height: 0 };

function AuthenticationGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useLmsSession();
  const router = useRouter();
  const segments = useSegments();
  const rootSegment = segments[0];
  const isAuthRoute = rootSegment === "auth" || rootSegment === "oauth";
  const isDeveloperRoute = rootSegment === "dev-portal";
  const isStaffRoute = rootSegment === "operations";
  const isStudentPortalRoute = rootSegment === "(tabs)" || rootSegment === "course" || rootSegment === "lesson" || rootSegment === "tests" || rootSegment === "test" || rootSegment === "live" || rootSegment === "notifications" || rootSegment === "sessions";

  useEffect(() => {
    if (loading) return;
    if (!user && !isAuthRoute && !isDeveloperRoute) router.replace("/auth");
    if (user && isAuthRoute) router.replace(user.role === "developer" ? "/dev-portal" : user.role === "student" ? "/" : "/operations");
    if (user?.role === "developer" && !isDeveloperRoute) router.replace("/dev-portal");
    if (user && user.role !== "developer" && isDeveloperRoute) router.replace(user.role === "student" ? "/" : "/operations");
    if (user?.role === "student" && isStaffRoute) router.replace("/");
    if (user && user.role !== "student" && user.role !== "developer" && isStudentPortalRoute) router.replace("/operations");
  }, [isAuthRoute, isDeveloperRoute, isStaffRoute, isStudentPortalRoute, loading, router, user]);

  if (loading || (!user && !isAuthRoute && !isDeveloperRoute) || (user && isAuthRoute) || (user?.role === "developer" && !isDeveloperRoute) || (user && user.role !== "developer" && isDeveloperRoute) || (user?.role === "student" && isStaffRoute) || (user && user.role !== "student" && user.role !== "developer" && isStudentPortalRoute)) {
    return <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator /></View>;
  }
  return <>{children}</>;
}

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const initialInsets = initialWindowMetrics?.insets ?? DEFAULT_WEB_INSETS;
  const initialFrame = initialWindowMetrics?.frame ?? DEFAULT_WEB_FRAME;

  const [insets, setInsets] = useState<EdgeInsets>(initialInsets);
  const [frame, setFrame] = useState<Rect>(initialFrame);

  // Initialize Manus runtime for cookie injection from parent container
  useEffect(() => {
    initManusRuntime();
  }, []);

  const handleSafeAreaUpdate = useCallback((metrics: Metrics) => {
    setInsets(metrics.insets);
    setFrame(metrics.frame);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const unsubscribe = subscribeSafeAreaInsets(handleSafeAreaUpdate);
    return () => unsubscribe();
  }, [handleSafeAreaUpdate]);

  // Create clients once and reuse them
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Disable automatic refetching on window focus for mobile
            refetchOnWindowFocus: false,
            // Retry failed requests once
            retry: 1,
          },
        },
      }),
  );
  const [trpcClient] = useState(() => createTRPCClient());

  // Ensure minimum 8px padding for top and bottom on mobile
  const providerInitialMetrics = useMemo(() => {
    const metrics = initialWindowMetrics ?? { insets: initialInsets, frame: initialFrame };
    return {
      ...metrics,
      insets: {
        ...metrics.insets,
        top: Math.max(metrics.insets.top, 16),
        bottom: Math.max(metrics.insets.bottom, 12),
      },
    };
  }, [initialInsets, initialFrame]);

  const content = (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <LmsSessionProvider>
            <AuthenticationGate>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="auth" />
                <Stack.Screen name="dev-portal" />
                <Stack.Screen name="oauth/callback" />
              </Stack>
              <MediaMaintenanceShortcut />
              <OwnerPermissionsShortcut />
            </AuthenticationGate>
            <StatusBar style="auto" />
          </LmsSessionProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </GestureHandlerRootView>
  );

  const shouldOverrideSafeArea = Platform.OS === "web";

  if (shouldOverrideSafeArea) {
    return (
      <ThemeProvider>
        <SafeAreaProvider initialMetrics={providerInitialMetrics}>
          <SafeAreaFrameContext.Provider value={frame}>
            <SafeAreaInsetsContext.Provider value={insets}>
              {content}
            </SafeAreaInsetsContext.Provider>
          </SafeAreaFrameContext.Provider>
        </SafeAreaProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <SafeAreaProvider initialMetrics={providerInitialMetrics}>{content}</SafeAreaProvider>
    </ThemeProvider>
  );
}
