import { access, readFile } from "node:fs/promises";

const requiredRootFiles = ["LICENSE", "README.md", "manifest.json", "versions.json"];
const requiredReleaseAssets = ["main.js", "manifest.json", "styles.css"];
const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/;

const [manifest, packageData, versions] = await Promise.all([
  readJson("manifest.json"),
  readJson("package.json"),
  readJson("versions.json"),
]);
const errors = [];

if (typeof manifest.id !== "string" || !manifest.id.trim()) {
  errors.push("manifest.json must define a non-empty id.");
} else if (manifest.id.toLowerCase().includes("obsidian")) {
  errors.push('manifest.json id must not contain "obsidian".');
}

if (!semverPattern.test(manifest.version)) {
  errors.push(`manifest.json version must be semantic versioning, received ${JSON.stringify(manifest.version)}.`);
}

if (packageData.version !== manifest.version) {
  errors.push(`package.json version ${packageData.version} does not match manifest.json ${manifest.version}.`);
}

if (versions[manifest.version] !== manifest.minAppVersion) {
  errors.push(`versions.json must map ${manifest.version} to minAppVersion ${manifest.minAppVersion}.`);
}

const expectedTag =
  process.argv[2] ?? (process.env.GITHUB_REF_TYPE === "tag" ? process.env.GITHUB_REF_NAME : undefined);
if (expectedTag && expectedTag !== manifest.version) {
  errors.push(`Release tag ${expectedTag} must exactly match manifest version ${manifest.version}.`);
}

await checkFiles([...new Set([...requiredRootFiles, ...requiredReleaseAssets])], errors);

if (errors.length > 0) {
  console.error(["Release check failed:", ...errors.map((error) => `- ${error}`)].join("\n"));
  process.exit(1);
}

console.log(`Release metadata and assets are ready for ${manifest.id} ${manifest.version}.`);

async function readJson(fileName) {
  try {
    return JSON.parse(await readFile(fileName, "utf8"));
  } catch (error) {
    throw new Error(`Could not read ${fileName}: ${error instanceof Error ? error.message : String(error)}`, {
      cause: error,
    });
  }
}

async function checkFiles(fileNames, errors) {
  await Promise.all(
    fileNames.map(async (fileName) => {
      try {
        await access(fileName);
      } catch {
        errors.push(`Required file is missing: ${fileName}.`);
      }
    }),
  );
}
