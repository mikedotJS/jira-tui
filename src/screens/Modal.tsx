import { Box, useWindowSize } from "ink";
import type { ReactNode } from "react";
import { useAccent, useBackground } from "../theme.js";

// Une ligne de moins que le terminal : Ink efface tout l'écran à chaque affichage quand il est rempli.
export const useScreenRows = () => useWindowSize().rows - 1;

const MAX_WIDTH = 80;

// Fenêtre flottante : centrée sur tout l'écran, au-dessus de l'écran en cours qui ne bouge pas.
export function Modal({ children }: { children: ReactNode }) {
	const { columns } = useWindowSize();
	const rows = useScreenRows();
	return (
		<Box
			position="absolute"
			top={0}
			left={0}
			width={columns}
			height={rows}
			alignItems="center"
			justifyContent="center"
		>
			<Box
				flexDirection="column"
				width={Math.min(MAX_WIDTH, columns)}
				maxHeight={rows}
				overflow="hidden"
				borderStyle="round"
				borderColor={useAccent()}
				backgroundColor={useBackground()}
				paddingX={1}
			>
				{children}
			</Box>
		</Box>
	);
}

// Hauteur laissée aux lignes de la fenêtre : le terminal moins bordures, saisie et pied de page.
export const useModalRows = (reserved: number) =>
	Math.max(1, useScreenRows() - 2 - reserved);
