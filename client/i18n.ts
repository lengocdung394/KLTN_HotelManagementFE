import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import vi from "./locales/vi.json";

const savedLanguage =
  typeof window !== "undefined" && typeof localStorage !== "undefined"
    ? localStorage.getItem("language")
    : null;

export const localizedText = (vietnamese: string, english: string) =>
  i18n.language.startsWith("en") ? english : vietnamese;

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    vi: { translation: vi },
  },
  lng: savedLanguage === "en" || savedLanguage === "vi" ? savedLanguage : "vi",
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
