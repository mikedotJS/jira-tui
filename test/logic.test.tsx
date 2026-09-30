import { render } from "ink-testing-library";
import { expect, test, vi } from "vitest";
import { adfToText } from "../src/adf.js";
import { loadTransitions, moveIssue } from "../src/issues.js";
import { type Column, findIssues, loadIssue, moveCard } from "../src/jira.js";
import type { Command } from "../src/palette.js";
import { ago, Detail, DetailPending } from "../src/screens/Detail.js";
import { Palette } from "../src/screens/Palette.js";
import { ACTIVE_SPRINT, buildJql, emptyFilters, ME } from "../src/search.js";
import { Behind } from "./behind.js";

const tick = (ms = 250) => new Promise((r) => setTimeout(r, ms));

test("JQL : « ou » dans un filtre, « et » entre filtres", () => {
	const jql = buildJql("ABC", {
		...emptyFilters(),
		status: ["En cours", "À faire"],
		assignee: [ME, "acc-1"],
		sprint: [ACTIVE_SPRINT],
	});
	expect(jql).toBe(
		'project = "ABC" AND status in ("En cours", "À faire") AND assignee in (currentUser(), "acc-1") AND (sprint in openSprints()) ORDER BY updated DESC',
	);
});

test("JQL : la requête saisie prime sur les filtres", () => {
	expect(buildJql("ABC", { ...emptyFilters(), jql: "assignee is EMPTY" })).toBe(
		"assignee is EMPTY",
	);
});

test("le déplacement met le tableau à jour tout de suite", () => {
	const card = { key: "A-1", summary: "x", statusId: "1" };
	const columns: Column[] = [
		{ name: "À faire", statusIds: ["1"], cards: [card] },
		{ name: "Fini", statusIds: ["2"], cards: [] },
	];
	const moved = moveCard(columns, "A-1", "2");
	expect(moved[0].cards).toEqual([]);
	expect(moved[1].cards[0].statusId).toBe("2");
	expect(moveCard(columns, "A-1", "99")).toBe(columns);
});

test("l'ADF est rendu en texte lisible", () => {
	const text = adfToText({
		type: "doc",
		content: [
			{ type: "paragraph", content: [{ type: "text", text: "Bonjour" }] },
			{
				type: "bulletList",
				content: [
					{
						type: "listItem",
						content: [
							{ type: "paragraph", content: [{ type: "text", text: "un" }] },
						],
					},
				],
			},
		],
	});
	expect(text).toContain("Bonjour");
	expect(text).toContain("• un");
});

test("les transitions exposent les champs obligatoires", async () => {
	const jira = {
		cloud: {
			issues: {
				getTransitions: vi.fn().mockResolvedValue({
					transitions: [
						{
							id: "31",
							name: "Terminer",
							to: { id: "5", name: "Fini" },
							fields: {
								resolution: {
									required: true,
									name: "Résolution",
									allowedValues: [{ id: "1", name: "Fait" }],
								},
							},
						},
					],
				}),
				doTransition: vi.fn().mockResolvedValue(undefined),
			},
		},
	} as never;
	const [t] = await loadTransitions(jira, "A-1");
	expect(t.toName).toBe("Fini");
	expect(t.required[0].choices).toEqual([{ id: "1", name: "Fait" }]);
	await moveIssue(jira, "A-1", "31", { resolution: { id: "1" } });
	expect(
		(jira as never as { cloud: { issues: { doTransition: unknown } } }).cloud
			.issues.doTransition,
	).toHaveBeenCalledWith({
		issueIdOrKey: "A-1",
		transition: { id: "31" },
		fields: { resolution: { id: "1" } },
	});
});

test("le détail d'un ticket est lu depuis Jira", async () => {
	const jira = {
		agile: {
			issue: {
				getIssue: vi
					.fn()
					.mockResolvedValue({ fields: { sprint: { name: "S1" } } }),
			},
		},
		cloud: {
			issues: {
				getIssue: vi.fn().mockResolvedValue({
					key: "A-1",
					names: {
						customfield_1: "Équipe",
						customfield_2: "Vide",
						customfield_3: "Note",
					},
					fields: {
						customfield_1: { value: "Réservation" },
						customfield_2: null,
						customfield_3: "**gras**",
						summary: "Titre",
						status: { name: "En cours" },
						labels: ["bug"],
						description: {
							type: "doc",
							content: [
								{
									type: "paragraph",
									content: [{ type: "text", text: "Desc" }],
								},
							],
						},
						comment: {
							comments: [
								{
									author: { displayName: "Zoé" },
									created: "2026-01-01",
									body: "Salut",
								},
							],
						},
						issuelinks: [
							{
								type: { outward: "bloque" },
								outwardIssue: { key: "A-2", fields: { summary: "Autre" } },
							},
						],
					},
				}),
			},
		},
	} as never;
	const d = await loadIssue(jira, "A-1");
	expect(d).toMatchObject({
		status: "En cours",
		description: "Desc",
		labels: ["bug"],
		sprint: "S1",
		customFields: [
			{ name: "Équipe", value: "Réservation" },
			{ name: "Note", value: expect.not.stringContaining("**") },
		],
		links: [{ label: "bloque", key: "A-2", summary: "Autre" }],
	});
	const frame = render(<Detail issue={d} onBack={() => {}} />).lastFrame();
	expect(frame).toContain("A-1 Titre");
	expect(frame).toContain("Zoé");
});

test("« Aller à un ticket » cherche par clé ou par titre", async () => {
	const search = vi.fn().mockResolvedValue({
		issues: [{ key: "A-7", fields: { summary: "Bug login" } }],
	});
	const jira = {
		cloud: { issueSearch: { searchAndReconsileIssuesUsingJql: search } },
	} as never;
	expect(await findIssues(jira, "AB-7", "AB")).toEqual([
		{ key: "A-7", summary: "Bug login" },
	]);
	expect(search.mock.calls[0][0].jql).toContain('key = "AB-7"');
	expect(await findIssues(jira, "  ", "A")).toEqual([]);
});

test("la palette ouvre un second niveau et le filtre par la saisie", async () => {
	const onRun = vi.fn();
	const leaf: Command = { id: "leaf", label: "Choix", run: () => {} };
	const commands: Command[] = [
		{ id: "sub", label: "Sous-menu", pick: () => [leaf] },
	];
	const { stdin, lastFrame } = render(
		<Behind>
			<Palette
				commands={commands}
				recents={[]}
				onRun={onRun}
				onClose={() => {}}
			/>
		</Behind>,
	);
	stdin.write("\r");
	await tick();
	expect(lastFrame()).toContain("Choix");
	stdin.write("\r");
	await tick();
	expect(onRun).toHaveBeenCalledWith(leaf);
});

test("la page Ticket affiche dates relatives, position et sauts début/fin", async () => {
	expect(
		ago("2026-01-01T10:00:00Z", Date.parse("2026-01-01T12:00:00Z")),
	).toMatch(/^il y a 2\sh$/);
	const d = {
		key: "A-1",
		summary: "Titre",
		status: "En cours",
		labels: [],
		description: Array.from({ length: 200 }, (_, i) => `ligne ${i}`).join("\n"),
		attachments: [],
		customFields: [],
		comments: [],
		links: [],
	};
	const { stdin, lastFrame } = render(<Detail issue={d} onBack={() => {}} />);
	expect(lastFrame()).toContain("0 %");
	stdin.write("G");
	await vi.waitFor(() => expect(lastFrame()).toContain("100 %"));
	stdin.write("g");
	await vi.waitFor(() => expect(lastFrame()).toContain(" 0 %"));
});

test("un ticket introuvable laisse revenir avec Échap", async () => {
	const onBack = vi.fn();
	const { stdin, lastFrame } = render(
		<DetailPending label="Chargement…" error="404" onBack={onBack} />,
	);
	expect(lastFrame()).toContain("Ticket inaccessible");
	stdin.write("\u001B");
	await vi.waitFor(() => expect(onBack).toHaveBeenCalled());
});

test("un texte en Markdown est mis en forme au lieu d'être affiché brut", () => {
	const out = adfToText("# Titre\n\n- un\n- deux\n\n**gras** et `code`");
	expect(out).not.toContain("**");
	expect(out).not.toContain("`");
	expect(out).toContain("Titre");
	expect(out).toContain("deux");
});

test("une image du texte et la liste des pièces jointes deviennent des liens", () => {
	const files = [{ id: "9", filename: "a.png", url: "https://x/a.png" }];
	const out = adfToText(
		{
			type: "doc",
			content: [
				{
					type: "mediaSingle",
					content: [{ type: "media", attrs: { alt: "a.png" } }],
				},
			],
		},
		files,
	);
	expect(out).toContain("a.png");
	expect(out).not.toContain("[pièce jointe]");
});
