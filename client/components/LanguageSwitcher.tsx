import { useTranslation } from "react-i18next";

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const currentLanguage = i18n.language.startsWith("en") ? "en" : "vi";

  const changeLanguage = (language: "vi" | "en") => {
    void i18n.changeLanguage(language);
    localStorage.setItem("language", language);
  };

  return (
    <div
      role="group"
      aria-label={currentLanguage === "vi" ? "Chọn ngôn ngữ" : "Choose language"}
      className="flex items-center rounded-xl border border-slate-200/90 bg-slate-100/90 p-1 shadow-2xs"
    >
      <button
        type="button"
        aria-label="Tiếng Việt"
        aria-pressed={currentLanguage === "vi"}
        onClick={() => changeLanguage("vi")}
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition duration-150 ${
          currentLanguage === "vi"
            ? "bg-white text-blue-700 shadow-2xs"
            : "text-slate-500 hover:text-slate-900"
        }`}
      >
        <span className="text-xs">🇻🇳</span>
        <span className="hidden sm:inline">Tiếng Việt</span>
        <span className="sm:hidden">VIE</span>
      </button>
      <button
        type="button"
        aria-label="English"
        aria-pressed={currentLanguage === "en"}
        onClick={() => changeLanguage("en")}
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition duration-150 ${
          currentLanguage === "en"
            ? "bg-white text-blue-700 shadow-2xs"
            : "text-slate-500 hover:text-slate-900"
        }`}
      >
        <span className="text-xs font-bold">EN</span>
        <span className="hidden sm:inline">English</span>
        <span className="sm:hidden">EN</span>
      </button>
    </div>
  );
}
