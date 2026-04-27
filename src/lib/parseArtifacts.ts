// Parses raw extractor text output into structured artifact records.
// The extractor returns markdown-style sections separated by `===`.

export interface ParsedDecision {
  index: number;
  raw: string;
  fields: Record<string, string>;
}

export interface ParsedArtifact {
  id: string;
  rawText: string;
  inputId: string;
  artifactId?: string;
  artifactClass: "decision" | "constraint" | "outcome" | "reference" | "noise" | "unknown";
  sourceType?: string;
  date?: string;
  participants?: string;
  topicTags: string[];
  triggeringIssue?: string;
  decisionStatus?: string;
  decisions: ParsedDecision[];
  decisionCount: number;
  confidence?: string;
  sections: Record<string, string>;
}

const KNOWN_SECTIONS = [
  "Source metadata",
  "Decision status",
  "Decisions",
  "Constraints",
  "Outcome signals",
  "References to prior decisions",
  "Rejected or unchosen options",
  "Uncertainty and unresolved questions",
  "Decision dynamics",
];

function splitArtifacts(raw: string): string[] {
  // Split on === separator (with surrounding whitespace)
  return raw
    .split(/^\s*===\s*$/m)
    .map((s) => s.trim())
    .filter(Boolean);
}

function extractSections(block: string): Record<string, string> {
  const sections: Record<string, string> = {};
  // Match `### Section Name` headers
  const regex = /^###\s+(.+?)\s*$/gm;
  const matches: Array<{ name: string; start: number; end: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(block)) !== null) {
    matches.push({ name: m[1].trim(), start: m.index, end: m.index + m[0].length });
  }
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].end;
    const end = i + 1 < matches.length ? matches[i + 1].start : block.length;
    sections[matches[i].name] = block.slice(start, end).trim();
  }
  return sections;
}

function parseMetadataLines(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*-\s*([^:]+):\s*(.*)$/);
    if (m) out[m[1].trim().toLowerCase()] = m[2].trim();
  }
  return out;
}

function parseDecisions(text: string): ParsedDecision[] {
  if (!text || /no real decision/i.test(text) || /^none$/i.test(text.trim())) return [];
  // Split on "Decision N" headers
  const parts = text.split(/^\s*Decision\s+(\d+)\s*$/m);
  const decisions: ParsedDecision[] = [];
  // parts: [pre, "1", body1, "2", body2, ...]
  for (let i = 1; i < parts.length; i += 2) {
    const idx = parseInt(parts[i], 10);
    const body = (parts[i + 1] || "").trim();
    decisions.push({
      index: idx,
      raw: body,
      fields: parseMetadataLines(body),
    });
  }
  // Fallback: single decision without explicit "Decision 1" header
  if (decisions.length === 0 && /^\s*-\s*Decision:/m.test(text)) {
    decisions.push({ index: 1, raw: text.trim(), fields: parseMetadataLines(text) });
  }
  return decisions;
}

export function parseArtifacts(rawOutput: string): ParsedArtifact[] {
  // Filter out any preamble chunks that aren't real artifact blocks.
  // When the model emits text before the first === separator it gets
  // treated as a block and produces an empty "unknown" artifact stub.
  const blocks = splitArtifacts(rawOutput).filter((b) =>
    /##\s*Artifact:/i.test(b),
  );
  const artifacts: ParsedArtifact[] = [];

  blocks.forEach((block, idx) => {
    const headerMatch = block.match(/##\s*Artifact:\s*(\S+)/);
    const inputId = headerMatch ? headerMatch[1] : `input_${idx + 1}`;
    const sections = extractSections(block);
    const meta = parseMetadataLines(sections["Source metadata"] || "");
    const decisionStatus = (sections["Decision status"] || "").trim();
    const decisions = parseDecisions(sections["Decisions"] || "");

    const tags = (meta["topic tags"] || "")
      .split(/[,\s]+/)
      .map((t) => t.replace(/^[`'"]|[`'"]$/g, "").trim())
      .filter((t) => t && t !== "none");

    const cls = (meta["artifact_class"] || "").toLowerCase();
    const artifactClass = (
      ["decision", "constraint", "outcome", "reference", "noise"].includes(cls) ? cls : "unknown"
    ) as ParsedArtifact["artifactClass"];

    // Confidence: take from first decision, or "—"
    const confidence =
      decisions[0]?.fields["confidence in extraction"] ||
      decisions[0]?.fields["confidence"] ||
      undefined;

    artifacts.push({
      id: `${inputId}-${idx}`,
      rawText: block,
      inputId,
      artifactId: meta["artifact_id"],
      artifactClass,
      sourceType: meta["source type"],
      date: meta["date or time window"],
      participants: meta["participants"],
      topicTags: tags,
      triggeringIssue: meta["triggering issue"],
      decisionStatus,
      decisions,
      decisionCount: decisions.length,
      confidence,
      sections,
    });
  });

  return artifacts;
}
