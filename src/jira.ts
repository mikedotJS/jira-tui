import {
	createAgileClient,
	createCloudClient,
	isApiError,
	isAuthError,
	isNetworkError,
	isRateLimitError,
} from "jira.js";
import { createClient } from "jira.js/core";
import { type AdfNode, type Attachment, adfToText } from "./adf.js";
import { t } from "./i18n.js";

export type Account = { siteUrl: string; email: string; token: string };
export type Jira = ReturnType<typeof connect>;

export type Card = {
	key: string;
	summary: string;
	statusId: string;
	statusName?: string;
	assignee?: string;
	priority?: string;
};
export type Column = { name: string; statusIds: string[]; cards: Card[] };

export function connect({ siteUrl, email, token }: Account) {
	const client = createClient({
		host: siteUrl,
		auth: { type: "basic", email, apiToken: token },
	});
	return { cloud: createCloudClient(client), agile: createAgileClient(client) };
}

export const normalizeSiteUrl = (input: string) => {
	const trimmed = input.trim().replace(/\/+$/, "");
	return /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
};

export const verifyAccount = async (jira: Jira) =>
	(await jira.cloud.myself.getCurrentUser()).displayName ?? "";

export async function listProjects(jira: Jira) {
	const projects: { key: string; name: string }[] = [];
	let isLast = false;
	while (!isLast) {
		const page = await jira.cloud.projects.searchProjects({
			startAt: projects.length,
			maxResults: 100,
			orderBy: "name",
		});
		projects.push(
			...page.values.map((p) => ({
				key: p.key ?? "",
				name: p.name ?? p.key ?? "",
			})),
		);
		isLast = page.isLast ?? page.values.length === 0;
	}
	return projects;
}

export async function listBoards(jira: Jira, projectKey: string) {
	const { values } = await jira.agile.board.getAllBoards({
		projectKeyOrId: projectKey,
	});
	return values.map((b) => ({ id: b.id ?? 0, name: b.name ?? "" }));
}

export async function loadBoard(jira: Jira, boardId: number) {
	const { columnConfig } = await jira.agile.board.getConfiguration({ boardId });
	const cards: Card[] = [];
	let nextPageToken: string | undefined;
	do {
		const page = await jira.agile.board.getIssuesForBoard({
			boardId,
			nextPageToken,
			maxResults: 100,
			// jira.js type les fields en tableau d'objets, l'API attend des noms
			fields: ["summary", "status", "assignee", "priority"] as never,
		});
		for (const issue of page.issues) {
			const f = issue.fields as
				| {
						summary?: string;
						status?: { id?: string };
						assignee?: { displayName?: string };
						priority?: { name?: string };
				  }
				| undefined;
			cards.push({
				key: issue.key ?? "",
				summary: f?.summary ?? "",
				statusId: f?.status?.id ?? "",
				assignee: f?.assignee?.displayName,
				priority: f?.priority?.name,
			});
		}
		nextPageToken = page.isLast ? undefined : page.nextPageToken;
	} while (nextPageToken);
	return groupByColumn(columnConfig?.columns ?? [], cards);
}

export const groupByColumn = (
	columns: { name?: string; statuses?: { id?: string }[] }[],
	cards: Card[],
): Column[] =>
	columns.map((c) => {
		const statusIds = (c.statuses ?? []).map((s) => s.id ?? "");
		return {
			name: c.name ?? "",
			statusIds,
			cards: cards.filter((k) => statusIds.includes(k.statusId)),
		};
	});

// Affichage immédiat d'un déplacement, avant la réponse de Jira.
export const moveCard = (
	columns: Column[],
	key: string,
	toStatusId: string,
): Column[] => {
	const card = columns.flatMap((c) => c.cards).find((k) => k.key === key);
	if (!card || !columns.some((c) => c.statusIds.includes(toStatusId)))
		return columns;
	const moved = { ...card, statusId: toStatusId };
	return columns.map((c) => ({
		...c,
		cards: c.statusIds.includes(toStatusId)
			? [...c.cards.filter((k) => k.key !== key), moved]
			: c.cards.filter((k) => k.key !== key),
	}));
};

export function explainError(error: unknown): string {
	if (isRateLimitError(error)) {
		const wait = error.retryAfterMs
			? ` (${Math.ceil(error.retryAfterMs / 1000)} s)`
			: "";
		return t("errors.rateLimit", { wait });
	}
	if (isAuthError(error)) return t("errors.auth");
	if (isNetworkError(error)) return t("errors.network");
	if (isApiError(error)) return t("errors.api", { message: error.message });
	return error instanceof Error ? error.message : String(error);
}

export type Detail = {
	key: string;
	summary: string;
	status: string;
	type?: string;
	priority?: string;
	assignee?: string;
	labels: string[];
	sprint?: string;
	description: string;
	attachments: Attachment[];
	customFields: { name: string; value: string }[];
	comments: { author: string; created: string; body: string }[];
	links: { label: string; key: string; summary: string }[];
};

// Champs déjà affichés ailleurs ou sans valeur lisible pour un humain.
const HIDDEN_FIELDS = new Set([
	"sprint",
	"rank",
	"classement",
	"development",
	"last update by",
]);
const ISO_DATE = /^\d{4}-\d\d-\d\dT/;
// Valeurs techniques (JSON, dump d'objet) : illisibles pour un humain.
const isTechnical = (s: string) => /^\{.*[:=]/s.test(s);

// Valeur d'un champ personnalisé, quelle que soit sa forme : texte, nombre, choix, personne, liste, ADF.
function fieldText(v: unknown): string {
	if (v == null || v === "") return "";
	if (Array.isArray(v)) return v.map(fieldText).filter(Boolean).join(", ");
	if (typeof v === "string" && ISO_DATE.test(v))
		return new Date(v).toLocaleString();
	if (typeof v === "string") return adfToText(v);
	if (typeof v !== "object") return String(v);
	const o = v as Record<string, unknown>;
	if (o.type === "doc") return adfToText(o as AdfNode);
	return fieldText(o.value ?? o.name ?? o.displayName ?? o.key ?? o.title);
}

type IssueFields = {
	summary?: string;
	status?: { name?: string };
	issuetype?: { name?: string };
	priority?: { name?: string };
	assignee?: { displayName?: string };
	labels?: string[];
	sprint?: { name?: string };
	attachment?: { id?: string; filename?: string }[];
	description?: AdfNode | string | null;
	comment?: {
		comments?: {
			author?: { displayName?: string };
			created?: string;
			body?: AdfNode | string;
		}[];
	};
	issuelinks?: {
		type?: { inward?: string; outward?: string };
		inwardIssue?: { key?: string; fields?: { summary?: string } };
		outwardIssue?: { key?: string; fields?: { summary?: string } };
	}[];
};

export async function loadIssue(
	jira: Jira,
	key: string,
	siteUrl = "",
): Promise<Detail> {
	// L'API agile renvoie le texte en balisage Jira brut ; l'API v3 le renvoie en ADF,
	// que adfToText sait mettre en forme. Le sprint n'existe que côté agile.
	const [issue, agile] = await Promise.all([
		jira.cloud.issues.getIssue({
			issueIdOrKey: key,
			fields: ["*all"],
			expand: "names",
		}),
		jira.agile.issue.getIssue({
			issueIdOrKey: key,
			fields: ["sprint"] as never,
		}),
	]);
	const f = (issue.fields ?? {}) as IssueFields;
	// Lien ouvrable dans le navigateur, où l'utilisateur est déjà connecté à Jira.
	const files = (f.attachment ?? []).flatMap((a) =>
		a.id && a.filename
			? [
					{
						id: a.id,
						filename: a.filename,
						url: `${siteUrl}/secure/attachment/${a.id}/${encodeURIComponent(a.filename)}`,
					},
				]
			: [],
	);
	const names = (issue as { names?: Record<string, string> }).names ?? {};
	const customFields = Object.entries(issue.fields ?? {}).flatMap(
		([id, value]) => {
			const name = names[id] ?? id;
			const text = id.startsWith("customfield_") ? fieldText(value) : "";
			return text &&
				!isTechnical(text) &&
				!HIDDEN_FIELDS.has(name.toLowerCase())
				? [{ name, value: text.trim() }]
				: [];
		},
	);
	return {
		key: issue.key ?? key,
		summary: f.summary ?? "",
		status: f.status?.name ?? "",
		type: f.issuetype?.name,
		priority: f.priority?.name,
		assignee: f.assignee?.displayName,
		labels: f.labels ?? [],
		sprint: ((agile.fields ?? {}) as IssueFields).sprint?.name,
		attachments: files,
		customFields,
		description: adfToText(f.description, files),
		comments: (f.comment?.comments ?? []).map((c) => ({
			author: c.author?.displayName ?? "?",
			created: c.created ?? "",
			body: adfToText(c.body, files),
		})),
		links: (f.issuelinks ?? []).flatMap((l) => {
			const other = l.outwardIssue ?? l.inwardIssue;
			if (!other?.key) return [];
			const label =
				(l.outwardIssue ? l.type?.outward : l.type?.inward) ??
				t("detail.linkedTo");
			return [{ label, key: other.key, summary: other.fields?.summary ?? "" }];
		}),
	};
}

const ISSUE_KEY = /^[A-Za-z][A-Za-z0-9]+-\d+$/;

// Recherche pour « Aller à un ticket » : la clé saisie (ou son seul numéro, dans le projet actif), puis les titres proches.
export async function findIssues(
	jira: Jira,
	query: string,
	projectKey?: string,
) {
	const q = query.trim();
	if (!q) return [];
	const key = /^\d+$/.test(q) && projectKey ? `${projectKey}-${q}` : q;
	const jql = [
		projectKey && `project = "${projectKey}"`,
		`(summary ~ "${q.replace(/["\\]/g, "")}*"${ISSUE_KEY.test(key) ? ` OR key = "${key}"` : ""})`,
	]
		.filter(Boolean)
		.join(" AND ");
	const { issues } =
		await jira.cloud.issueSearch.searchAndReconsileIssuesUsingJql({
			jql,
			maxResults: 10,
			fields: ["summary"],
		});
	return (issues ?? []).map((i) => ({
		key: i.key ?? "",
		summary: (i.fields as { summary?: string } | undefined)?.summary ?? "",
	}));
}
