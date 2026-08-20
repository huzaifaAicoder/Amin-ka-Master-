import { useCallback, useEffect, useMemo } from "react";
import { Platform } from "react-native";
import { useSegments } from "expo-router";

import { useLmsSession } from "@/lib/lms-session";
import { trpc } from "@/lib/trpc";

type CrashClass = "unhandled_error" | "unhandled_rejection" | "react_render";
type RouteGroup = "auth" | "student" | "staff" | "developer" | "other";

function routeGroupFor(segment: string | undefined): RouteGroup {
  if (segment === "auth" || segment === "oauth") return "auth";
  if (segment === "operations") return "staff";
  if (segment === "dev-portal" || segment === "view-as") return "developer";
  if (segment === "(tabs)" || segment === "course" || segment === "lesson" || segment === "tests" || segment === "test" || segment === "downloads" || segment === "study-coach" || segment === "guardian-reports") return "student";
  return "other";
}

function telemetryPlatform(): "android" | "ios" | "web" | "unknown" {
  if (Platform.OS === "android" || Platform.OS === "ios" || Platform.OS === "web") return Platform.OS;
  return "unknown";
}

/** Reports only three fixed categories after a signed-in user has opted into
 * Developer-controlled crash telemetry. No message, stack, route path, user ID,
 * device identifier, input, file, or other error data crosses this boundary. */
export function TelemetryReporter() {
  const { user } = useLmsSession();
  const segments = useSegments();
  const routeGroup = useMemo(() => routeGroupFor(segments[0]), [segments]);
  const configuration = trpc.telemetry.config.useQuery(undefined, { enabled: Boolean(user), retry: false, staleTime: 60_000 });
  const reportCrash = trpc.telemetry.reportCrash.useMutation();
  const report = useCallback((errorClass: CrashClass) => {
    if (!user || !configuration.data?.crashReportingEnabled) return;
    reportCrash.mutate({ platform: telemetryPlatform(), routeGroup, errorClass });
  }, [configuration.data?.crashReportingEnabled, reportCrash, routeGroup, user]);

  useEffect(() => {
    if (!user || !configuration.data?.crashReportingEnabled) return;
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const onError = () => report("unhandled_error");
      const onRejection = () => report("unhandled_rejection");
      window.addEventListener("error", onError);
      window.addEventListener("unhandledrejection", onRejection);
      return () => { window.removeEventListener("error", onError); window.removeEventListener("unhandledrejection", onRejection); };
    }
    type NativeErrorHandler = (error: Error, isFatal?: boolean) => void;
    type NativeErrorUtils = { getGlobalHandler?: () => NativeErrorHandler; setGlobalHandler?: (handler: NativeErrorHandler) => void };
    const errorUtils = (globalThis as unknown as { ErrorUtils?: NativeErrorUtils }).ErrorUtils;
    const previous = errorUtils?.getGlobalHandler?.();
    if (!errorUtils?.setGlobalHandler) return;
    errorUtils.setGlobalHandler((error, isFatal) => { report("unhandled_error"); previous?.(error, isFatal); });
    return () => { if (previous) errorUtils.setGlobalHandler?.(previous); };
  }, [configuration.data?.crashReportingEnabled, report, user]);

  return null;
}
