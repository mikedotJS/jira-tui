import { expect, test } from "vitest";
import { groupByColumn, normalizeSiteUrl } from "../src/jira.js";

test("normalise l'adresse du site", () => {
	expect(normalizeSiteUrl(" acme.atlassian.net/ ")).toBe(
		"https://acme.atlassian.net",
	);
	expect(normalizeSiteUrl("http://x.test")).toBe("http://x.test");
});

test("range les tickets dans la colonne de leur statut", () => {
	const card = (key: string, statusId: string) => ({
		key,
		summary: key,
		statusId,
	});
	const columns = groupByColumn(
		[
			{ name: "À faire", statuses: [{ id: "1" }] },
			{ name: "En cours", statuses: [{ id: "2" }, { id: "3" }] },
		],
		[card("A-1", "1"), card("A-2", "3"), card("A-3", "2")],
	);
	expect(columns.map((c) => c.cards.map((k) => k.key))).toEqual([
		["A-1"],
		["A-2", "A-3"],
	]);
});
