import { render } from "ink-testing-library";
import { expect, test } from "vitest";
import { Board } from "../src/screens/Board.js";
import { Login } from "../src/screens/Login.js";
import { Projects } from "../src/screens/Projects.js";
import { Results } from "../src/screens/Results.js";

test("la connexion demande l'adresse Jira en premier", () => {
	expect(render(<Login onSubmit={() => {}} />).lastFrame()).toContain(
		"Adresse Jira",
	);
});

test("la connexion affiche l'erreur", () => {
	const frame = render(
		<Login error="Identifiants refusés" onSubmit={() => {}} />,
	).lastFrame();
	expect(frame).toContain("Identifiants refusés");
});

test("la liste des projets est affichée", () => {
	const frame = render(
		<Projects projects={[{ key: "ABC", name: "Alpha" }]} onSelect={() => {}} />,
	).lastFrame();
	expect(frame).toContain("ABC");
});

test("le tableau affiche colonnes et cartes", () => {
	const frame = render(
		<Board
			title="Alpha"
			onRefresh={() => {}}
			columns={[
				{
					name: "À faire",
					statusIds: ["1"],
					cards: [
						{
							key: "A-1",
							summary: "Un ticket",
							statusId: "1",
							assignee: "Zoé",
							priority: "High",
						},
					],
				},
				{ name: "Terminé", statusIds: ["2"], cards: [] },
			]}
		/>,
	).lastFrame();
	expect(frame).toContain("À faire (1)");
	expect(frame).toContain("A-1 Un ticket");
	expect(frame).toContain("Zoé · High");
});

test("les résultats sans filtre affichent l'invitation à chercher, sans ticket", () => {
	const frame = render(
		<Results cards={[]} summary="" onOpen={() => {}} onBack={() => {}} />,
	).lastFrame();
	expect(frame).toContain("Ctrl+K ou : pour chercher ou filtrer");
	expect(frame).not.toContain("résultat(s)");
});

test("les résultats d'une recherche affichent les tickets", () => {
	const frame = render(
		<Results
			cards={[{ key: "AB-1", summary: "Bug", columnId: "1" } as never]}
			summary="texte « bug »"
			onOpen={() => {}}
			onBack={() => {}}
		/>,
	).lastFrame();
	expect(frame).toContain("AB-1");
	expect(frame).toContain("1 résultat");
});

test("les résultats sont paginés par 20", () => {
	const cards = Array.from({ length: 45 }, (_, i) => ({
		key: `AB-${i + 1}`,
		summary: "Ticket",
	}));
	const frame = render(
		<Results
			cards={cards as never}
			summary="texte « t »"
			onOpen={() => {}}
			onBack={() => {}}
		/>,
	).lastFrame();
	expect(frame).toContain("page 1/3");
	expect(frame).toContain("AB-20 ");
	expect(frame).not.toContain("AB-21 ");
});
