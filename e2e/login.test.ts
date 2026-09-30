import { expect, test } from "@microsoft/tui-test";

test.use({
	program: { file: "node", args: ["dist/cli.js"] },
	env: {
		JIRA_TUI_CONFIG_DIR: "/tmp/jira-tui-e2e-config",
		LC_ALL: "fr_FR.UTF-8",
	},
});

test("sans compte, l'appli demande l'adresse Jira", async ({ terminal }) => {
	await expect(terminal.getByText("Adresse Jira")).toBeVisible();
});
