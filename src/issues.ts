import { writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Attachment } from "./adf.js";
import { t } from "./i18n.js";
import type { Jira } from "./jira.js";

// Télécharge dans ~/Downloads sans écraser un fichier existant ; renvoie le chemin.
export async function downloadAttachment(
	account: { siteUrl: string; email: string; token: string },
	file: Attachment,
) {
	const res = await fetch(
		`${account.siteUrl}/rest/api/3/attachment/content/${file.id}`,
		{
			headers: {
				Authorization: `Basic ${Buffer.from(`${account.email}:${account.token}`).toString("base64")}`,
			},
		},
	);
	if (!res.ok)
		throw new Error(t("errors.downloadRefused", { status: res.status }));
	const data = Buffer.from(await res.arrayBuffer());
	const dir = join(homedir(), "Downloads");
	for (const name of [file.filename, `${file.id}-${file.filename}`]) {
		try {
			const path = join(dir, name);
			await writeFile(path, data, { flag: "wx" });
			return path;
		} catch (e) {
			if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
		}
	}
	throw new Error(t("errors.fileExists", { file: file.filename }));
}

export type FieldChoice = { id: string; name: string };
export type RequiredField = {
	key: string;
	name: string;
	choices?: FieldChoice[];
};
export type Transition = {
	id: string;
	name: string;
	toId: string;
	toName: string;
	required: RequiredField[];
};

type RawTransition = {
	id?: string;
	name?: string;
	to?: { id?: string; name?: string };
	fields?: Record<
		string,
		{
			required?: boolean;
			hasDefaultValue?: boolean;
			name?: string;
			allowedValues?: { id?: string; name?: string; value?: string }[];
		}
	>;
};

export async function loadTransitions(
	jira: Jira,
	key: string,
): Promise<Transition[]> {
	const { transitions = [] } = await jira.cloud.issues.getTransitions({
		issueIdOrKey: key,
		expand: "transitions.fields",
	});
	return (transitions as RawTransition[]).map((t) => ({
		id: t.id ?? "",
		name: t.name ?? "",
		toId: t.to?.id ?? "",
		toName: t.to?.name ?? t.name ?? "",
		required: Object.entries(t.fields ?? {})
			.filter(([, f]) => f.required && !f.hasDefaultValue)
			.map(([k, f]) => ({
				key: k,
				name: f.name ?? k,
				choices: f.allowedValues?.map((v) => ({
					id: v.id ?? "",
					name: v.name ?? v.value ?? "",
				})),
			})),
	}));
}

// Les champs à choix (ex. résolution) s'envoient par identifiant.
export const moveIssue = (
	jira: Jira,
	key: string,
	transitionId: string,
	fields: Record<string, { id: string }> = {},
) =>
	jira.cloud.issues.doTransition({
		issueIdOrKey: key,
		transition: { id: transitionId },
		fields,
	});

export const myAccountId = async (jira: Jira) =>
	(await jira.cloud.myself.getCurrentUser()).accountId ?? "";

export const assignIssue = (
	jira: Jira,
	key: string,
	accountId: string | null, // Jira attend null pour désassigner, le type de jira.js ne le prévoit pas.
) =>
	jira.cloud.issues.assignIssue({
		issueIdOrKey: key,
		accountId: accountId as never,
	});

export async function findAssignable(jira: Jira, key: string, query: string) {
	const users = await jira.cloud.userSearch.findAssignableUsers({
		issueKey: key,
		query,
		maxResults: 10,
	});
	return users.map((u) => ({
		id: u.accountId ?? "",
		name: u.displayName ?? "",
	}));
}
