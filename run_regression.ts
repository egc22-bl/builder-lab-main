/**
 * Regression runner for the decision extractor.
 *
 * Usage:
 *   bun run_regression.ts                                    # run all scenarios
 *   bun run_regression.ts --scenario samples               # one scenario
 *   bun run_regression.ts --url https://...                  # override endpoint
 *
 * Batching (for large inputs that exceed the output token limit):
 *   bun run_regression.ts --split-on "^\[20" --batch-size 8
 *
 *   --split-on PATTERN   Regex to detect the start of each new input segment.
 *                        The matching line is kept as the first line of that segment.
 *                        Common patterns:
 *                          "^\[20"   — lines starting with a year timestamp, e.g. [2026-…
 *                          "^---"    — explicit horizontal rules
 *                          "^==="    — triple-equals separators
 *   --batch-size N       How many segments to send per API call (default: 8).
 *                        Without --split-on, this flag is ignored.
 *
 * Env vars:
 *   EXTRACT_DECISIONS_URL   Edge function endpoint (default: deployed Supabase URL)
 *   EXTRACT_DECISIONS_AUTH  Bearer token — set to your VITE_SUPABASE_PUBLISHABLE_KEY value
 */

import { readdir, readFile, mkdir, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { join, basename } from "path";
import { parseArtifacts, type ParsedArtifact } from "./src/lib/parseArtifacts";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DEFAULT_URL =
  "https://echxjpwuyasgldyiemhh.supabase.co/functions/v1/extract-decisions";

function argAfter(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}

const EXTRACT_URL =
  argAfter("--url") ??
  process.env.EXTRACT_DECISIONS_URL ??
  DEFAULT_URL;

const AUTH_TOKEN = process.env.EXTRACT_DECISIONS_AUTH ?? "";

const targetScenario = argAfter("--scenario");
const SPLIT_PATTERN = argAfter("--split-on");
const BATCH_SIZE = Math.max(1, parseInt(argAfter("--batch-size") ?? "8", 10));

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TextBlock {
  type: "text";
  text: string;
  filename?: string;
}

interface SchemaFailure {
  artifactIndex: number;
  inputId: string;
  missingOrInvalid: string[];
}

interface DiagnosticResult {
  artifacts: ParsedArtifact[];
  rawText: string;
  rawResponseBody: string;
  stopReason: string;
  usage: { input_tokens: number; output_tokens: number } | null;
  maxTokensSent: number;
  inputBlockCount: number;
  schemaFailures: SchemaFailure[];
  duplicateInputIds: string[];
  missingInputIds: string[];
}

// ---------------------------------------------------------------------------
// Schema check
// ---------------------------------------------------------------------------

function checkSchema(artifact: ParsedArtifact, index: number): SchemaFailure | null {
  const bad: string[] = [];

  if (!artifact.artifactId || artifact.artifactId.trim() === "")
    bad.push("artifact_id (missing/empty)");

  if (!artifact.inputId || artifact.inputId.trim() === "")
    bad.push("source_input_id (missing/empty)");

  if (!artifact.artifactClass || artifact.artifactClass === "unknown")
    bad.push(`artifact_class (${artifact.artifactClass || "missing"})`);

  if (!artifact.decisionStatus || artifact.decisionStatus.trim() === "")
    bad.push("decision_status (missing/empty)");

  return bad.length > 0
    ? { artifactIndex: index, inputId: artifact.inputId || "(none)", missingOrInvalid: bad }
    : null;
}

// ---------------------------------------------------------------------------
// Splitting helpers
// ---------------------------------------------------------------------------

function splitOnPattern(text: string, pattern: string): string[] {
  const re = new RegExp(pattern, "m");
  const lines = text.split("\n");
  const segments: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (re.test(line) && current.length > 0) {
      const seg = current.join("\n").trim();
      if (seg) segments.push(seg);
      current = [line];
    } else {
      current.push(line);
    }
  }

  if (current.length > 0) {
    const seg = current.join("\n").trim();
    if (seg) segments.push(seg);
  }

  return segments.filter((s) => s.length > 0);
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ---------------------------------------------------------------------------
// Core: call the edge function with pre-built blocks
// ---------------------------------------------------------------------------

const MAX_TOKENS_SENT = 8192;

async function extractBlocks(blocks: TextBlock[]): Promise<DiagnosticResult> {
  const body = { blocks, metadata: {} };

  const res = await fetch(EXTRACT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const rawResponseBody = await res.text();

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${rawResponseBody}`);
  }

  let data: any;
  try {
    data = JSON.parse(rawResponseBody);
  } catch {
    throw new Error(`Non-JSON response: ${rawResponseBody.slice(0, 200)}`);
  }

  if (data?.error) throw new Error(String(data.error));

  const rawText: string = data?.text ?? "";
  const stopReason: string = data?.stop_reason ?? "(not returned)";
  const usage = data?.usage ?? null;

  const artifacts = parseArtifacts(rawText);

  const schemaFailures: SchemaFailure[] = [];
  for (let i = 0; i < artifacts.length; i++) {
    const f = checkSchema(artifacts[i], i);
    if (f) schemaFailures.push(f);
  }

  const sentIds = blocks.map((_, i) => `input_${i + 1}`);
  const returnedIds = artifacts.map((a) => a.inputId);
  const returnedSet = new Set(returnedIds);
  const missingInputIds = sentIds.filter((id) => !returnedSet.has(id));

  const seen = new Set<string>();
  const duplicateInputIds: string[] = [];
  for (const id of returnedIds) {
    if (seen.has(id)) duplicateInputIds.push(id);
    seen.add(id);
  }

  return {
    artifacts,
    rawText,
    rawResponseBody,
    stopReason,
    usage,
    maxTokensSent: MAX_TOKENS_SENT,
    inputBlockCount: blocks.length,
    schemaFailures,
    duplicateInputIds,
    missingInputIds,
  };
}

// Convenience wrapper for single-file, single-block call (no splitting)
async function extractFile(filePath: string): Promise<DiagnosticResult> {
  const text = await readFile(filePath, "utf-8");
  return extractBlocks([{ type: "text", text, filename: basename(filePath) }]);
}

// ---------------------------------------------------------------------------
// Batched extraction: split → chunk → call per batch → merge
// ---------------------------------------------------------------------------

interface BatchedResult {
  mergedArtifacts: ParsedArtifact[];
  batches: Array<{ label: string; result: DiagnosticResult }>;
  totalInputSegments: number;
}

async function extractFileBatched(
  filePath: string,
  splitPattern: string,
  batchSize: number,
): Promise<BatchedResult> {
  const text = await readFile(filePath, "utf-8");
  const segments = splitOnPattern(text, splitPattern);

  if (segments.length === 0) {
    throw new Error(
      `--split-on pattern "${splitPattern}" matched nothing in ${basename(filePath)}. ` +
        `File produced 0 segments.`,
    );
  }

  const batches = chunk(segments, batchSize);
  const results: Array<{ label: string; result: DiagnosticResult }> = [];

  // Global artifact counter for renumbering input IDs across batches
  let globalArtifactOffset = 0;

  for (let bi = 0; bi < batches.length; bi++) {
    const batchSegments = batches[bi];
    const startSeg = globalArtifactOffset + 1;
    const endSeg = globalArtifactOffset + batchSegments.length;
    const label = `batch ${bi + 1}/${batches.length}: segs ${startSeg}–${endSeg}`;

    const blocks: TextBlock[] = batchSegments.map((seg, si) => ({
      type: "text",
      text: seg,
      filename: `${basename(filePath)}_seg${globalArtifactOffset + si + 1}`,
    }));

    const result = await extractBlocks(blocks);

    // Renumber artifact inputIds so they are globally unique across batches
    for (const artifact of result.artifacts) {
      const localMatch = artifact.inputId?.match(/^input_(\d+)$/);
      if (localMatch) {
        const localIdx = parseInt(localMatch[1], 10);
        artifact.inputId = `input_${globalArtifactOffset + localIdx}`;
      }
    }

    globalArtifactOffset += batchSegments.length;
    results.push({ label, result });
  }

  const mergedArtifacts = results.flatMap((r) => r.result.artifacts);

  return {
    mergedArtifacts,
    batches: results,
    totalInputSegments: segments.length,
  };
}

// ---------------------------------------------------------------------------
// Reporting helpers
// ---------------------------------------------------------------------------

const COL = { scenario: 20, file: 32, cls: 14, status: 28, count: 9 };

function row(...cells: string[]): string {
  const [scenario, file, cls, status, count] = cells;
  return [
    scenario.padEnd(COL.scenario),
    file.padEnd(COL.file),
    cls.padEnd(COL.cls),
    status.padEnd(COL.status),
    count,
  ].join("  ");
}

function diagLine(label: string, value: string): string {
  return `  [diag] ${label.padEnd(22)} ${value}`;
}

function printDiagnostics(result: DiagnosticResult, sentCount: number): void {
  console.log(diagLine("stop_reason:", result.stopReason));
  console.log(diagLine("max_tokens sent:", String(result.maxTokensSent)));
  if (result.usage) {
    console.log(diagLine("input_tokens:", String(result.usage.input_tokens)));
    console.log(diagLine("output_tokens:", String(result.usage.output_tokens)));
    const pct = ((result.usage.output_tokens / result.maxTokensSent) * 100).toFixed(1);
    console.log(diagLine("output budget used:", `${pct}%`));
  } else {
    console.log(diagLine("usage:", "(not returned)"));
  }

  const artCount = result.artifacts.length;
  const countMatch =
    artCount === sentCount ? "✓" : `✗ MISMATCH (sent ${sentCount}, got ${artCount})`;
  console.log(diagLine("artifact count:", `${artCount}  ${countMatch}`));

  if (result.missingInputIds.length > 0)
    console.log(diagLine("missing input_ids:", result.missingInputIds.join(", ")));
  if (result.duplicateInputIds.length > 0)
    console.log(diagLine("duplicate input_ids:", result.duplicateInputIds.join(", ")));

  if (result.schemaFailures.length > 0) {
    for (const f of result.schemaFailures) {
      console.log(
        `  [schema] artifact[${f.artifactIndex}] (${f.inputId}): ${f.missingOrInvalid.join(", ")}`,
      );
    }
  } else {
    console.log(diagLine("schema check:", "all passed"));
  }
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function runScenario(scenario: string): Promise<void> {
  const inputDir = join("test_inputs", scenario);
  const outputDir = join("test_outputs", scenario);

  if (!existsSync(inputDir)) {
    console.error(`  [skip] no input dir: ${inputDir}`);
    return;
  }

  const files = (await readdir(inputDir)).filter((f) => !f.startsWith("."));

  if (files.length === 0) {
    console.log(row(scenario, "(empty)", "—", "—", "—"));
    return;
  }

  await mkdir(outputDir, { recursive: true });

  for (const file of files.sort()) {
    const inputPath = join(inputDir, file);
    const outputPath = join(outputDir, `${file}.json`);
    const rawPath = join(outputDir, `${file}.raw.txt`);

    console.log(`\n--- ${scenario}/${file} ---`);

    try {
      if (SPLIT_PATTERN) {
        // ---- Batched path ----
        const batched = await extractFileBatched(inputPath, SPLIT_PATTERN, BATCH_SIZE);

        console.log(
          diagLine(
            "split mode:",
            `pattern="${SPLIT_PATTERN}"  batch_size=${BATCH_SIZE}  total_segs=${batched.totalInputSegments}`,
          ),
        );

        let totalInputTokens = 0;
        let totalOutputTokens = 0;
        let worstStopReason = "end_turn";
        let totalSchemaFailures = 0;

        for (const { label, result } of batched.batches) {
          console.log(`\n  [batch] ${label}`);
          printDiagnostics(result, result.inputBlockCount);
          if (result.usage) {
            totalInputTokens += result.usage.input_tokens;
            totalOutputTokens += result.usage.output_tokens;
          }
          if (result.stopReason === "max_tokens") worstStopReason = "max_tokens";
          totalSchemaFailures += result.schemaFailures.length;
        }

        // Merged summary
        const merged = batched.mergedArtifacts;
        console.log(`\n  [merged] total artifacts: ${merged.length}`);
        console.log(`  [merged] total input_tokens: ${totalInputTokens}`);
        console.log(`  [merged] total output_tokens: ${totalOutputTokens}`);
        console.log(`  [merged] worst stop_reason: ${worstStopReason}`);
        console.log(`  [merged] schema failures: ${totalSchemaFailures}`);

        if (worstStopReason === "max_tokens") {
          console.log(
            `  [warn]  stop_reason=max_tokens in at least one batch — reduce --batch-size`,
          );
        }

        await writeFile(outputPath, JSON.stringify(merged, null, 2));
        // Write all raw responses concatenated
        const allRaw = batched.batches
          .map(({ label, result }) => `// ${label}\n${result.rawResponseBody}`)
          .join("\n\n");
        await writeFile(rawPath, allRaw);

        console.log("");
        if (merged.length === 0) {
          console.log(row(scenario, file, "(no artifacts)", "—", "0"));
        } else {
          for (const a of merged) {
            console.log(
              row(scenario, file, a.artifactClass, a.decisionStatus || "—", String(a.decisionCount)),
            );
          }
        }
      } else {
        // ---- Single-call path (original behavior) ----
        const result = await extractFile(inputPath);

        await writeFile(outputPath, JSON.stringify(result.artifacts, null, 2));
        await writeFile(rawPath, result.rawResponseBody);

        printDiagnostics(result, result.inputBlockCount);

        console.log("");
        if (result.artifacts.length === 0) {
          console.log(row(scenario, file, "(no artifacts)", "—", "0"));
        } else {
          for (const a of result.artifacts) {
            console.log(
              row(
                scenario,
                file,
                a.artifactClass,
                a.decisionStatus || "—",
                String(a.decisionCount),
              ),
            );
          }
        }
      }
    } catch (e: any) {
      console.log(diagLine("ERROR:", e.message.slice(0, 120)));
      console.log(row(scenario, file, "ERROR", e.message.slice(0, 40), "—"));
    }
  }
}

async function main(): Promise<void> {
  if (!AUTH_TOKEN) {
    console.warn(
      "Warning: EXTRACT_DECISIONS_AUTH is not set. Requests may be rejected.\n" +
        "  Set it to your VITE_SUPABASE_PUBLISHABLE_KEY value.\n",
    );
  }

  console.log(`Endpoint:   ${EXTRACT_URL}`);
  console.log(`max_tokens: ${MAX_TOKENS_SENT} (hardcoded in edge function)`);
  if (SPLIT_PATTERN) {
    console.log(`split-on:   "${SPLIT_PATTERN}"  batch-size: ${BATCH_SIZE}`);
  }
  console.log("");

  const header = row("SCENARIO", "FILE", "CLASS", "DECISION STATUS", "DECISIONS");
  const divider = "-".repeat(header.length);

  let scenarios: string[];
  if (targetScenario) {
    scenarios = [targetScenario];
  } else {
    if (!existsSync("test_inputs")) {
      console.error("test_inputs/ directory not found. Run from the project root.");
      process.exit(1);
    }
    scenarios = (await readdir("test_inputs")).filter((f) => !f.startsWith("."));
  }

  for (const scenario of scenarios.sort()) {
    await runScenario(scenario);
  }

  console.log(`\n${divider}`);
  console.log(header);
  console.log(divider);
  console.log("(summary table above — diagnostics per-file above that)\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
