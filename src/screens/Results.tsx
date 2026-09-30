import { Box, Text, useInput } from "ink";
import { useEffect, useState } from "react";
import { t } from "../i18n.js";
import type { Card } from "../jira.js";
import { useAccent } from "../theme.js";

const PAGE_SIZE = 20;

export function Results({
	cards,
	summary,
	active = true,
	onSelect,
	onOpen,
	onBack,
}: {
	cards: Card[];
	summary: string;
	active?: boolean;
	onSelect?: (card?: Card) => void;
	onOpen: (card: Card) => void;
	onBack: () => void;
}) {
	const accent = useAccent();
	const [row, setRow] = useState(0);
	const index = Math.min(row, Math.max(0, cards.length - 1));
	const selected = cards[index];
	useEffect(() => onSelect?.(selected), [selected, onSelect]);

	useInput(
		(input, key) => {
			if (key.escape || input === "b") onBack();
			else if (key.downArrow || input === "j")
				setRow(Math.min(cards.length - 1, index + 1));
			else if (key.upArrow || input === "k") setRow(Math.max(0, index - 1));
			else if (key.rightArrow)
				setRow(Math.min(cards.length - 1, index + PAGE_SIZE));
			else if (key.leftArrow) setRow(Math.max(0, index - PAGE_SIZE));
			else if (key.return && selected) onOpen(selected);
		},
		{ isActive: active },
	);

	const page = Math.floor(index / PAGE_SIZE);
	const pages = Math.ceil(cards.length / PAGE_SIZE);
	const shown = cards.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
	const widest = (get: (c: Card) => string) =>
		Math.max(0, ...shown.map((c) => get(c).length));
	const keyWidth = widest((c) => c.key);
	const statusWidth = Math.min(
		20,
		widest((c) => c.statusName ?? "—"),
	);
	const assigneeWidth = Math.min(
		24,
		widest((c) => c.assignee ?? t("board.unassigned")),
	);

	if (!summary)
		return (
			<Box
				flexGrow={1}
				flexDirection="column"
				alignItems="center"
				justifyContent="center"
			>
				<Text bold>{t("results.title")}</Text>
				<Text dimColor>{t("results.hint")}</Text>
			</Box>
		);

	return (
		<Box flexDirection="column" flexGrow={1}>
			<Text bold>
				{" "}
				{t("results.title")} · {t("results.count", { count: cards.length })}
				{pages > 1 && ` · ${t("results.page", { page: page + 1, pages })}`}
			</Text>
			<Text dimColor> {summary}</Text>
			{shown.map((c, i) => (
				<Box key={c.key} gap={2}>
					<Text color={page * PAGE_SIZE + i === index ? accent : undefined}>
						{page * PAGE_SIZE + i === index ? "▸" : " "}{" "}
						{c.key.padEnd(keyWidth)}
					</Text>
					<Box flexGrow={1} flexBasis={0}>
						<Text
							wrap="truncate"
							color={page * PAGE_SIZE + i === index ? accent : undefined}
						>
							{c.summary}
						</Text>
					</Box>
					<Box width={statusWidth}>
						<Text wrap="truncate" dimColor>
							{c.statusName ?? "—"}
						</Text>
					</Box>
					<Box width={assigneeWidth}>
						<Text wrap="truncate" dimColor>
							{c.assignee ?? t("board.unassigned")}
						</Text>
					</Box>
				</Box>
			))}
			<Box flexGrow={1} />
			<Text dimColor> {t("results.footer")}</Text>
		</Box>
	);
}
