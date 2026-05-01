// Parses the Decision Reconstruction Engine's structured output into
// the five-layer UI model.
//
// Handles two field formats the model may produce:
//   - "- Field: value"   (plain bullet, original expected format)
//   - "**Field:** value"  (bold markdown, what the model actually outputs)

export type ResolutionStatus =
  | "resolved"
  | "partially resolved"
  | "sidestepped"
  | "deferred"
  | "unresolved"
  | "unknown";

export interface ReconDecision {
  index: number;
  /** Present for outputs from the new reconstruction prompt. */
  segment?: "decision" | "recovered" | "consequential";
  decision: string;
  when: string;
  authority: string;
  triggeringIssue: string;
  decisionQuestion: string;
  resolution: ResolutionStatus;
  resolutionGloss: string;
  observedReasoning: string;
  inferredReasoning: string;
  shapingConstraints: string;
  constraintsProduced: string;
  outcomeSignals: string;
  missingDetails: string;
  extractionConfidence: string;
  fields: Record<string, string>;
}

export interface ReconNonDecisionEvent {
  text: string;
}

export interface ReconCurrentState {
  latestDecision: string;
  status: {
    reversed: string;
    inForce: string;
    outcome: string;
    subsequent: string;
  };
  questionsOpen: string[];
  recurring: string[];
  authorityBoundary: string[];
  outcomesDegrading: string[];
  conflicts: string[];
  missing: string[];
}

export interface ParsedReconstruction {
  topic: string;
  counts: {
    inScope: string;
    byClass: string;
    noise: string;
    excluded: string;
  };
  decisions: ReconDecision[];
  nonDecisionEvents: ReconNonDecisionEvent[];
  currentState: ReconCurrentState;
  confidence: { level: string; primaryDriver: string };
  narrative: string;
  raw: string;
}

const RESOLUTION_KEYS: ResolutionStatus[] = [
  "resolved",
  "partially resolved",
  "sidestepped",
  "deferred",
  "unresolved",
];

function normResolution(s: string): { status: ResolutionStatus; gloss: string } {
  const lower = s.toLowerCase();
  let status: ResolutionStatus = "unknown";
  for (const k of RESOLUTION_KEYS) {
    if (lower.includes(k)) {
      status = k;
      break;
    }
  }
  const dashIdx = s.indexOf("—");
  const altDash = s.indexOf(" - ");
  let gloss = "";
  if (dashIdx >= 0) gloss = s.slice(dashIdx + 1).trim();
  else if (altDash >= 0) gloss = s.slice(altDash + 3).trim();
  return { status, gloss };
}

// Extract the body for a section header at any heading level.
function sliceSection(raw: string, header: RegExp): string {
  const m = raw.match(header);
  if (!m) return "";
  const start = m.index! + m[0].length;
  const rest = raw.slice(start);
  const stop = rest.search(/\n## /m);
  return (stop === -1 ? rest : rest.slice(0, stop)).trim();
}

/**
 * Strips bold markdown from a field key.
 * "**Decision**" → "decision"
 * "Decision" → "decision"
 */
function cleanKey(raw: string): string {
  return raw.replace(/\*\*/g, "").trim().toLowerCase();
}

/**
 * Parse key:value fields from a decision block.
 * Handles both "- Field: value" and "**Field:** value" formats.
 * Multi-line values (bullet lists under a field) are joined with newlines.
 */
function parseBulletFields(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  const lines = body.split("\n");
  let currentKey: string | null = null;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, "");

    // Match: optional "- ", optional "**", key text, optional "**", ":", value
    // Covers: "- Field: val", "**Field:** val", "- **Field:** val", "Field: val"
    const m = line.match(/^\s*(?:-\s*)?(?:\*{1,2})?([^*:\n]+?)(?:\*{1,2})?\s*:\s*(.*)$/);
    if (m) {
      const key = cleanKey(m[1]);
      // Ignore keys that are too long (likely a bullet item containing a colon, not a field)
      if (key.length > 60) {
        if (currentKey) {
          out[currentKey] = (out[currentKey] + "\n" + line.trim().replace(/\*\*/g, "")).trim();
        }
        continue;
      }
      currentKey = key;
      out[currentKey] = (m[2] || "").replace(/\*\*/g, "").trim();
    } else if (currentKey && line.trim()) {
      out[currentKey] = (out[currentKey] + "\n" + line.trim().replace(/\*\*/g, "")).trim();
    } else if (!line.trim()) {
      currentKey = null;
    }
  }
  return out;
}

function buildReconDecision(
  fields: Record<string, string>,
  index: number,
  segment: "decision" | "recovered" | "consequential",
): ReconDecision {
  const resolutionRaw =
    fields["question resolution"] ||
    fields["question resolution status"] ||
    "";
  const { status, gloss } = normResolution(resolutionRaw);
  let decisionHead = fields["decision"] || "";
  if (segment === "recovered") {
    decisionHead = fields["reconstructed decision"] || decisionHead;
  } else if (segment === "consequential") {
    decisionHead =
      fields["question on the table"] ||
      fields["why this is consequential"] ||
      fields["why no commitment was made (observed)"] ||
      "";
  }
  return {
    index,
    segment,
    decision: decisionHead,
    when: fields["when"] || "",
    authority: fields["authority"] || "",
    triggeringIssue: fields["triggering issue"] || "",
    decisionQuestion:
      segment === "consequential"
        ? [fields["options considered"], fields["decision question"]].filter(Boolean).join("\n") ||
          fields["decision question"] ||
          ""
        : fields["decision question"] || fields["decision question(s)"] || "",
    resolution: status,
    resolutionGloss: gloss,
    observedReasoning:
      segment === "consequential"
        ? [fields["why no commitment was made (observed)"], fields["why this is consequential"]]
            .filter(Boolean)
            .join("\n\n") || fields["observed reasoning"] || ""
        : fields["observed reasoning"] || "",
    inferredReasoning: fields["inferred reasoning"] || "",
    shapingConstraints: fields["shaping constraints"] || "",
    constraintsProduced: fields["constraints produced"] || "",
    outcomeSignals: fields["outcome signals"] || fields["outcome signals (if any)"] || "",
    missingDetails: fields["missing operational details"] || "",
    extractionConfidence: fields["extraction confidence"] || "",
    fields,
  };
}

/** Parses ### Decision N, ### Recovered decision event, and ### Consequential non-decision blocks. */
function parseTimelineDecisionBlocks(timelineBody: string): ReconDecision[] {
  const text = timelineBody.trim();
  if (!text) return [];
  if (/^\*\*No decisions reconstructed/i.test(text) || /^No decisions reconstructed/i.test(text)) {
    return [];
  }

  const matches = [...text.matchAll(/^###\s+(.+)$/gm)] as RegExpMatchArray[];
  const decisions: ReconDecision[] = [];
  let recoveredSeq = 0;
  let consequentialSeq = 0;

  for (let i = 0; i < matches.length; i++) {
    const title = matches[i][1].trim();
    const bodyStart = matches[i].index! + matches[i][0].length;
    const bodyEnd = i + 1 < matches.length ? matches[i + 1].index! : text.length;
    const body = text.slice(bodyStart, bodyEnd).trim();

    const decNum = title.match(/^Decision\s+(\d+)\s*$/i);
    if (decNum) {
      decisions.push(buildReconDecision(parseBulletFields(body), parseInt(decNum[1], 10), "decision"));
      continue;
    }
    if (
      /^Recovered decision event$/i.test(title) ||
      /^Reconstructed decision event from non-decision artifact$/i.test(title)
    ) {
      recoveredSeq += 1;
      decisions.push(buildReconDecision(parseBulletFields(body), 900 + recoveredSeq, "recovered"));
      continue;
    }
    if (/^Consequential non-decision$/i.test(title)) {
      consequentialSeq += 1;
      decisions.push(buildReconDecision(parseBulletFields(body), 2000 + consequentialSeq, "consequential"));
      continue;
    }
    if (/^Non-decision\s+context/i.test(title)) {
      break;
    }
  }
  if (decisions.length === 0 && text.length > 0) {
    const legacy = parseLegacyTimelineDecisions(text);
    if (legacy.length > 0) return legacy;
  }
  return decisions;
}

/** Legacy timeline: optional ### before Decision N; "Non-decision events" or "Non-decision context". */
function parseLegacyTimelineDecisions(timelineBody: string): ReconDecision[] {
  const re = /^(?:###\s+)?Decision\s+(\d+)\s*$/gm;
  const matches: { idx: number; start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(timelineBody)) !== null) {
    matches.push({ idx: parseInt(m[1], 10), start: m.index, end: m.index + m[0].length });
  }

  const nonDecRe = /^###\s+Non-decision\s+(?:context|events?[^\n]*)$/gim;
  let nonDecStart = -1;
  const ndm = nonDecRe.exec(timelineBody);
  if (ndm) nonDecStart = ndm.index;

  const decisions: ReconDecision[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].end;
    const nextStart = i + 1 < matches.length ? matches[i + 1].start : timelineBody.length;
    const limit = nonDecStart >= 0 && nonDecStart < nextStart ? nonDecStart : nextStart;
    const body = timelineBody.slice(start, limit).trim();
    decisions.push(buildReconDecision(parseBulletFields(body), matches[i].idx, "decision"));
  }
  return decisions;
}

function parseNonDecisionEvents(timelineBody: string): ReconNonDecisionEvent[] {
  const re = /^###\s+Non-decision\s+(?:context|events?[^\n]*)$/im;
  const m = timelineBody.match(re);
  if (!m) return [];
  const start = m.index! + m[0].length;
  const body = timelineBody.slice(start).trim();
  // Handle both "- item" and "**timestamp** — description" formats
  const items: string[] = [];
  for (const line of body.split("\n")) {
    const stripped = line.replace(/\*\*/g, "").trim();
    if (stripped.startsWith("- ")) {
      items.push(stripped.slice(2).trim());
    } else if (stripped.match(/^\d{4}-\d{2}-\d{2}/)) {
      items.push(stripped);
    }
  }
  return items.filter(Boolean).map((text) => ({ text }));
}

/**
 * Parse the Current State section into a label→items map.
 * Handles both "- Label:" and "**Label:**" section headers,
 * and correctly distinguishes headers from bullet items even when
 * items contain colons.
 *
 * A line is treated as a section header only if its label text
 * matches one of the known Current State labels.
 */
function parseCurrentStateDict(body: string): Map<string, string[]> {
  const KNOWN_LABELS = new Set([
    "latest decision on topic",
    "status",
    "status of latest decision",
    "open questions",
    "questions still open",
    "recurring questions",
    "recurring decision questions",
    "authority boundary situations",
    "authority-boundary status",
    "outcome signals unresolved",
    "outcome signals degrading or unresolved",
    "conflicts across artifacts",
    "missing artifacts",
    "missing from artifact set",
    "subsequent decisions",
    "outcome status",
    "formally reversed or replaced",
    "still operationally in force",
    "outcome",
    "subsequent decision recorded on same question",
  ]);

  const result = new Map<string, string[]>();
  const lines = body.split("\n");
  let currentLabel: string | null = null;
  let currentItems: string[] = [];

  function flush() {
    if (currentLabel !== null) {
      result.set(currentLabel, currentItems);
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, "");

    // Detect a section header in "**Label:**", "- Label:", or "### Label" format.
    // The model frequently uses h3 headers (### Label) for Current State sub-sections.
    const boldHeader = line.match(/^\s*\*\*([^*]+?):\*\*\s*(.*)$/);
    const bulletHeader = line.match(/^\s*-\s+([^:]{1,60}):\s*(.*)$/);
    const h3Header = line.match(/^###\s+(.+?)\s*$/);

    const header = boldHeader || bulletHeader;

    if (header) {
      const labelText = header[1].trim().toLowerCase();
      const inlineValue = (header[2] || "").replace(/\*\*/g, "").trim();

      if (KNOWN_LABELS.has(labelText)) {
        flush();
        currentLabel = labelText;
        currentItems = [];
        if (
          inlineValue &&
          inlineValue.toLowerCase() !== "none" &&
          inlineValue.toLowerCase() !== "none detected"
        ) {
          currentItems.push(inlineValue);
        }
        continue;
      }
    } else if (h3Header) {
      // h3 headers never have an inline value — content follows on subsequent lines.
      const labelText = h3Header[1].trim().toLowerCase();
      if (KNOWN_LABELS.has(labelText)) {
        flush();
        currentLabel = labelText;
        currentItems = [];
        continue;
      }
    }

    // Collect items under current label.
    // Accept both "- bullet" lines and plain text lines so that values placed
    // on the line(s) after a "### Label" header are captured correctly.
    if (currentLabel) {
      const itemMatch = line.match(/^\s*-\s+(.*)$/);
      const text = itemMatch
        ? itemMatch[1].replace(/\*\*/g, "").trim()
        : line.replace(/\*\*/g, "").trim();
      if (
        text &&
        text.toLowerCase() !== "none" &&
        text.toLowerCase() !== "none detected"
      ) {
        currentItems.push(text);
      }
    }
  }
  flush();

  return result;
}

function parseHeader(raw: string): ParsedReconstruction["counts"] & { topic: string } {
  // Try "Topic: value" (plain format)
  let topic = (raw.match(/^Topic:\s*(.+)$/im)?.[1] || "").trim();

  // Fall back to "# Decision Reconstruction: TOPIC" heading (model's actual format)
  if (!topic) {
    topic = (
      raw.match(/^#+\s+Decision Reconstruction[^:\n]*:?\s*(.+)$/im)?.[1] || ""
    ).trim();
  }

  // Fall back to "**Topic:** value" bold format
  if (!topic) {
    topic = (raw.match(/^\*\*Topic\*\*:\s*(.+)$/im)?.[1] || "").trim();
  }

  // Try inline format: "Artifacts in scope: value" or "**Artifacts in scope:** value"
  let inScope =
    (raw.match(/^Artifacts in scope:\s*(.+)$/im)?.[1] ||
      raw.match(/^\*\*Artifacts in scope\*\*:\s*(.+)$/im)?.[1] ||
      "").trim();
  let byClass = "";
  let noise =
    (raw.match(/^Artifacts filtered as noise:\s*(.+)$/im)?.[1] ||
      raw.match(/^\*\*Artifacts filtered as noise\*\*:\s*(.+)$/im)?.[1] ||
      "").trim();
  let excluded =
    (raw.match(/^Artifacts excluded[^:*]*:\s*(.+)$/im)?.[1] ||
      raw.match(/^\*\*Artifacts excluded[^*]*\*\*:\s*(.+)$/im)?.[1] ||
      "").trim();

  if (inScope) {
    // inline format: byClass may be embedded
    const byClassMatch = inScope.match(/by class:\s*(.+)$/i);
    byClass = byClassMatch ? byClassMatch[1].trim() : "";
    inScope = inScope.replace(/,?\s*by class:.*$/i, "").trim();
  } else {
    // Section format: "## Artifacts in scope\n9 artifacts total\n- Decisions: 2\n..."
    const scopeBody = sliceSection(raw, /^##\s+Artifacts in scope\s*$/im);
    if (scopeBody) {
      const totalMatch = scopeBody.match(/(\d+\s+artifacts?\s+total)/i);
      if (totalMatch) inScope = totalMatch[1];
      const byClassItems: string[] = [];
      for (const line of scopeBody.split("\n")) {
        const m = line.match(/^\s*-\s+(.+)/);
        if (m) byClassItems.push(m[1].trim());
      }
      byClass = byClassItems.join(", ");
    }
    // Section format excluded: "## Artifacts excluded\nNone" or list
    const excludedBody = sliceSection(raw, /^##\s+Artifacts excluded\s*$/im);
    if (excludedBody) {
      excluded = excludedBody.split("\n").map(l => l.trim()).filter(Boolean).join(" ");
    }
  }

  return { topic, inScope, byClass, noise, excluded };
}

function parseConfidence(raw: string): { level: string; primaryDriver: string } {
  const body = sliceSection(raw, /^##\s+Reconstruction confidence\s*$/im);

  // Plain bullet format: "- Confidence: high" / "- Primary driver: text"
  const plainLevel = (body.match(/^\s*-\s*Confidence:\s*(.+)$/im)?.[1] || "").trim();
  const plainDriver = (
    body.match(/^\s*-\s*Primary\s+(?:driver|reason):\s*(.+)$/im)?.[1] || ""
  ).trim();
  if (plainLevel) return { level: plainLevel, primaryDriver: plainDriver };

  // Bold level: "**Medium**" on its own line
  const boldLevel = (body.match(/\*\*(High|Medium|Low)\*\*/i)?.[1] || "").trim();

  // Bold driver: "**Primary reason:** text" (same line or next line)
  const boldDriverMatch = body.match(/\*\*Primary\s+(?:reason|driver)\*\*:?\s*(.+)/i);
  const boldDriverInline = boldDriverMatch
    ? boldDriverMatch[1].replace(/\*\*/g, "").trim().split("\n")[0]
    : "";
  // Multi-line bold: "**Primary reason:**\ntext on next line"
  const boldDriverMultiLine = !boldDriverInline
    ? (body.match(/\*\*Primary\s+(?:reason|driver)\*\*:?\s*\n+\s*([^\n]+)/i)?.[1] || "")
        .replace(/\*\*/g, "")
        .trim()
    : "";
  const boldDriver = boldDriverInline || boldDriverMultiLine;

  // Plain (non-bold) driver: "Primary reason: text" (same line or next line)
  const plainDriverSameLine =
    (body.match(/^Primary\s+(?:reason|driver):\s*(.+)/im)?.[1] || "").trim().split("\n")[0];
  const plainDriverNextLine = !plainDriverSameLine
    ? (body.match(/^Primary\s+(?:reason|driver):\s*\n+\s*([^\n]+)/im)?.[1] || "").trim()
    : "";
  const plainDriverFallback =
    boldDriver || plainDriverSameLine || plainDriverNextLine;

  return { level: boldLevel, primaryDriver: plainDriverFallback };
}

export function parseReconstruction(raw: string): ParsedReconstruction {
  const header = parseHeader(raw);

  const timelineBody = sliceSection(raw, /^##\s+Timeline\s*$/im);
  const decisions = parseTimelineDecisionBlocks(timelineBody);
  const nonDecisionEvents = parseNonDecisionEvents(timelineBody);

  const currentBody = sliceSection(raw, /^##\s+Current state\s*$/im);
  const dict = parseCurrentStateDict(currentBody);

  // Helper: look up a label trying multiple aliases
  function get(...keys: string[]): string[] {
    for (const k of keys) {
      const v = dict.get(k);
      if (v && v.length > 0) return v;
    }
    return [];
  }

  const latestDecision =
    get("latest decision on topic")[0] ||
    // plain-text fallback
    (currentBody.match(/^\s*-\s*Latest decision on topic:\s*(.+)$/im)?.[1] || "").trim();

  // Parse status sub-fields: try labeled headers first, then scan bullets under "status"
  const statusBullets = get("status", "status of latest decision");
  function findStatusBullet(patterns: RegExp[]): string {
    for (const bullet of statusBullets) {
      for (const p of patterns) {
        const m = bullet.match(p);
        if (m) return m[1] ? m[1].trim() : bullet.trim();
      }
    }
    return "";
  }

  const currentState: ReconCurrentState = {
    latestDecision,
    status: {
      reversed:
        get("formally reversed or replaced")[0] ||
        findStatusBullet([/replaced by (.+)/i, /reversed[:\s]+(.+)/i]),
      inForce:
        get("still operationally in force")[0] ||
        findStatusBullet([/still in force[:\s]+(.+)/i, /^(still in force.*)$/i]),
      outcome:
        get("outcome status", "outcome")[0] ||
        findStatusBullet([/outcome[:\s]+(.+)/i, /outcome status[:\s]+(.+)/i]),
      subsequent:
        get("subsequent decision recorded on same question", "subsequent decisions")[0] ||
        findStatusBullet([/subsequent[:\s]+(.+)/i]),
    },
    questionsOpen: get("open questions", "questions still open"),
    recurring: get("recurring questions", "recurring decision questions"),
    authorityBoundary: get("authority boundary situations", "authority-boundary status"),
    outcomesDegrading: get(
      "outcome signals unresolved",
      "outcome signals degrading or unresolved"
    ),
    conflicts: get("conflicts across artifacts"),
    missing: get("missing artifacts", "missing from artifact set"),
  };

  const confidence = parseConfidence(raw);
  const narrative = sliceSection(raw, /^##\s+Narrative\s*$/im);

  return {
    topic: header.topic,
    counts: {
      inScope: header.inScope,
      byClass: header.byClass,
      noise: header.noise,
      excluded: header.excluded,
    },
    decisions,
    nonDecisionEvents,
    currentState,
    confidence,
    narrative,
    raw,
  };
}
