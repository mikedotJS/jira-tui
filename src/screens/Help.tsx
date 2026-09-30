import { Box, Text, useInput } from "ink";
import { t } from "../i18n.js";
import { Modal } from "./Modal.js";

const sections = (): [string, string[]][] => [
	[
		t("help.everywhere"),
		[t("help.everywhere1"), t("help.everywhere2"), t("help.everywhere3")],
	],
	[t("help.board"), [t("help.board1"), t("help.board2"), t("help.board3")]],
	[t("help.search"), [t("help.search1")]],
	[t("help.detail"), [t("help.detail1")]],
	[
		t("help.palette"),
		[
			t("help.palette1"),
			t("help.palette2"),
			t("help.palette3"),
			t("help.palette4"),
		],
	],
];

export function Help({ onClose }: { onClose: () => void }) {
	useInput((_input, key) => {
		if (key.escape || key.return) onClose();
	});
	return (
		<Modal>
			<Text bold>{t("help.title")}</Text>
			{sections().map(([title, lines]) => (
				<Box key={title} flexDirection="column" marginTop={1}>
					<Text bold underline>
						{title}
					</Text>
					{lines.map((l) => (
						<Text key={l}>{l}</Text>
					))}
				</Box>
			))}
			<Text dimColor>{t("help.close")}</Text>
		</Modal>
	);
}
