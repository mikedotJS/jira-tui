import i18next from "../src/i18n.js";

// Les tests vérifient les textes français, quelle que soit la langue de la machine.
await i18next.changeLanguage("fr");
