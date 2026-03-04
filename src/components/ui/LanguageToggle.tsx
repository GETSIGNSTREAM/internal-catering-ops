"use client";

import { useTranslation } from "react-i18next";
import { useSession } from "next-auth/react";

export default function LanguageToggle() {
  const { t, i18n } = useTranslation();
  const { update } = useSession();

  const currentLang = i18n.language;

  const handleChange = async (lang: string) => {
    i18n.changeLanguage(lang);
    await update({ language: lang });
  };

  return (
    <div className="bg-dark-700 rounded-xl p-4">
      <label className="block text-sm text-gray-400 mb-3">{t("common.language")}</label>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => handleChange("en")}
          className={`py-3 rounded-xl font-medium transition-colors ${
            currentLang === "en" ? "bg-chicken-primary text-dark-900" : "bg-dark-600 text-gray-300"
          }`}
        >
          English
        </button>
        <button
          type="button"
          onClick={() => handleChange("es")}
          className={`py-3 rounded-xl font-medium transition-colors ${
            currentLang === "es" ? "bg-chicken-primary text-dark-900" : "bg-dark-600 text-gray-300"
          }`}
        >
          Espanol
        </button>
      </div>
    </div>
  );
}
