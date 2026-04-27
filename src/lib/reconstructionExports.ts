import { jsPDF } from "jspdf";
import type { ParsedReconstruction, ReconDecision } from "./parseReconstruction";

// ---------- shared helpers ----------

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function safeSlug(s: string, fallback = "reconstruction"): string {
  const slug = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || fallback;
}

function fileBase(query: string, topic: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `reconstruction-${safeSlug(topic || query, "result")}-${stamp}`;
}

// ---------- Markdown ----------

function decisionToMd(d: ReconDecision): string {
  const out: string[] = [];
  out.push(`### Decision ${d.index}${d.decision ? ` — ${d.decision}` : ""}`, "");
  if (d.when) out.push(`- **When:** ${d.when}`);
  if (d.authority) out.push(`- **Authority:** ${d.authority}`);
  if (d.triggeringIssue) out.push(`- **Triggering issue:** ${d.triggeringIssue}`);
  if (d.decisionQuestion) out.push(`- **Decision question:** ${d.decisionQuestion}`);
  out.push(
    `- **Question resolution:** ${d.resolution}${d.resolutionGloss ? ` — ${d.resolutionGloss}` : ""}`,
  );
  if (d.observedReasoning) out.push(`- **Observed reasoning:** ${d.observedReasoning}`);
  if (d.inferredReasoning) out.push(`- **Inferred reasoning:** ${d.inferredReasoning}`);
  if (d.shapingConstraints) out.push(`- **Shaping constraints:** ${d.shapingConstraints}`);
  if (d.constraintsProduced) out.push(`- **Constraints produced:** ${d.constraintsProduced}`);
  if (d.outcomeSignals) out.push(`- **Outcome signals:** ${d.outcomeSignals}`);
  if (d.missingDetails) out.push(`- **Missing operational details:** ${d.missingDetails}`);
  if (d.extractionConfidence) out.push(`- **Extraction confidence:** ${d.extractionConfidence}`);
  out.push("");
  return out.join("\n");
}

export function reconstructionToMarkdown(query: string, r: ParsedReconstruction): string {
  const out: string[] = [];
  out.push(`# Reconstruction — ${r.topic || "untitled"}`, "");
  out.push(`**Query:** ${query}  `);
  if (r.counts.inScope) out.push(`**Artifacts in scope:** ${r.counts.inScope}  `);
  if (r.counts.byClass) out.push(`**By class:** ${r.counts.byClass}  `);
  if (r.counts.noise) out.push(`**Filtered as noise:** ${r.counts.noise}  `);
  if (r.counts.excluded) out.push(`**Excluded as off-topic:** ${r.counts.excluded}  `);
  out.push("");

  // Verdict
  out.push("## Verdict", "");
  const cs = r.currentState;
  if (cs.latestDecision) out.push(`- **Latest decision:** ${cs.latestDecision}`);
  out.push(`- **Formally reversed or replaced:** ${cs.status.reversed || "—"}`);
  out.push(`- **Still operationally in force:** ${cs.status.inForce || "—"}`);
  out.push(`- **Outcome:** ${cs.status.outcome || "—"}`);
  out.push(`- **Subsequent decision on same question:** ${cs.status.subsequent || "—"}`);
  out.push(`- **Reconstruction confidence:** ${r.confidence.level || "—"}`);
  if (r.confidence.primaryDriver) out.push(`- **Primary driver:** ${r.confidence.primaryDriver}`);
  out.push("");

  // Timeline
  out.push("## Timeline", "");
  if (r.decisions.length === 0) {
    out.push("_No decisions reconstructed._", "");
  } else {
    for (const d of r.decisions) out.push(decisionToMd(d));
  }
  if (r.nonDecisionEvents.length) {
    out.push("### Non-decision events", "");
    for (const e of r.nonDecisionEvents) out.push(`- ${e.text}`);
    out.push("");
  }

  // What's open
  out.push("## What's still open", "");
  const blocks: [string, string[]][] = [
    ["Questions still open", cs.questionsOpen],
    ["Recurring decision questions", cs.recurring],
    ["Authority-boundary status", cs.authorityBoundary],
    ["Outcome signals degrading or unresolved", cs.outcomesDegrading],
    ["Conflicts across artifacts", cs.conflicts],
    ["Missing from artifact set", cs.missing],
  ];
  for (const [label, items] of blocks) {
    out.push(`### ${label}`, "");
    if (items.length === 0) out.push("- none");
    else for (const item of items) out.push(`- ${item}`);
    out.push("");
  }

  // Narrative
  if (r.narrative) {
    out.push("## Narrative", "", r.narrative.trim(), "");
  }

  out.push("---", "", "## Raw engine output", "", "```", r.raw.trim(), "```", "");
  return out.join("\n");
}

export function downloadReconstructionMarkdown(query: string, r: ParsedReconstruction) {
  const md = reconstructionToMarkdown(query, r);
  downloadBlob(new Blob([md], { type: "text/markdown" }), `${fileBase(query, r.topic)}.md`);
}

// ---------- JSON ----------

export function reconstructionToJson(query: string, r: ParsedReconstruction): string {
  const payload = {
    query,
    topic: r.topic,
    counts: r.counts,
    verdict: {
      latest_decision: r.currentState.latestDecision,
      status: r.currentState.status,
      confidence: r.confidence,
    },
    decisions: r.decisions.map((d) => ({
      index: d.index,
      decision: d.decision,
      when: d.when,
      authority: d.authority,
      triggering_issue: d.triggeringIssue,
      decision_question: d.decisionQuestion,
      resolution: d.resolution,
      resolution_gloss: d.resolutionGloss,
      observed_reasoning: d.observedReasoning,
      inferred_reasoning: d.inferredReasoning,
      shaping_constraints: d.shapingConstraints,
      constraints_produced: d.constraintsProduced,
      outcome_signals: d.outcomeSignals,
      missing_operational_details: d.missingDetails,
      extraction_confidence: d.extractionConfidence,
    })),
    non_decision_events: r.nonDecisionEvents.map((e) => e.text),
    open: {
      questions_open: r.currentState.questionsOpen,
      recurring: r.currentState.recurring,
      authority_boundary: r.currentState.authorityBoundary,
      outcomes_degrading: r.currentState.outcomesDegrading,
      conflicts: r.currentState.conflicts,
      missing_from_artifact_set: r.currentState.missing,
    },
    narrative: r.narrative,
    raw_engine_output: r.raw,
    generated_at: new Date().toISOString(),
  };
  return JSON.stringify(payload, null, 2);
}

export function downloadReconstructionJson(query: string, r: ParsedReconstruction) {
  downloadBlob(
    new Blob([reconstructionToJson(query, r)], { type: "application/json" }),
    `${fileBase(query, r.topic)}.json`,
  );
}

// ---------- PDF ----------

interface PdfCtx {
  doc: jsPDF;
  y: number;
  pageHeight: number;
  marginX: number;
  marginTop: number;
  marginBottom: number;
  contentWidth: number;
}

function newPdf(): PdfCtx {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 54;
  const marginTop = 64;
  const marginBottom = 54;
  return {
    doc,
    y: marginTop,
    pageHeight,
    marginX,
    marginTop,
    marginBottom,
    contentWidth: pageWidth - marginX * 2,
  };
}

function ensureSpace(ctx: PdfCtx, needed: number) {
  if (ctx.y + needed > ctx.pageHeight - ctx.marginBottom) {
    ctx.doc.addPage();
    ctx.y = ctx.marginTop;
  }
}

function writeText(
  ctx: PdfCtx,
  text: string,
  opts: {
    size?: number;
    style?: "normal" | "bold" | "italic";
    color?: [number, number, number];
    gap?: number;
  } = {},
) {
  if (!text) return;
  const size = opts.size ?? 10;
  const style = opts.style ?? "normal";
  const color = opts.color ?? [30, 30, 30];
  const gap = opts.gap ?? 4;
  ctx.doc.setFont("helvetica", style);
  ctx.doc.setFontSize(size);
  ctx.doc.setTextColor(color[0], color[1], color[2]);
  const lines = ctx.doc.splitTextToSize(text, ctx.contentWidth);
  const lineHeight = size * 1.35;
  for (const line of lines) {
    ensureSpace(ctx, lineHeight);
    ctx.doc.text(line, ctx.marginX, ctx.y);
    ctx.y += lineHeight;
  }
  ctx.y += gap;
}

function writeLabelValue(ctx: PdfCtx, label: string, value?: string) {
  if (!value || !value.trim() || value.trim().toLowerCase() === "none") return;
  writeText(ctx, label.toUpperCase(), {
    size: 7.5,
    style: "bold",
    color: [110, 110, 120],
    gap: 1,
  });
  writeText(ctx, value.trim(), { size: 9.5, color: [40, 40, 45], gap: 8 });
}

function writeDivider(ctx: PdfCtx) {
  ensureSpace(ctx, 14);
  ctx.doc.setDrawColor(210, 210, 215);
  ctx.doc.setLineWidth(0.5);
  ctx.doc.line(ctx.marginX, ctx.y, ctx.marginX + ctx.contentWidth, ctx.y);
  ctx.y += 12;
}

function writeSectionHeader(ctx: PdfCtx, label: string) {
  writeText(ctx, label.toUpperCase(), {
    size: 9,
    style: "bold",
    color: [90, 90, 100],
    gap: 6,
  });
}

function writeBulletList(ctx: PdfCtx, items: string[]) {
  if (items.length === 0) {
    writeText(ctx, "none", { size: 9.5, color: [140, 140, 150], style: "italic", gap: 8 });
    return;
  }
  for (const item of items) {
    writeText(ctx, `•  ${item}`, { size: 9.5, color: [40, 40, 45], gap: 4 });
  }
  ctx.y += 4;
}

export function downloadReconstructionPdf(query: string, r: ParsedReconstruction) {
  const ctx = newPdf();

  // Header
  writeText(ctx, "RECONSTRUCTION", {
    size: 8,
    style: "bold",
    color: [90, 90, 100],
    gap: 2,
  });
  writeText(ctx, r.topic || "Untitled topic", { size: 18, style: "bold", gap: 4 });
  writeText(ctx, `Query: "${query}"`, { size: 10, style: "italic", color: [90, 90, 100], gap: 10 });

  if (r.counts.inScope) writeLabelValue(ctx, "Artifacts in scope", r.counts.inScope);
  if (r.counts.byClass) writeLabelValue(ctx, "By class", r.counts.byClass);
  if (r.counts.noise) writeLabelValue(ctx, "Filtered as noise", r.counts.noise);
  if (r.counts.excluded) writeLabelValue(ctx, "Excluded as off-topic", r.counts.excluded);

  // Verdict
  writeDivider(ctx);
  writeSectionHeader(ctx, "Verdict");
  const cs = r.currentState;
  writeLabelValue(ctx, "Latest decision", cs.latestDecision);
  writeLabelValue(ctx, "Formally reversed or replaced", cs.status.reversed);
  writeLabelValue(ctx, "Still operationally in force", cs.status.inForce);
  writeLabelValue(ctx, "Outcome", cs.status.outcome);
  writeLabelValue(ctx, "Subsequent decision on same question", cs.status.subsequent);
  writeLabelValue(ctx, "Reconstruction confidence", r.confidence.level);
  writeLabelValue(ctx, "Primary driver", r.confidence.primaryDriver);

  // Timeline
  writeDivider(ctx);
  writeSectionHeader(ctx, "Timeline");
  if (r.decisions.length === 0) {
    writeText(ctx, "No decisions reconstructed.", {
      size: 9.5,
      style: "italic",
      color: [140, 140, 150],
      gap: 8,
    });
  } else {
    for (const d of r.decisions) {
      writeText(
        ctx,
        `Decision ${d.index}  ·  ${d.resolution}${d.when ? `  ·  ${d.when}` : ""}`,
        { size: 8, style: "bold", color: [90, 90, 100], gap: 3 },
      );
      if (d.decision) writeText(ctx, d.decision, { size: 11, style: "bold", gap: 6 });
      writeLabelValue(ctx, "Authority", d.authority);
      writeLabelValue(ctx, "Triggering issue", d.triggeringIssue);
      writeLabelValue(ctx, "Decision question", d.decisionQuestion);
      writeLabelValue(ctx, "Observed reasoning", d.observedReasoning);
      writeLabelValue(ctx, "Inferred reasoning", d.inferredReasoning);
      writeLabelValue(ctx, "Shaping constraints", d.shapingConstraints);
      writeLabelValue(ctx, "Constraints produced", d.constraintsProduced);
      writeLabelValue(ctx, "Outcome signals", d.outcomeSignals);
      writeLabelValue(ctx, "Missing operational details", d.missingDetails);
      writeLabelValue(ctx, "Extraction confidence", d.extractionConfidence);
      ctx.y += 6;
    }
  }
  if (r.nonDecisionEvents.length) {
    writeText(ctx, "NON-DECISION EVENTS", {
      size: 8,
      style: "bold",
      color: [90, 90, 100],
      gap: 4,
    });
    writeBulletList(
      ctx,
      r.nonDecisionEvents.map((e) => e.text),
    );
  }

  // What's open
  writeDivider(ctx);
  writeSectionHeader(ctx, "What's still open");
  const blocks: [string, string[]][] = [
    ["Questions still open", cs.questionsOpen],
    ["Recurring decision questions", cs.recurring],
    ["Authority-boundary status", cs.authorityBoundary],
    ["Outcome signals degrading or unresolved", cs.outcomesDegrading],
    ["Conflicts across artifacts", cs.conflicts],
    ["Missing from artifact set", cs.missing],
  ];
  for (const [label, items] of blocks) {
    writeText(ctx, label.toUpperCase(), {
      size: 7.5,
      style: "bold",
      color: [110, 110, 120],
      gap: 3,
    });
    writeBulletList(ctx, items);
  }

  // Narrative
  if (r.narrative) {
    writeDivider(ctx);
    writeSectionHeader(ctx, "Narrative");
    writeText(ctx, r.narrative.trim(), { size: 10, color: [40, 40, 45], gap: 8 });
  }

  ctx.doc.save(`${fileBase(query, r.topic)}.pdf`);
}
