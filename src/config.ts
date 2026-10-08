import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { Entry } from "@napi-rs/keyring";
import { emptyFilters, type Filters } from "./search.js";

export type Config = {
	siteUrl: string;
	email: string;
	project?: { key: string; name: string };
	board?: { id: number; name: string };
	recents?: string[];
	theme?: "dark" | "light";
	favorites?: { name: string; filters: Filters }[];
	// Nom du favori lancé à l'accueil, par clé de projet.
	defaultSearches?: Record<string, string>;
	// Suggestions IA : actives par défaut dès qu'une clé est disponible.
	ai?: boolean;
};

export const defaultSearchName = (c?: Config) =>
	c?.project && c.defaultSearches?.[c.project.key];

export const defaultFilters = (c: Config): Filters =>
	c.favorites?.find((f) => f.name === defaultSearchName(c))?.filters ??
	emptyFilters();

const SERVICE = "jira-tui";

const configFile = () =>
	join(
		process.env.JIRA_TUI_CONFIG_DIR ?? join(homedir(), ".config", "jira-tui"),
		"config.json",
	);

export async function loadConfig(): Promise<Config | undefined> {
	try {
		return JSON.parse(await readFile(configFile(), "utf8")) as Config;
	} catch {
		return undefined;
	}
}

export async function saveConfig(config: Config) {
	await mkdir(join(configFile(), ".."), { recursive: true });
	await writeFile(configFile(), `${JSON.stringify(config, null, 2)}\n`);
}

export const loadToken = (email: string) =>
	new Entry(SERVICE, email).getPassword() ?? undefined;

export const saveToken = (email: string, token: string) =>
	new Entry(SERVICE, email).setPassword(token);

const aiEntry = () => new Entry(SERVICE, "anthropic-api-key");

export const loadAiKey = () => {
	try {
		return (
			process.env.ANTHROPIC_API_KEY || aiEntry().getPassword() || undefined
		);
	} catch {
		return undefined;
	}
};

export const saveAiKey = (key: string) => aiEntry().setPassword(key);

export async function clearAccount(email: string) {
	new Entry(SERVICE, email).deletePassword();
	await rm(configFile(), { force: true });
}
