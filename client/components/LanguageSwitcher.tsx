import { useTranslation } from "react-i18next";

function HeaderFlagIcon({ code }: { code: "vi" | "en" }) {
  if (code === "vi") {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4 rounded-full shrink-0 shadow-xs">
        <rect width="24" height="24" fill="#DA251D" />
        <polygon
          points="12,5 13.59,9.82 18.66,9.84 14.57,12.84 16.11,17.66 12,14.7 7.89,17.66 9.43,12.84 5.34,9.84 10.41,9.82"
          fill="#FFFF00"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 rounded-full shrink-0 shadow-xs">
      <clipPath id="admin-uk-flag-clip">
        <circle cx="12" cy="12" r="12" />
      </clipPath>
      <g clipPath="url(#admin-uk-flag-clip)">
        <rect width="24" height="24" fill="#012169" />
        <path d="M0,0 L24,24 M24,0 L0,24" stroke="#FFF" strokeWidth="4" />
        <path d="M0,0 L24,24 M24,0 L0,24" stroke="#C8102E" strokeWidth="2.5" />
        <path d="M12,0 V24 M0,12 H24" stroke="#FFF" strokeWidth="6" />
        <path d="M12,0 V24 M0,12 H24" stroke="#C8102E" strokeWidth="3.5" />
      </g>
    </svg>
  );
}

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const currentLanguage = i18n.language.startsWith("en") ? "en" : "vi";

  const changeLanguage = (language: "vi" | "en") => {
    void i18n.changeLanguage(language);
    localStorage.setItem("language", language);
  };

  return (
    <button
      type="button"
      onClick={() => changeLanguage(currentLanguage === "vi" ? "en" : "vi")}
      className="inline-flex h-10 items-center gap-1.5 rounded-full border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 shrink-0"
      aria-label="Chuyển đổi ngôn ngữ Tiếng Việt / English"
      title={currentLanguage === "vi" ? "Bấm để đổi sang English" : "Click to switch to Tiếng Việt"}
    >
      <HeaderFlagIcon code={currentLanguage} />
      <span className="uppercase tracking-wider font-bold text-slate-800">
        {currentLanguage}
      </span>
    </button>
  );
}
