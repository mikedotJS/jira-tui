import { rmSync } from "node:fs";
import { expect, type Terminal, test } from "@microsoft/tui-test";

// Nécessite un vrai compte Jira : E2E_JIRA_SITE, E2E_JIRA_EMAIL, E2E_JIRA_TOKEN.
const { E2E_JIRA_SITE, E2E_JIRA_EMAIL, E2E_JIRA_TOKEN } = process.env;
const CONFIG_DIR = "/tmp/jira-tui-e2e-default-search";

// Config vierge avant le premier lancement ; le second test la réutilise.
rmSync(CONFIG_DIR, { recursive: true, force: true });

test.use({
	program: { file: "node", args: ["dist/cli.js"] },
	env: { JIRA_TUI_CONFIG_DIR: CONFIG_DIR, LC_ALL: "fr_FR.UTF-8" },
});

const pause = () => new Promise((r) => setTimeout(r, 300));

// Saisit puis valide dans un second temps, en attendant le champ suivant.
const enter = async (terminal: Terminal, value: string, next: string) => {
	terminal.write(value);
	await pause();
	terminal.submit("");
	await expect(terminal.getByText(next)).toBeVisible({ timeout: 30_000 });
};

if (E2E_JIRA_TOKEN) {
	test("on la définit depuis la palette", async ({ terminal }) => {
		await expect(terminal.getByText("Adresse Jira")).toBeVisible({
			timeout: 30_000,
		});
		await enter(terminal, E2E_JIRA_SITE as string, "E-mail :");
		await enter(terminal, E2E_JIRA_EMAIL as string, "API token :");
		await enter(terminal, E2E_JIRA_TOKEN as string, "Filtre :");
		await expect(terminal.getByText("Filtre :")).toBeVisible({
			timeout: 30_000,
		});
		terminal.submit("");
		await expect(terminal.getByText("Ctrl+K ou :")).toBeVisible({
			timeout: 30_000,
		});

		terminal.write(":");
		await expect(terminal.getByText("› ")).toBeVisible({ timeout: 30_000 });
		terminal.write("Mes tickets");
		await pause();
		terminal.submit("");
		await expect(terminal.getByText("assigné : Moi")).toBeVisible({
			timeout: 30_000,
		});

		terminal.write(":");
		await expect(terminal.getByText("› ")).toBeVisible({ timeout: 30_000 });
		terminal.write("par défaut");
		await expect(terminal.getByText("Définir comme recherche")).toBeVisible({
			timeout: 30_000,
		});
		await pause();
		terminal.submit("");
		await expect(terminal.getByText("Filtres en cours")).toBeVisible({
			timeout: 30_000,
		});
		await pause();
		terminal.submit("");
		await expect(terminal.getByText("(à nommer)")).toBeVisible({
			timeout: 30_000,
		});
		terminal.write("Mes tickets e2e");
		await expect(terminal.getByText("Enregistrer sous")).toBeVisible({
			timeout: 30_000,
		});
		await pause();
		terminal.submit("");
		await expect(terminal.getByText("recherche par défaut")).toBeVisible({
			timeout: 30_000,
		});
	});

	test("au relancement, les résultats s'affichent tout de suite", async ({
		terminal,
	}) => {
		await expect(terminal.getByText("assigné : Moi")).toBeVisible({
			timeout: 30_000,
		});
		await expect(terminal.getByText("Ctrl+K ou :")).not.toBeVisible({
			timeout: 30_000,
		});
	});
}
