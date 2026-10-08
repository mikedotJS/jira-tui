import { render } from "ink-testing-library";
import { expect, test, vi } from "vitest";
import { createSuggester } from "../src/ai.js";
import type { Command } from "../src/palette.js";
import { Palette } from "../src/screens/Palette.js";
import { Behind } from "./behind.js";

const run = () => {};
const commands: Command[] = [
	{ id: "my-tickets", label: "Mes tickets", run },
	{ id: "quit", label: "Quitter", run },
];
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const reply = (json: unknown) => ({
	content: [{ type: "text", text: JSON.stringify(json) }],
});
const fakeClient = (create: ReturnType<typeof vi.fn>) =>
	({ messages: { create } }) as never;

test("le suggéreur garde les identifiants connus et met en cache la phrase", async () => {
	const create = vi.fn(async () =>
		reply({ ids: ["my-tickets", "inconnu"], search: " bloqués " }),
	);
	const suggest = createSuggester(fakeClient(create));
	const first = await suggest("mes tickets bloqués", commands);
	expect(first).toEqual({ ids: ["my-tickets"], search: "bloqués" });
	await suggest("mes tickets bloqués", commands);
	expect(create).toHaveBeenCalledTimes(1);
});

const palette = (suggest?: () => Promise<Command[]>) =>
	render(
		<Behind>
			<Palette
				commands={commands}
				recents={[]}
				suggest={suggest}
				onRun={run}
				onClose={run}
			/>
		</Behind>,
	);

test("les suggestions IA s'affichent au-dessus des résultats", async () => {
	const { stdin, lastFrame } = palette(async () => [
		{ id: "ai:my-tickets", label: "Mes tickets", run },
	]);
	stdin.write("montre ce qui est à moi");
	await wait(800);
	expect(lastFrame()).toContain("Suggestions IA");
	expect(lastFrame()).toContain("Mes tickets");
});

test("une panne de l'IA laisse la palette fonctionner comme avant", async () => {
	const { stdin, lastFrame } = palette(async () => {
		throw new Error("réseau coupé");
	});
	stdin.write("quit");
	await wait(800);
	expect(lastFrame()).toContain("Quitter");
	expect(lastFrame()).not.toContain("Suggestions IA");
});

test("aucun appel IA quand la saisie est vide", async () => {
	const suggest = vi.fn(async () => []);
	palette(suggest);
	await wait(800);
	expect(suggest).not.toHaveBeenCalled();
});
