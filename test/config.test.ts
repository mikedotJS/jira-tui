import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import {
	type Config,
	defaultFilters,
	defaultSearchName,
	loadConfig,
	saveConfig,
} from "../src/config.js";
import { emptyFilters } from "../src/search.js";

test("enregistre et relit la config", async () => {
	process.env.JIRA_TUI_CONFIG_DIR = await mkdtemp(join(tmpdir(), "jira-tui-"));
	expect(await loadConfig()).toBeUndefined();
	const config = {
		siteUrl: "https://a.atlassian.net",
		email: "a@b.c",
		board: { id: 1, name: "B" },
	};
	await saveConfig(config);
	expect(await loadConfig()).toEqual(config);
});

const base = {
	siteUrl: "https://a.atlassian.net",
	email: "a@b.c",
	project: { key: "ABC", name: "Projet" },
	favorites: [
		{ name: "Mes bugs", filters: { ...emptyFilters(), type: ["Bug"] } },
	],
};

test("la recherche par défaut est relue après sauvegarde", async () => {
	process.env.JIRA_TUI_CONFIG_DIR = await mkdtemp(join(tmpdir(), "jira-tui-"));
	await saveConfig({ ...base, defaultSearches: { ABC: "Mes bugs" } });
	const loaded = await loadConfig();
	expect(defaultSearchName(loaded)).toBe("Mes bugs");
	expect(defaultFilters(loaded as Config).type).toEqual(["Bug"]);
});

test("sans recherche par défaut, ou si son favori a disparu, l'accueil reste vide", () => {
	expect(defaultFilters(base)).toEqual(emptyFilters());
	expect(
		defaultFilters({ ...base, defaultSearches: { ABC: "Supprimé" } }),
	).toEqual(emptyFilters());
});

test("la recherche par défaut est propre à chaque projet", () => {
	const config = { ...base, defaultSearches: { XYZ: "Mes bugs" } };
	expect(defaultSearchName(config)).toBeUndefined();
	expect(defaultFilters(config)).toEqual(emptyFilters());
});
