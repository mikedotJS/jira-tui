import { createContext, useContext } from "react";

export type Theme = "dark" | "light";

// Le cyan se lit mal sur fond clair : le thème clair passe en bleu.
export const ACCENT: Record<Theme, string> = { dark: "cyan", light: "blue" };

export const ThemeContext = createContext<Theme>("dark");
export const useAccent = () => ACCENT[useContext(ThemeContext)];

// Fond opaque des fenêtres flottantes, pour ne rien laisser voir à travers.
export const BACKGROUND: Record<Theme, string> = {
	dark: "#1e1e1e",
	light: "#f5f5f5",
};
export const useBackground = () => BACKGROUND[useContext(ThemeContext)];
