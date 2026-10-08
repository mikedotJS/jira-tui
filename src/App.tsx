import { Spinner } from "@inkjs/ui";
import clipboard from "clipboardy";
import { Box, Text, useApp, useInput } from "ink";
import open from "open";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient, createSuggester } from "./ai.js";
import {
	type Config,
	clearAccount,
	defaultFilters,
	defaultSearchName,
	loadAiKey,
	loadConfig,
	loadToken,
	saveAiKey,
	saveConfig,
	saveToken,
} from "./config.js";
import { t } from "./i18n.js";
import {
	assignIssue,
	downloadAttachment,
	findAssignable,
	loadTransitions,
	moveIssue,
	myAccountId,
	type Transition,
} from "./issues.js";
import {
	type Card,
	type Column,
	connect,
	explainError,
	findIssues,
	type Detail as IssueDetail,
	type Jira,
	listBoards,
	listProjects,
	loadBoard,
	loadIssue,
	moveCard,
	normalizeSiteUrl,
	verifyAccount,
} from "./jira.js";
import { type Command, pushRecent, rankCommands } from "./palette.js";
import { Board } from "./screens/Board.js";
import { Detail, DetailPending } from "./screens/Detail.js";
import { Help } from "./screens/Help.js";
import { type Credentials, Login } from "./screens/Login.js";
import { useScreenRows } from "./screens/Modal.js";
import { Palette } from "./screens/Palette.js";
import { type Project, Projects } from "./screens/Projects.js";
import { Results } from "./screens/Results.js";
import {
	ACTIVE_SPRINT,
	buildJql,
	emptyFilters,
	type FilterName,
	type Filters,
	hasFilters,
	hasSprints,
	loadChoices,
	ME,
	searchIssues,
} from "./search.js";
import { ThemeContext } from "./theme.js";

const REFRESH_MS = 30_000;

type Screen =
	| { name: "loading"; label: string }
	| { name: "login"; error?: string }
	| { name: "projects"; projects: Project[] }
	| { name: "boards"; project: Project; boards: Project[] }
	| { name: "board" }
	| { name: "detail"; key: string; back: "board" | "search" }
	| { name: "search" };

const FILTER_NAMES: FilterName[] = [
	"status",
	"assignee",
	"type",
	"priority",
	"labels",
	"sprint",
];

const summarize = (f: Filters) =>
	[
		f.jql && t("summary.jql", { jql: f.jql }),
		f.text && t("summary.text", { text: f.text }),
		...FILTER_NAMES.filter((n) => f[n].length).map((n) =>
			t("summary.filter", {
				name: t(`filters.${n}`),
				values: f[n].map((v) => f.names[v] ?? v).join(t("summary.or")),
			}),
		),
	]
		.filter(Boolean)
		.join(" · ");

export function App() {
	const { exit } = useApp();
	const rows = useScreenRows();
	const [screen, setScreen] = useState<Screen>({
		name: "loading",
		label: t("loading.starting"),
	});
	const [config, setConfig] = useState<Config>();
	const [jira, setJira] = useState<Jira>();
	const [columns, setColumns] = useState<Column[]>([]);
	const [updatedAt, setUpdatedAt] = useState<Date>();
	const [error, setError] = useState<string>();
	const [paletteOpen, setPaletteOpen] = useState(false);
	const [selected, setSelected] = useState<Card>();
	const [helpOpen, setHelpOpen] = useState(false);
	const [notice, setNotice] = useState<string>();
	const [detail, setDetail] = useState<IssueDetail>();
	const [results, setResults] = useState<Card[]>([]);
	const [filters, setFilters] = useState<Filters>(emptyFilters());
	const filtersRef = useRef(filters);
	const [sprints, setSprints] = useState(false);
	const [favorites, setFavorites] = useState<Config["favorites"]>([]);
	const [aiKey, setAiKey] = useState(loadAiKey);
	const aiReady = !!aiKey && config?.ai !== false;
	const suggester = useMemo(
		() => aiKey && createSuggester(createClient(aiKey)),
		[aiKey],
	);

	const fail = useCallback(
		(e: unknown) => setScreen({ name: "login", error: explainError(e) }),
		[],
	);

	const showProjects = useCallback(async (j: Jira) => {
		setScreen({ name: "loading", label: t("loading.projects") });
		setScreen({ name: "projects", projects: await listProjects(j) });
	}, []);

	const start = useCallback(
		async (c: Config, j: Jira) => {
			setConfig(c);
			setJira(j);
			if (c.board) {
				filtersRef.current = defaultFilters(c);
				setFilters(filtersRef.current);
				setScreen({ name: "search" });
			} else await showProjects(j);
		},
		[showProjects],
	);

	useEffect(() => {
		(async () => {
			const saved = await loadConfig();
			const token = saved && loadToken(saved.email);
			if (!saved || !token) return setScreen({ name: "login" });
			await start(saved, connect({ ...saved, token }));
		})().catch(fail);
	}, [start, fail]);

	const login = async (cred: Credentials) => {
		setScreen({ name: "loading", label: t("loading.credentials") });
		try {
			const siteUrl = normalizeSiteUrl(cred.siteUrl);
			const j = connect({ siteUrl, email: cred.email, token: cred.token });
			await verifyAccount(j);
			saveToken(cred.email, cred.token);
			const c = { siteUrl, email: cred.email };
			await saveConfig(c);
			await start(c, j);
		} catch (e) {
			fail(e);
		}
	};

	const openBoard = async (
		project: Project,
		board: { id: number; name: string },
	) => {
		if (!config) return;
		const next = { ...config, project, board };
		await saveConfig(next);
		setConfig(next);
		setError(undefined);
		changeFilters(defaultFilters(next));
	};

	const pickProject = async (project: Project) => {
		if (!jira) return;
		setScreen({ name: "loading", label: t("loading.board") });
		try {
			const boards = await listBoards(jira, project.key);
			if (boards.length === 1) return await openBoard(project, boards[0]);
			if (boards.length === 0)
				setError(t("status.noBoard", { key: project.key }));
			else
				return setScreen({
					name: "boards",
					project,
					boards: boards.map((b) => ({ key: String(b.id), name: b.name })),
				});
		} catch (e) {
			setError(explainError(e));
		}
		await showProjects(jira);
	};

	const refresh = useCallback(async () => {
		if (!jira || !config?.board) return;
		try {
			const loaded = await loadBoard(jira, config.board.id);
			setColumns(loaded);
			setUpdatedAt(new Date());
			setError(undefined);
		} catch (e) {
			setError(explainError(e));
		}
	}, [jira, config?.board]);

	const theme = config?.theme ?? "dark";
	const overlay = paletteOpen || helpOpen;

	const onBoard = screen.name === "board";
	const onDetail = screen.name === "detail";
	const onSearch = screen.name === "search";
	const detailKey = screen.name === "detail" ? screen.key : undefined;
	const projectKey = config?.project?.key ?? "";

	useEffect(() => {
		if (!onBoard) return;
		refresh();
		const timer = setInterval(refresh, REFRESH_MS);
		return () => clearInterval(timer);
	}, [onBoard, refresh]);

	useEffect(() => {
		if (!jira || !config?.board) return;
		setFavorites(config.favorites ?? []);
		hasSprints(jira, config.board.id).then(setSprints);
	}, [jira, config?.board, config?.favorites]);

	const reloadDetail = useCallback(async () => {
		if (!jira || !detailKey) return;
		try {
			setDetail(await loadIssue(jira, detailKey, config?.siteUrl));
			setError(undefined);
		} catch (e) {
			setError(explainError(e));
		}
	}, [jira, detailKey, config?.siteUrl]);

	useEffect(() => {
		if (!detailKey) return;
		setDetail(undefined);
		setError(undefined);
		reloadDetail();
		const timer = setInterval(reloadDetail, REFRESH_MS);
		return () => clearInterval(timer);
	}, [detailKey, reloadDetail]);

	const runSearch = useCallback(async () => {
		if (!jira) return;
		if (!hasFilters(filtersRef.current)) return setResults([]);
		try {
			setResults(
				await searchIssues(jira, buildJql(projectKey, filtersRef.current)),
			);
			setError(undefined);
		} catch (e) {
			setError(explainError(e));
		}
	}, [jira, projectKey]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: filters relance la recherche à chaque changement de filtre
	useEffect(() => {
		if (!onSearch) return;
		runSearch();
		const timer = setInterval(runSearch, REFRESH_MS);
		return () => clearInterval(timer);
	}, [onSearch, runSearch, filters]);

	const changeFilters = (next: Filters) => {
		filtersRef.current = next;
		setFilters(next);
		setScreen({ name: "search" });
	};

	const toggleValue = (name: FilterName, value: string, label: string) => {
		const f = filtersRef.current;
		const values = f[name].includes(value)
			? f[name].filter((v) => v !== value)
			: [...f[name], value];
		changeFilters({
			...f,
			[name]: values,
			names: { ...f.names, [value]: label },
		});
	};

	const notify = (message: string) => {
		setNotice(message);
		setTimeout(() => setNotice(undefined), 3000);
	};

	// Toute action qui échoue affiche l'erreur Jira lisible sans quitter l'écran.
	const attempt = async (action: () => Promise<unknown>, done?: string) => {
		try {
			await action();
			if (done) notify(done);
		} catch (e) {
			setError(explainError(e));
		}
	};

	const openIssue = (key: string) =>
		setScreen({
			name: "detail",
			key,
			back: screen.name === "search" ? "search" : "board",
		});

	const afterChange = async () => {
		await Promise.all([
			onBoard || (screen.name === "detail" && screen.back === "board")
				? refresh()
				: 0,
			reloadDetail(),
			onSearch ? runSearch() : 0,
		]);
	};

	const move = async (
		key: string,
		tr: Transition,
		fields: Record<string, { id: string }>,
	) => {
		if (!jira) return;
		const before = columns;
		setColumns(moveCard(columns, key, tr.toId));
		try {
			await moveIssue(jira, key, tr.id, fields);
			notify(t("status.moved", { key, status: tr.toName }));
			await afterChange();
		} catch (e) {
			setColumns(before);
			setError(explainError(e));
		}
	};

	// Une transition peut exiger des champs : ceux à choix sont demandés un par un,
	// les autres renvoient vers le navigateur.
	const transitionStep = (
		key: string,
		tr: Transition,
		i = 0,
		fields: Record<string, { id: string }> = {},
	): Command => {
		const base = { id: `move-${tr.id}-${i}`, label: tr.toName };
		const field = tr.required[i];
		if (!field) return { ...base, run: () => move(key, tr, fields) };
		if (!field.choices?.length)
			return {
				...base,
				run: () =>
					setError(
						t("status.needsField", { name: tr.name, field: field.name }),
					),
			};
		const choices = field.choices;
		return {
			...base,
			pick: (q) =>
				rankCommands(
					choices.map((c) => ({
						...transitionStep(key, tr, i + 1, {
							...fields,
							[field.key]: { id: c.id },
						}),
						id: `${field.key}-${c.id}`,
						label: `${field.name} : ${c.name}`,
					})),
					q,
					[],
				),
		};
	};

	const moveCommand = (key: string): Command => {
		let cache: Promise<Transition[]> | undefined;
		return {
			id: "move",
			label: t("commands.move", { key }),
			pick: async (q) => {
				if (!jira) return [];
				cache ??= loadTransitions(jira, key);
				const transitions = await cache;
				return rankCommands(
					transitions.map((tr) => transitionStep(key, tr)),
					q,
					[],
				);
			},
		};
	};

	const filterCommand = (name: FilterName): Command => ({
		id: `filter-${name}`,
		label: t("commands.filterBy", { name: t(`filters.${name}`) }),
		pick: async (q) => {
			if (!jira) return [];
			const choices = await loadChoices(
				jira,
				name,
				{ projectKey, boardId: config?.board?.id },
				q,
			);
			const shown = name === "assignee" ? choices : rankChoices(choices, q);
			return shown.map((c) => ({
				id: `${name}-${c.value}`,
				label: `${filtersRef.current[name].includes(c.value) ? "[x]" : "[ ]"} ${c.label}`,
				keep: true,
				run: () => toggleValue(name, c.value, c.label),
			}));
		},
	});

	const saveFavorites = (next: NonNullable<Config["favorites"]>) => {
		setFavorites(next);
		if (!config) return;
		const updated = { ...config, favorites: next };
		setConfig(updated);
		saveConfig(updated).catch(() => {});
	};

	const updateConfig = (patch: Partial<Config>) => {
		if (!config) return;
		const next = { ...config, ...patch };
		setConfig(next);
		saveConfig(next).catch(() => {});
	};

	const defaultName = defaultSearchName(config);

	const setDefaultSearch = (name: string | undefined, favs = favorites) => {
		const { [projectKey]: _, ...others } = config?.defaultSearches ?? {};
		updateConfig({
			favorites: favs,
			defaultSearches: name ? { ...others, [projectKey]: name } : others,
		});
		notify(
			name ? t("status.defaultSet", { name }) : t("status.defaultCleared"),
		);
	};

	const defaultSearchCommand = (): Command => ({
		id: "default-search-set",
		label: t("commands.defaultSearch"),
		pick: (q) => {
			const current = filtersRef.current;
			const saved = (favorites ?? []).find(
				(f) => JSON.stringify(f.filters) === JSON.stringify(current),
			);
			const now: Command[] = !hasFilters(current)
				? []
				: saved
					? []
					: [
							{
								id: "default-search-current",
								label: t("commands.currentFilters"),
								pick: (name) =>
									name.trim()
										? [
												{
													id: "default-search-current-go",
													label: t("commands.saveAndSetDefault", {
														name: name.trim(),
													}),
													run: () =>
														setDefaultSearch(name.trim(), [
															...(favorites ?? []).filter(
																(f) => f.name !== name.trim(),
															),
															{ name: name.trim(), filters: current },
														]),
												},
											]
										: [],
							},
						];
			return [
				...now,
				...rankCommands(
					(favorites ?? []).map((f) => ({
						id: `default-search-${f.name}`,
						label:
							saved === f
								? t("commands.currentFiltersSaved", { name: f.name })
								: f.name,
						run: () => setDefaultSearch(f.name),
					})),
					q,
					[],
				),
			];
		},
	});

	const aiCommand = (): Command => {
		const toggle = (ai: boolean) => {
			updateConfig({ ai });
			notify(t(ai ? "status.aiEnabled" : "status.aiDisabled"));
		};
		if (aiReady)
			return {
				id: "ai-toggle",
				label: t("commands.aiOff"),
				run: () => toggle(false),
			};
		if (aiKey)
			return {
				id: "ai-toggle",
				label: t("commands.aiOn"),
				run: () => toggle(true),
			};
		return {
			id: "ai-toggle",
			label: t("commands.aiAskKey"),
			pick: (q) =>
				q.trim()
					? [
							{
								id: "ai-key-save",
								label: t("commands.aiSaveKey"),
								run: () => {
									saveAiKey(q.trim());
									setAiKey(q.trim());
									toggle(true);
								},
							},
						]
					: [],
		};
	};

	// Haiku propose 1 à 3 commandes (et au besoin une recherche) pour la phrase tapée.
	const suggest = async (phrase: string, signal: AbortSignal) => {
		if (!suggester || !jira) return [];
		const { ids, search, activeSprint, assignToMe } = await suggester(
			phrase,
			commands,
			signal,
		);
		// Une recherche décrite par l'IA (mots, sprint actif), avec en option « m'assigner tout ».
		const found: Command[] = [];
		if (search || activeSprint) {
			const f: Filters = {
				...emptyFilters(),
				text: search,
				sprint: activeSprint ? [ACTIVE_SPRINT] : [],
				names: { [ACTIVE_SPRINT]: t("choices.activeSprint") },
			};
			const summary = summarize(f);
			found.push(
				assignToMe
					? {
							id: "ai:assign-all",
							label: t("commands.aiAssignAll", { summary }),
							run: () => {
								changeFilters(f);
								attempt(async () => {
									const cards = await searchIssues(
										jira,
										buildJql(projectKey, f),
									);
									const me = await myAccountId(jira);
									await Promise.all(
										cards.map((c) => assignIssue(jira, c.key, me)),
									);
									notify(t("status.assignedMany", { count: cards.length }));
									await runSearch();
								});
							},
						}
					: {
							id: "ai:search",
							label: t("commands.aiSearch", { summary }),
							run: () => changeFilters(f),
						},
			);
		}
		const single = assignToMe ? new Set(["assign-me", "unassign"]) : new Set();
		for (const c of commands)
			if (ids.includes(c.id) && !single.has(c.id))
				found.push({ ...c, id: `ai:${c.id}` });
		return found;
	};

	const logout = async () => {
		if (!config) return;
		await clearAccount(config.email);
		setJira(undefined);
		setConfig(undefined);
		setColumns([]);
		setScreen({ name: "login" });
	};

	const paletteAvailable = onBoard || onDetail || onSearch;
	useInput(
		(input, key) => {
			if ((key.ctrl && input === "k") || input === ":") setPaletteOpen(true);
			else if (input === "q") exit();
			else if (input === "/") changeFilters(filtersRef.current);
		},
		{ isActive: paletteAvailable && !overlay },
	);

	const key = detailKey ?? selected?.key;
	const site = config?.siteUrl;

	const ticketCommands: Command[] = !key
		? []
		: [
				...(onDetail
					? []
					: [
							{
								id: "open-issue",
								label: t("commands.open", { key }),
								run: () => openIssue(key),
							},
						]),
				moveCommand(key),
				{
					id: "assign-me",
					label: t("commands.assignMe", { key }),
					run: () =>
						jira &&
						attempt(
							async () => {
								await assignIssue(jira, key, await myAccountId(jira));
								await afterChange();
							},
							t("status.assignedToYou", { key }),
						),
				},
				{
					id: "open-browser",
					label: t("commands.openInBrowser", { key }),
					run: () =>
						attempt(
							() => open(`${site}/browse/${key}`),
							t("status.openedInBrowser", { key }),
						),
				},
				...(onDetail && detail?.attachments.length
					? [
							{
								id: "attachment-open",
								label: t("commands.openAttachment"),
								pick: (q: string) =>
									rankCommands(
										detail.attachments.map((a) => ({
											id: `attachment-open-${a.id}`,
											label: a.filename,
											run: () => attempt(() => open(a.url)),
										})),
										q,
										[],
									),
							},
							{
								id: "attachment-download",
								label: t("commands.downloadAttachment"),
								pick: (q: string) =>
									rankCommands(
										detail.attachments.map((a) => ({
											id: `attachment-download-${a.id}`,
											label: a.filename,
											run: () =>
												attempt(
													async () => {
														const token = config && loadToken(config.email);
														if (!site || !config || !token) return;
														await downloadAttachment(
															{ siteUrl: site, email: config.email, token },
															a,
														);
													},
													t("status.downloaded", { file: a.filename }),
												),
										})),
										q,
										[],
									),
							},
						]
					: []),
				{
					id: "copy-key",
					label: t("commands.copyKey", { key }),
					run: () =>
						attempt(() => clipboard.write(key), t("status.keyCopied", { key })),
				},
				{
					id: "unassign",
					label: t("commands.unassign", { key }),
					run: () =>
						jira &&
						attempt(
							async () => {
								await assignIssue(jira, key, null);
								await afterChange();
							},
							t("status.unassigned", { key }),
						),
				},
				{
					id: "assign-to",
					label: t("commands.assignTo", { key }),
					pick: async (q) => {
						if (!jira) return [];
						const users = await findAssignable(jira, key, q);
						return users.map((u) => ({
							id: `assign-${u.id}`,
							label: u.name,
							run: () =>
								attempt(
									async () => {
										await assignIssue(jira, key, u.id);
										await afterChange();
									},
									t("status.assignedTo", { key, name: u.name }),
								),
						}));
					},
				},
				{
					id: "copy-link",
					label: t("commands.copyLink", { key }),
					run: () =>
						attempt(
							() => clipboard.write(`${site}/browse/${key}`),
							t("status.linkCopied", { key }),
						),
				},
			];

	const searchCommands: Command[] = [
		{
			id: "search-text",
			label: t("commands.searchText"),
			pick: (q) =>
				q.trim()
					? [
							{
								id: "search-text-go",
								label: t("commands.searchTextGo", { text: q.trim() }),
								run: () =>
									changeFilters({
										...filtersRef.current,
										jql: undefined,
										text: q.trim(),
									}),
							},
						]
					: [],
		},
		{
			id: "search-jql",
			label: t("commands.jql"),
			pick: (q) =>
				q.trim()
					? [
							{
								id: "search-jql-go",
								label: t("commands.jqlGo", { jql: q.trim() }),
								run: () => changeFilters({ ...emptyFilters(), jql: q.trim() }),
							},
						]
					: [],
		},
		...(
			["status", "assignee", "type", "priority", "labels"] as FilterName[]
		).map(filterCommand),
		...(sprints ? [filterCommand("sprint")] : []),
		{
			id: "my-tickets",
			label: t("commands.myIssues"),
			run: () =>
				changeFilters({
					...emptyFilters(),
					assignee: [ME],
					names: { [ME]: t("choices.me") },
				}),
		},
		{
			id: "reset-filters",
			label: t("commands.resetFilters"),
			run: () => changeFilters(emptyFilters()),
		},
		...(hasFilters(filters)
			? [
					{
						id: "favorite-save",
						label: t("commands.favoriteSave"),
						pick: (q: string) =>
							q.trim()
								? [
										{
											id: "favorite-save-go",
											label: t("commands.favoriteSaveGo", { name: q.trim() }),
											run: () =>
												saveFavorites([
													...(favorites ?? []).filter(
														(f) => f.name !== q.trim(),
													),
													{ name: q.trim(), filters: filtersRef.current },
												]),
										},
									]
								: [],
					},
				]
			: []),
		...(favorites?.length || hasFilters(filters)
			? [defaultSearchCommand()]
			: []),
		...(defaultName
			? [
					{
						id: "default-search-clear",
						label: t("commands.defaultSearchClear"),
						run: () => setDefaultSearch(undefined),
					},
				]
			: []),
		...(favorites?.length
			? [
					{
						id: "favorite-open",
						label: t("commands.favoriteOpen"),
						pick: (q: string) =>
							rankCommands(
								(favorites ?? []).map((f) => ({
									id: `favorite-${f.name}`,
									label: f.name,
									run: () => changeFilters(f.filters),
								})),
								q,
								[],
							),
					},
				]
			: []),
	];

	const commands: Command[] = [
		...ticketCommands,
		{
			id: "goto",
			label: t("commands.goto"),
			pick: async (q) => {
				if (!jira) return [];
				const found = await findIssues(jira, q, projectKey);
				return found.map((i) => ({
					id: `goto-${i.key}`,
					label: `${i.key} ${i.summary}`,
					run: () => openIssue(i.key),
				}));
			},
		},
		{
			id: "board",
			label: t("commands.board"),
			run: () => setScreen({ name: "board" }),
		},
		{
			id: "search",
			label: t("commands.search"),
			run: () => changeFilters(filtersRef.current),
		},
		...searchCommands,
		{
			id: "projects",
			label: t("commands.projects"),
			run: () => jira && showProjects(jira).catch(fail),
		},
		{ id: "help", label: t("commands.help"), run: () => setHelpOpen(true) },
		{
			id: "theme",
			label:
				theme === "dark" ? t("commands.themeLight") : t("commands.themeDark"),
			run: () => {
				if (!config) return;
				const next = {
					...config,
					theme: theme === "dark" ? "light" : "dark",
				} as Config;
				setConfig(next);
				saveConfig(next).catch(() => {});
			},
		},
		aiCommand(),
		{ id: "logout", label: t("commands.logout"), run: logout },
		{ id: "quit", label: t("commands.quit"), run: exit },
	];

	const runCommand = (command: Command) => {
		setPaletteOpen(false);
		if (config && commands.some((c) => c.id === command.id)) {
			const next = {
				...config,
				recents: pushRecent(config.recents ?? [], command.id),
			};
			setConfig(next);
			saveConfig(next).catch(() => {});
		}
		command.run?.();
	};

	const palette = helpOpen ? (
		<Help onClose={() => setHelpOpen(false)} />
	) : (
		paletteOpen && (
			<Palette
				commands={commands}
				recents={config?.recents ?? []}
				suggest={aiReady ? suggest : undefined}
				onRun={runCommand}
				onClose={() => setPaletteOpen(false)}
			/>
		)
	);
	const status = (
		<>
			{error && <Text color="red"> {error}</Text>}
			{notice && <Text color="green"> {notice}</Text>}
		</>
	);

	const renderScreen = () => {
		const leaveDetail = () =>
			setScreen(
				screen.name === "detail" && screen.back === "search"
					? { name: "search" }
					: { name: "board" },
			);
		switch (screen.name) {
			case "loading":
				return <Spinner label={screen.label} />;
			case "login":
				return <Login error={screen.error} onSubmit={login} />;
			case "projects":
				return (
					<>
						{error && <Text color="red"> {error}</Text>}
						<Projects projects={screen.projects} onSelect={pickProject} />
					</>
				);
			case "boards":
				return (
					<Projects
						title={t("projects.chooseBoard", { project: screen.project.name })}
						projects={screen.boards}
						onSelect={(b) =>
							openBoard(screen.project, { id: Number(b.key), name: b.name })
						}
					/>
				);
			case "board":
				return (
					<>
						{status}
						<Board
							columns={columns}
							title={`${config?.project?.name} · ${config?.board?.name}`}
							updatedAt={updatedAt}
							onRefresh={refresh}
							onSelect={setSelected}
							active={!overlay}
						/>
						{palette}
					</>
				);
			case "search":
				return (
					<>
						{status}
						<Results
							cards={results}
							summary={summarize(filters)}
							active={!overlay}
							onSelect={setSelected}
							onOpen={(c) => openIssue(c.key)}
							onBack={() => changeFilters(emptyFilters())}
						/>
						{palette}
					</>
				);
			case "detail":
				return (
					<>
						{status}
						{detail ? (
							<Detail issue={detail} active={!overlay} onBack={leaveDetail} />
						) : (
							<DetailPending
								label={t("loading.issue", { key: screen.key })}
								error={error}
								onBack={leaveDetail}
							/>
						)}
						{palette}
					</>
				);
		}
	};

	return (
		<ThemeContext.Provider value={theme}>
			<Box flexDirection="column" height={rows}>
				{renderScreen()}
			</Box>
		</ThemeContext.Provider>
	);
}

const rankChoices = (
	choices: { value: string; label: string }[],
	query: string,
) =>
	query.trim()
		? rankCommands(
				choices.map((c) => ({ id: c.value, label: c.label })),
				query,
				[],
			).map((c) => choices.find((x) => x.value === c.id) as (typeof choices)[0])
		: choices;
