/**
 * Diff two regression output directories.
 * Prints only inputs where artifact_class or decision_status changed.
 *
 * Usage:
 *   bun diff_runs.ts test_outputs_baseline/ test_outputs_candidate/
 *
 * Each directory should have the structure produced by run_regression.ts:
 *   <dir>/<scenario>/<input_filename>.json
 */

import { readdir, readFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ArtifactSummary {
  artifactClass: string;
  decisionStatus: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function summarize(a: any): ArtifactSummary {
  return {
    artifactClass: a?.artifactClass ?? "unknown",
    decisionStatus: a?.decisionStatus ?? "—",
  };
}

async function readArtifacts(filePath: string): Promise<any[]> {
  const raw = await readFile(filePath, "utf-8");
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [parsed];
}

/** Returns all .json paths under dir as relative paths (e.g. "enablement/foo.txt.json") */
async function collectJsonFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const results: string[] = [];
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    if (e.isDirectory()) {
      const sub = await collectJsonFiles(join(dir, e.name));
      results.push(...sub.map((f) => join(e.name, f)));
    } else if (e.name.endsWith(".json")) {
      results.push(e.name);
    }
  }
  return results.sort();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const [, , baselineDir, candidateDir] = process.argv;

  if (!baselineDir || !candidateDir) {
    console.error(
      "Usage: bun diff_runs.ts <baseline_dir> <candidate_dir>\n" +
        "  e.g. bun diff_runs.ts test_outputs_baseline/ test_outputs_candidate/",
    );
    process.exit(1);
  }

  for (const [label, dir] of [
    ["Baseline", baselineDir],
    ["Candidate", candidateDir],
  ] as const) {
    if (!existsSync(dir)) {
      console.error(`${label} directory not found: ${dir}`);
      process.exit(1);
    }
  }

  console.log(`Baseline:  ${baselineDir}`);
  console.log(`Candidate: ${candidateDir}\n`);

  const baselineFiles = await collectJsonFiles(baselineDir);
  const candidateFiles = new Set(await collectJsonFiles(candidateDir));

  let changes = 0;

  for (const relPath of baselineFiles) {
    const bPath = join(baselineDir, relPath);
    const cPath = join(candidateDir, relPath);

    if (!existsSync(cPath)) {
      console.log(`MISSING    ${relPath}`);
      console.log(`  (present in baseline, not found in candidate)\n`);
      changes++;
      continue;
    }

    const baseArtifacts = await readArtifacts(bPath);
    const candArtifacts = await readArtifacts(cPath);
    const maxLen = Math.max(baseArtifacts.length, candArtifacts.length);

    for (let i = 0; i < maxLen; i++) {
      const base = baseArtifacts[i];
      const cand = candArtifacts[i];
      const label = maxLen === 1 ? relPath : `${relPath}[${i}]`;

      if (!base) {
        console.log(`NEW        ${label}`);
        console.log(`  candidate: class=${cand.artifactClass}  status=${cand.decisionStatus ?? "—"}\n`);
        changes++;
        continue;
      }

      if (!cand) {
        console.log(`DROPPED    ${label}`);
        console.log(`  baseline:  class=${base.artifactClass}  status=${base.decisionStatus ?? "—"}\n`);
        changes++;
        continue;
      }

      const bs = summarize(base);
      const cs = summarize(cand);

      if (bs.artifactClass !== cs.artifactClass || bs.decisionStatus !== cs.decisionStatus) {
        const classChanged = bs.artifactClass !== cs.artifactClass;
        const statusChanged = bs.decisionStatus !== cs.decisionStatus;
        const what = [classChanged && "class", statusChanged && "status"]
          .filter(Boolean)
          .join(" + ");

        console.log(`CHANGED    ${label}  (${what})`);
        console.log(
          `  baseline:  class=${bs.artifactClass.padEnd(12)}  status=${bs.decisionStatus}`,
        );
        console.log(
          `  candidate: class=${cs.artifactClass.padEnd(12)}  status=${cs.decisionStatus}\n`,
        );
        changes++;
      }
    }

    candidateFiles.delete(relPath);
  }

  // Files in candidate but not in baseline
  for (const relPath of candidateFiles) {
    console.log(`NEW FILE   ${relPath}`);
    console.log(`  (not present in baseline)\n`);
    changes++;
  }

  if (changes === 0) {
    console.log("No changes in artifact_class or decision_status.");
  } else {
    console.log(`${changes} change(s) found.`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
