import chalk from "chalk";
import { Box, Text, useInput, useStdout } from "ink";
import { useState } from "react";
import terminalLink from "terminal-link";
import wrapAnsi from "wrap-ansi";
import i18next, { t } from "../i18n.js";
import type { Detail as IssueDetail } from "../jira.js";
import { useAccent } from "../theme.js";

const HEADER_ROWS = 6;

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
	["year", 31_536_000],
	["month", 2_592_000],
	["day", 86_400],
	["hour", 3_600],
	["minute", 60],
];

// « il y a 2 h » ; une date illisible est affichée telle quelle.
export const ago = (iso: string, now = Date.now()) => {
	const seconds = (Date.parse(iso) - now) / 1000;
	if (Number.isNaN(seconds)) return iso;
	const [unit, size] = UNITS.find(([, s]) => Math.abs(seconds) >= s) ?? [
		"second",
		1,
	];
	return new Intl.RelativeTimeFormat(i18next.language, {
		numeric: "auto",
		style: "short",
	}).format(Math.round(seconds / size), unit);
};

const STATUS_COLORS: [RegExp, string][] = [
	[/termin|done|résolu|fermé|closed/i, "green"],
	[/cours|progress|review|revue/i, "yellow"],
];
const PRIORITY_COLORS: [RegExp, string][] = [
	[/highest|critical|bloqu|critique|urgent/i, "red"],
	[/high|haute|majeur/i, "yellow"],
	[/low|basse|mineur|trivial/i, "gray"],
];
const colorOf = (rules: [RegExp, string][], name = "", fallback?: string) =>
	rules.find(([re]) => re.test(name))?.[1] ?? fallback;

const section = (title: string) => chalk.bold.underline(title);

const LABEL_MAX = 28;
// Modèle de fiche resté vide (« Login : ») : présent mais sans intérêt.
const isEmptyPrompt = (l: string) => /^\W*[^:]{1,40}:\s*$/.test(l);

// Champs courts alignés en deux colonnes ; champs longs sous leur titre, avec un filet à gauche.
export const fieldLines = (
	fields: IssueDetail["customFields"],
	width: number,
) => {
	const isShort = (f: (typeof fields)[number]) =>
		!f.value.includes("\n") && f.value.length <= width - LABEL_MAX - 2;
	const labelWidth = Math.min(
		LABEL_MAX,
		Math.max(0, ...fields.filter(isShort).map((f) => f.name.length)),
	);
	const short = fields.filter(isShort).map((f) => {
		const label =
			f.name.length > LABEL_MAX ? `${f.name.slice(0, LABEL_MAX - 1)}…` : f.name;
		return `${chalk.dim(label.padEnd(labelWidth))}  ${f.value}`;
	});
	const long = fields
		.filter((f) => !isShort(f))
		.flatMap((f) => [
			"",
			chalk.bold(`▸ ${f.name}`),
			...wrapAnsi(f.value, Math.max(10, width - 2), { hard: true })
				.split("\n")
				.map((l) => chalk.dim("│ ") + (isEmptyPrompt(l) ? chalk.dim(l) : l)),
		]);
	return [...short, ...long];
};

export const detailLines = (d: IssueDetail, width: number) => {
	const parts = [
		section(t("detail.description")),
		d.description || chalk.dim(t("detail.noDescription")),
		...(d.customFields.length
			? ["", section(t("detail.fields")), ...fieldLines(d.customFields, width)]
			: []),
		...(d.attachments.length
			? [
					"",
					section(t("detail.attachments", { count: d.attachments.length })),
					...d.attachments.map((a) => terminalLink(`📎 ${a.filename}`, a.url)),
				]
			: []),
		...(d.links.length
			? [
					"",
					section(t("detail.links")),
					...d.links.map(
						(l) => `${chalk.dim(l.label)} ${chalk.bold(l.key)} ${l.summary}`,
					),
				]
			: []),
		"",
		section(t("detail.comments", { count: d.comments.length })),
		...d.comments.flatMap((c) => [
			"",
			`${chalk.bold(c.author)} ${chalk.dim(`· ${ago(c.created)}`)}`,
			c.body,
		]),
	];
	return wrapAnsi(parts.join("\n"), width, { hard: true }).split("\n");
};

const percent = (top: number, maxTop: number) =>
	maxTop === 0 ? 100 : Math.round((top / maxTop) * 100);

export function Detail({
	issue,
	active = true,
	onBack,
}: {
	issue: IssueDetail;
	active?: boolean;
	onBack: () => void;
}) {
	const { stdout } = useStdout();
	const accent = useAccent();
	const [scroll, setTop] = useState(0);
	const lines = detailLines(issue, Math.max(20, (stdout.columns ?? 100) - 2));
	const height = Math.max(3, (stdout.rows ?? 30) - HEADER_ROWS);
	const maxTop = Math.max(0, lines.length - height);
	// Le rechargement automatique peut raccourcir la page : on reste dans ses bornes.
	const top = Math.min(scroll, maxTop);

	useInput(
		(input, key) => {
			if (key.escape || key.backspace || key.delete || input === "b") onBack();
			else if (key.downArrow || input === "j")
				setTop(Math.min(maxTop, top + 1));
			else if (key.upArrow || input === "k") setTop(Math.max(0, top - 1));
			else if (key.pageDown || input === " ")
				setTop(Math.min(maxTop, top + height));
			else if (key.pageUp) setTop(Math.max(0, top - height));
			else if (input === "g") setTop(0);
			else if (input === "G") setTop(maxTop);
		},
		{ isActive: active },
	);

	return (
		<Box flexDirection="column" flexGrow={1}>
			<Text bold wrap="truncate-end">
				{" "}
				<Text color={accent}>{issue.key}</Text> {issue.summary}
			</Text>
			<Text wrap="truncate-end">
				{" "}
				<Text color={colorOf(STATUS_COLORS, issue.status, accent)} bold>
					{issue.status}
				</Text>
				{" · "}
				<Text color={colorOf(PRIORITY_COLORS, issue.priority)}>
					{issue.priority ?? "—"}
				</Text>
				{" · "}
				{issue.assignee ? (
					<Text color="green">{issue.assignee}</Text>
				) : (
					<Text dimColor>{t("board.unassigned")}</Text>
				)}
			</Text>
			<Text dimColor wrap="truncate-end">
				{" "}
				{issue.type ?? "—"} ·{" "}
				{t("detail.labels", { labels: issue.labels.join(", ") || "—" })} ·{" "}
				{t("detail.sprint", { sprint: issue.sprint ?? "—" })}
			</Text>
			<Box flexDirection="column" flexGrow={1} paddingX={1} marginTop={1}>
				{lines.slice(top, top + height).map((l, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: lignes d'affichage sans identité
					<Text key={top + i}>{l || " "}</Text>
				))}
			</Box>
			<Text dimColor>
				{" "}
				{t("detail.footer", { percent: percent(top, maxTop) })}
			</Text>
		</Box>
	);
}

// Ticket en chargement ou introuvable : Échap doit toujours permettre de revenir.
export function DetailPending({
	label,
	error,
	onBack,
}: {
	label: string;
	error?: string;
	onBack: () => void;
}) {
	useInput((input, key) => {
		if (key.escape || key.backspace || key.delete || input === "b") onBack();
	});
	return (
		<Text dimColor>
			{" "}
			{error ? t("detail.inaccessible") : label} {t("detail.pendingBack")}
		</Text>
	);
}
