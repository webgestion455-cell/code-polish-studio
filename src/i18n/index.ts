import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import fr from "./locales/fr.json";
import en from "./locales/en.json";
import de from "./locales/de.json";
import es from "./locales/es.json";
import sl from "./locales/sl.json";
import bg from "./locales/bg.json";
import sk from "./locales/sk.json";

export const SUPPORTED_LANGUAGES = [
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "sl", label: "Slovenščina", flag: "🇸🇮" },
  { code: "bg", label: "Български", flag: "🇧🇬" },
  { code: "sk", label: "Slovenčina", flag: "🇸🇰" },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

if (!i18n.isInitialized) {
  void i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: {
        fr: { translation: fr },
        en: { translation: en },
        de: { translation: de },
        es: { translation: es },
        sl: { translation: sl },
        bg: { translation: bg },
        sk: { translation: sk },
      },
      lng: undefined,
      fallbackLng: "fr",
      // Restreint strictement aux langues supportées (sinon -> fallbackLng)
      supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
      nonExplicitSupportedLngs: true, // "fr-FR" -> "fr", "en-US" -> "en"
      load: "languageOnly",
      initAsync: false,
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
      detection: {
        order: [
          "localStorage",
          "navigator",
          "htmlTag",
          "path",
          "subdomain",
        ],
        caches: ["localStorage", "cookie"],
        lookupLocalStorage: "hsbc.lang",
      },
    });
}

export default i18n;
