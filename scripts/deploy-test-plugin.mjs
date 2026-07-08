import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const pluginId = "obsidian-ai-copilot";
const requiredFiles = ["main.js", "manifest.json", "styles.css"];
const rootDir = process.cwd();

async function readLocalEnv() {
  const envPath = path.join(rootDir, ".env.local");

  try {
    const content = await readFile(envPath, "utf8");
    const entries = new Map();

    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const separatorIndex = trimmed.indexOf("=");

      if (separatorIndex === -1) {
        continue;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim();

      if (key) {
        entries.set(key, value);
      }
    }

    return entries;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return new Map();
    }

    throw error;
  }
}

const localEnv = await readLocalEnv();
const pluginsDir = process.argv[2] ?? process.env.OBSIDIAN_PLUGINS_DIR ?? localEnv.get("OBSIDIAN_PLUGINS_DIR");

if (!pluginsDir) {
  console.error(
    [
      "Missing Obsidian plugins directory.",
      "",
      "Set OBSIDIAN_PLUGINS_DIR or pass the directory as the first argument:",
      "  npm run deploy:test -- <vault>/.obsidian/plugins",
    ].join("\n"),
  );
  process.exit(1);
}

const targetDir = path.join(pluginsDir, pluginId);

await mkdir(targetDir, { recursive: true });

for (const fileName of requiredFiles) {
  await copyFile(path.join(rootDir, fileName), path.join(targetDir, fileName));
}

console.log(`Deployed ${pluginId} to ${targetDir}`);
