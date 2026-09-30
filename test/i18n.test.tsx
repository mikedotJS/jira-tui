import { render } from "ink-testing-library";
import { afterEach, expect, test } from "vitest";
import i18next from "../src/i18n.js";
import { Login } from "../src/screens/Login.js";

afterEach(() => i18next.changeLanguage("fr"));

test("l'interface passe en anglais", async () => {
	await i18next.changeLanguage("en");
	expect(render(<Login onSubmit={() => {}} />).lastFrame()).toContain(
		"Jira address",
	);
});

test("une langue non traduite retombe sur l'anglais", async () => {
	await i18next.changeLanguage("de");
	expect(render(<Login onSubmit={() => {}} />).lastFrame()).toContain(
		"Log in to Jira",
	);
});
