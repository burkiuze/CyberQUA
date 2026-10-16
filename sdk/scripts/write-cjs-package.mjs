import { writeFileSync } from "node:fs";
// Marks dist/cjs as CommonJS since the package root is "type": "module".
writeFileSync(new URL("../dist/cjs/package.json", import.meta.url), JSON.stringify({ type: "commonjs" }) + "\n");
