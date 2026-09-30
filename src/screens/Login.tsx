import { PasswordInput, TextInput } from "@inkjs/ui";
import { Box, Text } from "ink";
import { useState } from "react";
import { t } from "../i18n.js";

const FIELDS = [
	{
		key: "siteUrl",
		label: () => t("login.site"),
		placeholder: () => t("login.sitePlaceholder"),
	},
	{
		key: "email",
		label: () => t("login.email"),
		placeholder: () => t("login.emailPlaceholder"),
	},
	{ key: "token", label: () => t("login.token"), placeholder: () => "" },
] as const;

export type Credentials = Record<(typeof FIELDS)[number]["key"], string>;

export function Login({
	error,
	onSubmit,
}: {
	error?: string;
	onSubmit: (credentials: Credentials) => void;
}) {
	const [step, setStep] = useState(0);
	const [values, setValues] = useState<Partial<Credentials>>({});
	const field = FIELDS[step];

	const submit = (value: string) => {
		if (!value.trim()) return;
		const next = { ...values, [field.key]: value.trim() };
		setValues(next);
		if (step < FIELDS.length - 1) setStep(step + 1);
		else {
			setStep(0);
			onSubmit(next as Credentials);
		}
	};

	return (
		<Box flexDirection="column" flexGrow={1} paddingX={1}>
			<Text bold>{t("login.title")}</Text>
			<Text dimColor>{t("login.tokenHint")}</Text>
			{error && <Text color="red">{error}</Text>}
			{FIELDS.slice(0, step).map((f) => (
				<Text key={f.key}>
					{t("login.field", { label: f.label() })}
					{f.key === "token" ? "••••••••" : values[f.key]}
				</Text>
			))}
			<Box>
				<Text>{t("login.field", { label: field.label() })}</Text>
				{field.key === "token" ? (
					<PasswordInput key={step} onSubmit={submit} />
				) : (
					<TextInput
						key={step}
						placeholder={field.placeholder()}
						onSubmit={submit}
					/>
				)}
			</Box>
		</Box>
	);
}
