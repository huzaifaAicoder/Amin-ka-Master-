import "@/global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { ActivityIndicator, Platform, Text, View } from "react-native";
import * as ScreenCapture from "expo-screen-capture";
import * as Network from "expo-network";
import { usePreventScreenCapture } from "expo-screen-capture";
import "@/lib/_core/nativewind-pressable";
import { ThemeProvider } from "@/lib/theme-provider";
import { LanguagePreferenceProvider } from "@/lib/language-preference";
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
import { TelemetryReporter } from "@/components/telemetry-reporter";

const DEFAULT_WEB_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const DEFAULT_WEB_FRAME: Rect = { x: 0, y: 0, width: 0, height: 0 };

function AuthenticationGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useLmsSession();
  const controlsQuery = trpc.catalog.uiSettings.useQuery(undefined, { enabled: Boolean(user && user.role !== "developer"), retry: false, staleTime: 60_000, gcTime: 5 * 60_000, refetchOnWindowFocus: false });
  const studentOverridesQuery = trpc.student.featureOverrides.useQuery(undefined, { enabled: user?.role === "student", retry: false });
  const router = useRouter();
  const segments = useSegments();
  const rootSegment = segments[0];
  const isAuthRoute = rootSegment === "auth" || rootSegment === "oauth";
  const isDeveloperRoute = rootSegment === "dev-portal" || rootSegment === "view-as";
  const isStaffRoute = rootSegment === "operations";
  // Account contains a deliberately role-aware Staff/Owner surface. All other Student tabs
  // remain protected from non-Student sessions by the existing redirect below.
  const isStudentTabRoute = rootSegment === "(tabs)" && segments[1] !== "account";
  const isStudentPortalRoute = isStudentTabRoute || rootSegment === "course" || rootSegment === "lesson" || rootSegment === "tests" || rootSegment === "test" || rootSegment === "test-history" || rootSegment === "live" || rootSegment === "notifications" || rootSegment === "sessions" || rootSegment === "study-coach" || rootSegment === "guardian-reports" || rootSegment === "amin-toolkit" || rootSegment === "toolkit";
  const controls = controlsQuery.data;
  const studentOverrides = studentOverridesQuery.data;
  const networkState = Network.useNetworkState();
  const flag = useCallback((key: string, fallback = true) => typeof controls?.[key as keyof typeof controls] === "boolean" ? Boolean(controls?.[key as keyof typeof controls]) : fallback, [controls]);
  const studentFeature = useCallback((key: string) => studentOverrides?.[key] !== false, [studentOverrides]);
  const panelPaused = Boolean(user && user.role !== "developer" && (flag("platform.maintenance_enabled", false) || (user.role === "student" && !flag("platform.student_access_enabled")) || ((user.role === "teacher" || user.role === "admin") && !flag("platform.staff_access_enabled")) || (user.role === "super_admin" && !flag("platform.owner_access_enabled"))));
  const studentFeaturePaused = Boolean(user?.role === "student" && (((rootSegment === "shorts" || segments[1] === "shorts") && (!flag("feature.shorts_enabled") || !studentFeature("shorts"))) || ((rootSegment === "downloads" || segments[1] === "downloads") && (!flag("feature.downloads_enabled") || !studentFeature("downloads"))) || ((rootSegment === "ask-ai" || rootSegment === "ai-quiz") && (!flag("feature.ai_doubt_enabled") || !studentFeature("ai_doubt") || (rootSegment === "ai-quiz" && (!flag("feature.ai_quiz_enabled") || !studentFeature("ai_quiz"))))) || (rootSegment === "study-coach" && (!flag("feature.study_coach_enabled") || !studentFeature("study_coach"))) || (rootSegment === "guardian-reports" && (!flag("feature.guardian_reports_enabled") || !studentFeature("guardian_reports"))) || ((rootSegment === "amin-toolkit" || rootSegment === "toolkit") && (!flag("feature.amin_toolkit_enabled") || !studentFeature("amin_toolkit"))) || ((rootSegment === "tests" || rootSegment === "test" || rootSegment === "test-history") && (!flag("feature.assessments_enabled") || !studentFeature("assessments"))) || ((rootSegment === "live" || rootSegment === "sessions") && (!flag("feature.live_classes_enabled") || !studentFeature("live_classes"))) || (rootSegment === "course" && (!flag("feature.courses_enabled") || !studentFeature("courses")))));
  const staffFeaturePaused = Boolean((user?.role === "teacher" || user?.role === "admin" || user?.role === "super_admin") && rootSegment === "operations" && ((segments[1] === "learning-ops" && !flag("feature.learning_operations_enabled")) || (segments[1] === "guardian-reports" && !flag("feature.guardian_reports_enabled"))));
  const offlineStudent = user?.role === "student" && (networkState.isInternetReachable === false || networkState.isConnected === false);

  useEffect(() => {
    if (loading) return;
    if (!user && !isAuthRoute && !isDeveloperRoute) router.replace("/auth");
    if (user && isAuthRoute) router.replace(user.role === "developer" ? "/dev-portal" : user.role === "student" ? "/" : "/operations");
    if (user?.role === "developer" && !isDeveloperRoute) router.replace("/dev-portal");
    if (user && user.role !== "developer" && isDeveloperRoute) router.replace(user.role === "student" ? "/" : "/operations");
    if (user?.role === "student" && isStaffRoute) router.replace("/");
    if (user && user.role !== "student" && user.role !== "developer" && isStudentPortalRoute) router.replace("/operations");
    if (offlineStudent && rootSegment !== "downloads" && flag("feature.downloads_enabled") && studentFeature("downloads")) router.replace("/downloads");
  }, [flag, isAuthRoute, isDeveloperRoute, isStaffRoute, isStudentPortalRoute, loading, offlineStudent, rootSegment, router, studentFeature, user]);

  const routeTransitioning = loading || (!user && !isAuthRoute && !isDeveloperRoute) || (user && isAuthRoute) || (user?.role === "developer" && !isDeveloperRoute) || (user && user.role !== "developer" && isDeveloperRoute) || (user?.role === "student" && isStaffRoute) || (user && user.role !== "student" && user.role !== "developer" && isStudentPortalRoute);
  // Keep the child Stack mounted under the blocker. This makes its route registry available
  // before the guarded redirect runs and prevents an unhandled REPLACE action during hydration.
  return <>{children}{routeTransitioning ? <View pointerEvents="auto" style={{ position: "absolute", zIndex: 50, top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFDF7" }}><ActivityIndicator /></View> : null}{!routeTransitioning && (panelPaused || studentFeaturePaused || staffFeaturePaused) ? <View style={{ position: "absolute", zIndex: 50, top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", padding: 28, backgroundColor: "#FFFDF7" }}><Text style={{ color: "#14213D", fontSize: 20, fontWeight: "900", textAlign: "center" }}>{panelPaused ? "Access is temporarily paused" : "This feature is temporarily unavailable"}</Text><Text style={{ color: "#667085", fontSize: 13, lineHeight: 20, textAlign: "center", marginTop: 10 }}>The Developer has temporarily disabled this area. Please check back later or contact your platform administrator.</Text></View> : null}</>;
}

function NativeStudentCaptureGuard() {
  usePreventScreenCapture("student-session");
  useEffect(() => {
    const key = "student-root-secure";
    void ScreenCapture.preventScreenCaptureAsync(key).catch(() => undefined);
    if (Platform.OS === "ios") void ScreenCapture.enableAppSwitcherProtectionAsync(1).catch(() => undefined);
    return () => {
      void ScreenCapture.allowScreenCaptureAsync(key).catch(() => undefined);
      if (Platform.OS === "ios") void ScreenCapture.disableAppSwitcherProtectionAsync().catch(() => undefined);
    };
  }, []);
  return null;
}

function StudentSessionCaptureGuard() {
  const { user } = useLmsSession();
  if (Platform.OS === "web" || user?.role !== "student") return null;
  return <NativeStudentCaptureGuard />;
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
            // Refresh mounted live data when the app returns to the foreground.
            // Individual screens retain bounded pull-to-refresh for immediate control.
            refetchOnWindowFocus: true,
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
          <LanguagePreferenceProvider><LmsSessionProvider>
            <StudentSessionCaptureGuard />
            <TelemetryReporter />
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
          </LmsSessionProvider></LanguagePreferenceProvider>
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
