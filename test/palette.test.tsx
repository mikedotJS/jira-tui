import { render } from "ink-testing-library";
import { expect, test, vi } from "vitest";
import { type Command, pushRecent, rankCommands } from "../src/palette.js";
import { Palette } from "../src/screens/Palette.js";
import { Behind } from "./behind.js";

const run = () => {};
const commands: Command[] = [
	{ id: "board", label: "Afficher le tableau", run },
	{ id: "projects", label: "Changer de projet", run },
	{ id: "quit", label: "Quitter", run },
];

const tick = () => new Promise((r) => setTimeout(r, 20));

test("sans saisie, les commandes récentes passent en tête", () => {
	const ids = rankCommands(commands, "", ["quit", "projects"]).map((c) => c.id);
	expect(ids).toEqual(["quit", "projects", "board"]);
});

test("la saisie filtre avec une recherche approximative", () => {
	expect(rankCommands(commands, "projt", []).map((c) => c.id)).toEqual([
		"projects",
	]);
});

test("les récents sont dédoublonnés et limités", () => {
	expect(pushRecent(["a", "b", "c"], "b", 3)).toEqual(["b", "a", "c"]);
	expect(pushRecent(["a", "b", "c"], "d", 3)).toEqual(["d", "a", "b"]);
});

test("la palette lance la commande choisie puis se ferme avec Échap", async () => {
	const onRun = vi.fn();
	const onClose = vi.fn();
	const { stdin, lastFrame } = render(
		<Behind>
			<Palette
				commands={commands}
				recents={[]}
				onRun={onRun}
				onClose={onClose}
			/>
		</Behind>,
	);
	expect(lastFrame()).toContain("Quitter");
	stdin.write("quit");
	await tick();
	stdin.write("\r");
	await tick();
	expect(onRun).toHaveBeenCalledWith(commands[2]);
	stdin.write("\u001B");
	await tick();
	expect(onClose).toHaveBeenCalled();
});

test("la palette flotte au-dessus de l'écran de fond et défile", () => {
	const many = Array.from({ length: 30 }, (_, i) => ({
		id: `c${i}`,
		label: `Commande ${i}`,
		run,
	}));
	const frame = render(
		<Behind>
			<Palette commands={many} recents={[]} onRun={run} onClose={run} />
		</Behind>,
	).lastFrame();
	expect(frame).toContain("Tableau de fond");
	expect(frame).toContain("Commande 0");
	expect(frame).not.toContain("Commande 20");
});
