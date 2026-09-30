import chalk from "chalk";
import { Marked, type MarkedExtension } from "marked";
import { markedTerminal } from "marked-terminal";
import terminalLink from "terminal-link";
import { t } from "./i18n.js";

// Rendu texte d'un document Atlassian (ADF) : pas de bibliothèque maintenue
// pour ça (adf-to-md n'a plus de version depuis 2024), le format est un arbre JSON simple.
export type Attachment = { id: string; filename: string; url: string };

export type AdfNode = {
	type: string;
	text?: string;
	attrs?: Record<string, unknown>;
	marks?: { type: string; attrs?: Record<string, unknown> }[];
	content?: AdfNode[];
};

const inline = (nodes: AdfNode[] = [], files: Attachment[] = []): string =>
	nodes.map((n) => renderInline(n, files)).join("");

function renderInline(n: AdfNode, files: Attachment[]): string {
	switch (n.type) {
		case "text": {
			let s = n.text ?? "";
			for (const m of n.marks ?? []) {
				if (m.type === "strong") s = chalk.bold(s);
				else if (m.type === "em") s = chalk.italic(s);
				else if (m.type === "strike") s = chalk.strikethrough(s);
				else if (m.type === "code") s = chalk.cyan(s);
				else if (m.type === "link" && m.attrs?.href !== s)
					s = `${chalk.underline(s)} (${m.attrs?.href})`;
			}
			return s;
		}
		case "hardBreak":
			return "\n";
		case "mention":
		case "emoji":
		case "status":
			return String(n.attrs?.text ?? n.attrs?.shortName ?? "");
		case "inlineCard":
			return String(n.attrs?.url ?? "");
		case "date":
			return new Date(Number(n.attrs?.timestamp)).toLocaleDateString();
		default:
			return inline(n.content, files);
	}
}

const indent = (s: string, prefix: string) =>
	s
		.split("\n")
		.map((l, i) => (i === 0 ? prefix : " ".repeat(prefix.length)) + l)
		.join("\n");

function block(n: AdfNode, files: Attachment[]): string {
	const kids = (n.content ?? []).map((k) => block(k, files));
	switch (n.type) {
		case "paragraph":
			return inline(n.content, files);
		case "heading":
			return chalk.bold.underline(inline(n.content, files));
		case "bulletList":
			return kids.map((k) => indent(k, "• ")).join("\n");
		case "orderedList":
			return kids.map((k, i) => indent(k, `${i + 1}. `)).join("\n");
		case "codeBlock":
			return chalk.cyan(indent(inline(n.content, files), "  "));
		case "blockquote":
			return indent(kids.join("\n"), "│ ");
		case "panel":
			return indent(kids.join("\n"), "▌ ");
		case "rule":
			return "────────";
		case "table":
			return kids.join("\n");
		case "tableRow":
			return (n.content ?? [])
				.map((c) => block(c, files).replace(/\n/g, " "))
				.join(" │ ");
		case "media": {
			const file = files.find((f) => f.filename === n.attrs?.alt);
			return file
				? terminalLink(`📎 ${file.filename}`, file.url)
				: t("detail.attachment");
		}
		case "mediaSingle":
		case "mediaGroup":
			return kids.join("\n");
		case "doc":
		case "listItem":
		case "tableCell":
		case "tableHeader":
			return kids.join("\n");
		default:
			return n.content ? kids.join("\n") : renderInline(n, files);
	}
}

const markdown = new Marked(
	// Les types publiés datent de la v6 : markedTerminal renvoie bien une extension.
	markedTerminal({ reflowText: false }) as unknown as MarkedExtension,
);

// Les commentaires ou descriptions peuvent aussi arriver en texte brut ou en Markdown.
export const adfToText = (
	doc: AdfNode | string | null | undefined,
	files: Attachment[] = [],
): string =>
	!doc
		? ""
		: typeof doc === "string"
			? (markdown.parse(doc, { async: false }) as string).trimEnd()
			: block(doc, files);
