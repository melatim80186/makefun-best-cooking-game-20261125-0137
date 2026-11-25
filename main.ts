/**
 * DAPUR BARA — Wok Rush (make.fun entry program)
 *
 * Copies game/ and screenshots/ from this repository to the output
 * directory and writes /output/dossier.json with buildDossier from
 * vendor/makefun-game.ts (the kit's copy, unchanged).
 *
 * Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output.
 * Node.js 22.18 or later. Deterministic: two runs write the same bytes.
 */
import { buildDossier } from "./vendor/makefun-game.ts";
import { cp, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL(".", import.meta.url)));
const outputDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? "/output");

async function listFiles(dir: string, base: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(dir, entry.name);
    const rel = base ? base + "/" + entry.name : entry.name;
    if (entry.isDirectory()) {
      out.push(...(await listFiles(full, rel)));
    } else if (entry.isFile()) {
      out.push(rel);
    }
  }
  return out;
}

async function main(): Promise<void> {
  const gameDir = join(repoRoot, "game");
  const shotsDir = join(repoRoot, "screenshots");

  const gameStat = await stat(gameDir);
  if (!gameStat.isDirectory()) throw new Error("game/ is missing");
  const shotsStat = await stat(shotsDir);
  if (!shotsStat.isDirectory()) throw new Error("screenshots/ is missing");

  await mkdir(join(outputDir, "game"), { recursive: true });
  await mkdir(join(outputDir, "screenshots"), { recursive: true });

  // Copy game/ and screenshots/ verbatim, sorted for determinism.
  for (const rel of await listFiles(gameDir, "")) {
    await cp(join(gameDir, rel), join(outputDir, "game", rel));
  }
  for (const rel of await listFiles(shotsDir, "")) {
    await cp(join(shotsDir, rel), join(outputDir, "screenshots", rel));
  }

  const dossier = await buildDossier({
    gameDir: join(outputDir, "game"),
    screenshotsDir: join(outputDir, "screenshots"),
  });
  await writeFile(join(outputDir, "dossier.json"), dossier, "utf8");

  const gameFiles = await listFiles(join(outputDir, "game"), "");
  const shotFiles = await listFiles(join(outputDir, "screenshots"), "");
  console.log(
    `Dapur Bara staged: ${gameFiles.length} game files, ` +
      `${shotFiles.length} screenshots, dossier ${dossier.length} bytes -> ${outputDir}`,
  );
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.stack ?? err.message : String(err));
  process.exit(1);
});
