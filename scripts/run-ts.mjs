// Runs a TypeScript script with the repo's "@/" alias, via the jiti devDependency.
import { createJiti } from "jiti";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@/": root } });
await jiti.import(path.resolve(process.argv[2]));
