import { Text, useInput } from "ink";
import { useEffect, useState } from "react";
import { t } from "../i18n.js";
import { type Command, rankCommands } from "../palette.js";
import { useAccent, useBackground } from "../theme.js";
import { Modal, useModalRows } from "./Modal.js";

const DEBOUNCE_MS = 150;
const MAX_VISIBLE = 12;
// Saisie, message d'état et pied de page.
const RESERVED_ROWS = 3;

export function Palette({
	commands,
	recents,
	onRun,
	onClose,
}: {
	commands: Command[];
	recents: string[];
	onRun: (command: Command) => void;
	onClose: () => void;
}) {
	const accent = useAccent();
	const background = useBackground();
	const visible = Math.min(MAX_VISIBLE, useModalRows(RESERVED_ROWS));
	const [query, setQuery] = useState("");
	const [index, setIndex] = useState(0);
	const [picker, setPicker] = useState<Command>();
	const [options, setOptions] = useState<Command[]>([]);
	const [loading, setLoading] = useState(false);
	const [tick, setTick] = useState(0);
	const results = picker ? options : rankCommands(commands, query, recents);
	// La liste défile pour garder la sélection visible.
	const start = Math.max(
		0,
		Math.min(index - visible + 1, results.length - visible),
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: tick relance la requête après un choix multiple
	useEffect(() => {
		if (!picker?.pick) return;
		let live = true;
		const timer = setTimeout(async () => {
			setLoading(true);
			try {
				const found = await picker.pick?.(query);
				if (live) setOptions(found ?? []);
			} catch {
				if (live) setOptions([]);
			}
			if (live) setLoading(false);
		}, DEBOUNCE_MS);
		return () => {
			live = false;
			clearTimeout(timer);
		};
	}, [picker, query, tick]);

	const type = (next: string) => {
		setQuery(next);
		setIndex(0);
	};

	useInput((input, key) => {
		if (key.escape) {
			if (!picker) return onClose();
			setPicker(undefined);
			setOptions([]);
			type("");
		} else if (key.return) {
			const command = results[index];
			if (!command) return;
			if (command.pick) {
				setPicker(command);
				setOptions([]);
				type("");
			} else if (command.keep) {
				command.run?.();
				setTick(tick + 1);
			} else onRun(command);
		} else if (key.upArrow || (key.ctrl && input === "p"))
			setIndex(Math.max(0, index - 1));
		else if (key.downArrow || (key.ctrl && input === "n"))
			setIndex(Math.min(results.length - 1, index + 1));
		else if (key.backspace || key.delete) type(query.slice(0, -1));
		else if (input && !key.ctrl && !key.meta) type(query + input);
	});

	return (
		<Modal>
			<Text>
				<Text color={accent}>{picker ? `${picker.label} › ` : "› "}</Text>
				{query}
				<Text inverse> </Text>
			</Text>
			{loading && <Text dimColor>{t("palette.searching")}</Text>}
			{!loading && results.length === 0 && (
				<Text dimColor>
					{picker ? t("palette.noResult") : t("palette.noCommand")}
				</Text>
			)}
			{results.slice(start, start + visible).map((c, i) => (
				<Text
					key={c.id}
					wrap="truncate"
					backgroundColor={background}
					color={start + i === index ? accent : undefined}
				>
					{start + i === index ? "▸ " : "  "}
					{c.label}
				</Text>
			))}
			<Text dimColor>
				{t("palette.footer", {
					action: picker ? t("palette.back") : t("palette.close"),
				})}
			</Text>
		</Modal>
	);
}
