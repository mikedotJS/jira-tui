import { Select, TextInput } from "@inkjs/ui";
import Fuse from "fuse.js";
import { Box, Text } from "ink";
import { useMemo, useState } from "react";
import { t } from "../i18n.js";

export type Project = { key: string; name: string };

export function Projects({
	projects,
	title = t("projects.chooseProject"),
	onSelect,
}: {
	projects: Project[];
	title?: string;
	onSelect: (project: Project) => void;
}) {
	const [query, setQuery] = useState("");
	const fuse = useMemo(
		() => new Fuse(projects, { keys: ["key", "name"], threshold: 0.4 }),
		[projects],
	);
	const shown = query ? fuse.search(query).map((r) => r.item) : projects;

	return (
		<Box flexDirection="column" flexGrow={1} paddingX={1}>
			<Text bold>{title}</Text>
			<Box>
				<Text>{t("projects.filter")}</Text>
				<TextInput
					placeholder={t("projects.placeholder")}
					onChange={setQuery}
				/>
			</Box>
			{shown.length === 0 ? (
				<Text dimColor>{t("projects.none")}</Text>
			) : (
				<Select
					key={query}
					visibleOptionCount={10}
					options={shown.map((p) => ({
						label: `${p.key}  ${p.name}`,
						value: p.key,
					}))}
					onChange={(key) => {
						const project = shown.find((p) => p.key === key);
						if (project) onSelect(project);
					}}
				/>
			)}
		</Box>
	);
}
