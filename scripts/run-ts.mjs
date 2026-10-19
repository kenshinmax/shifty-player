// Runs a TypeScript script with the repo's "@/" alias. jiti comes from the Tailwind/Vite toolchain.
import { createJiti } from "jiti";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@/": root } });
await jiti.import(path.resolve(process.argv[2]));
