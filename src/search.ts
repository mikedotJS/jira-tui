import { t } from "./i18n.js";
import type { Card, Jira } from "./jira.js";

export type Filters = {
	text?: string;
	jql?: string;
	status: string[];
	assignee: string[];
	type: string[];
	priority: string[];
	labels: string[];
	sprint: string[];
	// Libellés à afficher pour les valeurs (ex. nom d'un assigné pour son identifiant).
	names: Record<string, string>;
};

export const ACTIVE_SPRINT = "@active";
export const ME = "@me";

export const emptyFilters = (): Filters => ({
	status: [],
	assignee: [],
	type: [],
	priority: [],
	labels: [],
	sprint: [],
	names: {},
});

export const hasFilters = (f: Filters) =>
	Boolean(f.text || f.jql) ||
	[f.status, f.assignee, f.type, f.priority, f.labels, f.sprint].some(
		(v) => v.length > 0,
	);

const quote = (v: string) => `"${v.replace(/["\\]/g, "")}"`;

// Plusieurs valeurs d'un même filtre : « ou ». Plusieurs filtres : « et ».
export function buildJql(projectKey: string, f: Filters): string {
	if (f.jql) return f.jql;
	const list = (field: string, values: string[]) =>
		values.length ? `${field} in (${values.map(quote).join(", ")})` : undefined;
	const assignee = f.assignee.map((v) =>
		v === ME ? "currentUser()" : quote(v),
	);
	const sprints = f.sprint.filter((s) => s !== ACTIVE_SPRINT);
	const sprintClauses = [
		f.sprint.includes(ACTIVE_SPRINT) && "sprint in openSprints()",
		sprints.length && `sprint in (${sprints.map(quote).join(", ")})`,
	].filter(Boolean);
	const clauses = [
		`project = ${quote(projectKey)}`,
		f.text && `text ~ ${quote(f.text)}`,
		list("status", f.status),
		assignee.length && `assignee in (${assignee.join(", ")})`,
		list("issuetype", f.type),
		list("priority", f.priority),
		list("labels", f.labels),
		sprintClauses.length && `(${sprintClauses.join(" OR ")})`,
	].filter(Boolean);
	return `${clauses.join(" AND ")} ORDER BY updated DESC`;
}

export async function searchIssues(jira: Jira, jql: string): Promise<Card[]> {
	const { issues = [] } =
		await jira.cloud.issueSearch.searchAndReconsileIssuesUsingJql({
			jql,
			maxResults: 100,
			fields: ["summary", "status", "assignee", "priority"],
		});
	return issues.map((i) => {
		const f = i.fields as
			| {
					summary?: string;
					status?: { id?: string; name?: string };
					assignee?: { displayName?: string };
					priority?: { name?: string };
			  }
			| undefined;
		return {
			key: i.key ?? "",
			summary: f?.summary ?? "",
			statusId: f?.status?.id ?? "",
			statusName: f?.status?.name,
			assignee: f?.assignee?.displayName,
			priority: f?.priority?.name,
		};
	});
}

export type FilterName =
	| "status"
	| "assignee"
	| "type"
	| "priority"
	| "labels"
	| "sprint";
export type Choice = { value: string; label: string };

// Valeurs proposées pour chaque filtre.
export async function loadChoices(
	jira: Jira,
	name: FilterName,
	ctx: { projectKey: string; boardId?: number },
	query: string,
): Promise<Choice[]> {
	const same = (v: string) => ({ value: v, label: v });
	switch (name) {
		case "status":
		case "type": {
			const types = await jira.cloud.projects.getAllStatuses({
				projectIdOrKey: ctx.projectKey,
			});
			const names =
				name === "type"
					? types.map((t) => t.name ?? "")
					: types.flatMap((t) => t.statuses?.map((s) => s.name ?? "") ?? []);
			return [...new Set(names)].filter(Boolean).map(same);
		}
		case "assignee": {
			const users = await jira.cloud.userSearch.findAssignableUsers({
				project: ctx.projectKey,
				query,
				maxResults: 20,
			});
			return [
				{ value: ME, label: t("choices.me") },
				...users.map((u) => ({
					value: u.accountId ?? "",
					label: u.displayName ?? "",
				})),
			];
		}
		case "priority": {
			const { values = [] } = await jira.cloud.issuePriorities.searchPriorities(
				{},
			);
			return values.map((p) => same(p.name ?? ""));
		}
		case "labels": {
			const { values = [] } = await jira.cloud.labels.getAllLabels({
				maxResults: 100,
			});
			return values.map(same);
		}
		case "sprint": {
			if (!ctx.boardId) return [];
			const { values = [] } = await jira.agile.board.getAllSprints({
				boardId: ctx.boardId,
				state: "active,future",
			});
			return [
				{ value: ACTIVE_SPRINT, label: t("choices.activeSprint") },
				...values.map((s) => ({ value: String(s.id), label: s.name ?? "" })),
			];
		}
	}
}

// Un projet sans sprint (kanban) répond par une erreur : le filtre est alors masqué.
export const hasSprints = (jira: Jira, boardId: number) =>
	jira.agile.board.getAllSprints({ boardId, maxResults: 1 }).then(
		() => true,
		() => false,
	);
