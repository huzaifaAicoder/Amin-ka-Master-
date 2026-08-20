import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";

export type InterfaceLanguage = "english" | "hindi" | "bilingual";

type LanguageContextValue = { language: InterfaceLanguage; loading: boolean; setLanguage: (language: InterfaceLanguage) => Promise<void>; label: (english: string, hindi: string) => string };
const LanguageContext = createContext<LanguageContextValue | null>(null);
const STORAGE_KEY = "amin-ka-master.interface-language";

export function LanguagePreferenceProvider({ children }: { children: React.ReactNode }) {
  const [language, setValue] = useState<InterfaceLanguage>("bilingual");
  const [loading, setLoading] = useState(true);
  const settingsQuery = trpc.catalog.uiSettings.useQuery(undefined, { retry: false });
  const [hasSavedPreference, setHasSavedPreference] = useState(false);
  useEffect(() => { void AsyncStorage.getItem(STORAGE_KEY).then((saved) => { if (saved === "english" || saved === "hindi" || saved === "bilingual") { setValue(saved); setHasSavedPreference(true); } }).finally(() => setLoading(false)); }, []);
  useEffect(() => { if (hasSavedPreference) return; const preferred = (settingsQuery.data as Record<string, unknown> | undefined)?.["platform.interface_language_default"]; if (preferred === "english" || preferred === "hindi" || preferred === "bilingual") setValue(preferred); }, [hasSavedPreference, settingsQuery.data]);
  const setLanguage = async (next: InterfaceLanguage) => { setValue(next); setHasSavedPreference(true); await AsyncStorage.setItem(STORAGE_KEY, next); };
  const value = useMemo(() => ({ language, loading, setLanguage, label: (english: string, hindi: string) => language === "english" ? english : language === "hindi" ? hindi : `${english} · ${hindi}` }), [language, loading]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguagePreference() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguagePreference must be used inside LanguagePreferenceProvider");
  return context;
}
