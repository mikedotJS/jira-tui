import Fuse from "fuse.js";

// `pick` ouvre un second niveau : la saisie filtre alors les choix qu'il renvoie.
export type Command = {
	id: string;
	label: string;
	run?: () => void;
	// Multi-sélection : la commande s'exécute puis la palette reste ouverte.
	keep?: boolean;
	pick?: (query: string) => Promise<Command[]> | Command[];
};

// Sans saisie : commandes récentes d'abord, puis l'ordre d'origine.
// Avec saisie : recherche approximative sur le libellé.
export function rankCommands(
	commands: Command[],
	query: string,
	recents: string[],
): Command[] {
	const q = query.trim();
	if (q) {
		return new Fuse(commands, { keys: ["label"], threshold: 0.4 })
			.search(q)
			.map((r) => r.item);
	}
	const order = (c: Command) => {
		const i = recents.indexOf(c.id);
		return i < 0 ? Number.POSITIVE_INFINITY : i;
	};
	return [...commands].sort((a, b) => order(a) - order(b));
}

export const pushRecent = (recents: string[], id: string, max = 5) =>
	[id, ...recents.filter((r) => r !== id)].slice(0, max);
