import { defineConfig } from "@microsoft/tui-test";

// Un seul worker : les tests de recherche par défaut s'enchaînent sur la même config.
export default defineConfig({
	testMatch: "e2e/**/*.test.ts",
	retries: 0,
	workers: 1,
	timeout: 120_000,
	expect: { timeout: 30_000 },
});
