import { Box, Text, useInput, useStdout } from "ink";
import { useEffect, useRef, useState } from "react";
import { t } from "../i18n.js";
import type { Card, Column } from "../jira.js";
import { useAccent } from "../theme.js";

export function Board({
	columns,
	title,
	updatedAt,
	onRefresh,
	onSelect,
	active = true,
}: {
	columns: Column[];
	title: string;
	updatedAt?: Date;
	onRefresh: () => void;
	onSelect?: (card?: Card) => void;
	active?: boolean;
}) {
	const accent = useAccent();
	const { stdout } = useStdout();
	const [col, setCol] = useState(0);
	const [row, setRow] = useState(0);
	const selectedKey = useRef<string | undefined>(undefined);

	// Après un rafraîchissement, on garde le ticket sélectionné s'il existe encore.
	useEffect(() => {
		const key = selectedKey.current;
		columns.forEach((c, ci) => {
			const ri = c.cards.findIndex((k) => k.key === key);
			if (ri >= 0) {
				setCol(ci);
				setRow(ri);
			}
		});
	}, [columns]);

	const select = (c: number, r: number) => {
		const nc = Math.max(0, Math.min(columns.length - 1, c));
		const nr = Math.max(0, Math.min((columns[nc]?.cards.length ?? 1) - 1, r));
		selectedKey.current = columns[nc]?.cards[nr]?.key;
		setCol(nc);
		setRow(nr);
	};

	const selected = columns[col]?.cards[row];
	useEffect(() => onSelect?.(selected), [selected, onSelect]);

	useInput(
		(input, key) => {
			if (key.leftArrow || input === "h") select(col - 1, row);
			else if (key.rightArrow || input === "l") select(col + 1, row);
			else if (key.upArrow || input === "k") select(col, row - 1);
			else if (key.downArrow || input === "j") select(col, row + 1);
			else if (input === "r") onRefresh();
		},
		{ isActive: active },
	);

	const width = Math.floor(
		(stdout.columns ?? 100) / Math.max(columns.length, 1),
	);

	return (
		<Box flexDirection="column" flexGrow={1}>
			<Text bold> {title}</Text>
			<Box flexGrow={1}>
				{columns.map((c, ci) => (
					<Box key={c.name} flexDirection="column" width={width} paddingX={1}>
						<Text bold underline>
							{c.name} ({c.cards.length})
						</Text>
						{c.cards.map((k, ri) => {
							const selected = ci === col && ri === row;
							return (
								<Box
									key={k.key}
									flexDirection="column"
									borderStyle="round"
									borderColor={selected ? accent : "gray"}
								>
									<Text wrap="truncate" bold={selected}>
										{k.key} {k.summary}
									</Text>
									<Text wrap="truncate" dimColor>
										{k.assignee ?? t("board.unassigned")} · {k.priority ?? "—"}
									</Text>
								</Box>
							);
						})}
					</Box>
				))}
			</Box>
			<Text dimColor>
				{" "}
				{t("board.footer", { time: updatedAt?.toLocaleTimeString() ?? "…" })}
			</Text>
		</Box>
	);
}
