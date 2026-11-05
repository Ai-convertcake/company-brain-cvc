import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

const src = (path: string) =>
	fileURLToPath(new URL(`./src/${path}`, import.meta.url))

// Mirrors the path aliases in tsconfig.json; more specific prefixes come first.
export default defineConfig({
	resolve: {
		alias: [
			{ find: /^@\/lib\/brain\//, replacement: src("brain/") },
			{ find: /^@\/routes\/brain\//, replacement: src("routes/") },
			{ find: /^@\/config$/, replacement: src("config/index.ts") },
			{ find: /^@\/types$/, replacement: src("types.ts") },
			{ find: /^@\/lib\//, replacement: src("compat/lib/") },
			{ find: /^@\/services\//, replacement: src("compat/services/") },
			{ find: /^@\/routes\//, replacement: src("compat/routes/") },
			{ find: /^@repo\/db$/, replacement: src("db/index.ts") },
			{ find: /^@repo\/db\/schema$/, replacement: src("db/schema/index.ts") },
			{ find: /^@repo\/db\/schema\//, replacement: src("db/schema/") },
			{ find: /^@repo\/lib\//, replacement: src("compat/repo-lib/") },
			{ find: /^@repo\/validation\//, replacement: src("compat/validation/") },
		],
	},
})
