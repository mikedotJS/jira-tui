import i18next from "i18next";
import { en, type Translation } from "./locales/en.js";
import { fr } from "./locales/fr.js";

declare module "i18next" {
	interface CustomTypeOptions {
		resources: { translation: Translation };
	}
}

// Langue de l'OS (LC_ALL / LANG) ; l'anglais pour tout ce qui n'est pas traduit.
i18next.init({
	lng: new Intl.Locale(Intl.DateTimeFormat().resolvedOptions().locale).language,
	fallbackLng: "en",
	resources: { en: { translation: en }, fr: { translation: fr } },
	interpolation: { escapeValue: false },
	initAsync: false,
});

export default i18next;
export const { t } = i18next;
