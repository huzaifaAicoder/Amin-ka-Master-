import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Platform } from "react-native";

import { COLORS } from "@/components/lms-ui";
import { trpc } from "@/lib/trpc";

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const settingsQuery = trpc.catalog.uiSettings.useQuery();
  const flags = settingsQuery.data as Record<string, unknown> | undefined;
  const isEnabled = (key: string) => flags?.[key] !== "false";
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  const tabBarHeight = 56 + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.indigo,
        tabBarInactiveTintColor: "#7B8492",
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          paddingTop: 8,
          paddingBottom: bottomPadding,
          height: tabBarHeight,
          backgroundColor: COLORS.paper,
          borderTopColor: "#E6E9EE",
          borderTopWidth: 0.5,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: "Explore",
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="safari.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="learning"
        options={{
          title: "My Learning",
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="book.closed.fill" color={color} />,
        }}
      />
      {isEnabled("feature.shorts") ? <Tabs.Screen
        name="shorts"
        options={{
          title: "Shorts",
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="bolt.circle.fill" color={color} />,
        }}
      /> : null}
      {isEnabled("feature.offline_downloads") ? <Tabs.Screen
        name="downloads"
        options={{
          title: "Downloads",
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="arrow.down.circle.fill" color={color} />,
        }}
      /> : null}
      <Tabs.Screen
        name="account"
        options={{
          title: "Account",
          tabBarIcon: ({ color }) => <IconSymbol size={27} name="person.crop.circle" color={color} />,
        }}
      />
    </Tabs>
  );
}
