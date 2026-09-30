import { Box, Text } from "ink";
import type { ReactNode } from "react";

// Écran de fond sous une fenêtre flottante, comme dans l'appli.
export const Behind = ({ children }: { children: ReactNode }) => (
	<Box flexDirection="column" minHeight={20}>
		<Text>Tableau de fond</Text>
		{children}
	</Box>
);
