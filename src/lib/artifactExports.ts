import { jsPDF } from "jspdf";
import type { ParsedArtifact, ParsedDecision } from "./parseArtifacts";

// ---------- Markdown ----------

function decisionToMarkdown(d: ParsedDecision): string {
  const lines: string[] = [`### Decision ${d.index}`, ""];
  for (const [k, v] of Object.entries(d.fields)) {
    if (!v) continue;
    lines.push(`- **${k}**: ${v.replace(/\n/g, "\n  ")}`);
  }
  return lines.join("\n");
}

export function artifactToMarkdown(a: ParsedArtifact): string {
  const out: string[] = [];
  out.push(`# Artifact ${a.artifactId || a.inputId}`, "");
  out.push(`**Class:** ${a.artifactClass}  `);
  if (a.sourceType) out.push(`**Source type:** ${a.sourceType}  `);
  if (a.date) out.push(`**Date:** ${a.date}  `);
  if (a.participants) out.push(`**Participants:** ${a.participants}  `);
  if (a.topicTags.length) out.push(`**Topics:** ${a.topicTags.join(", ")}  `);
  if (a.triggeringIssue) out.push(`**Triggering issue:** ${a.triggeringIssue}  `);
  if (a.decisionStatus) out.push(`**Decision status:** ${a.decisionStatus}  `);
  if (a.confidence) out.push(`**Confidence:** ${a.confidence}  `);
  out.push("");

  if (a.decisions.length) {
    out.push("## Decisions", "");
    for (const d of a.decisions) {
      out.push(decisionToMarkdown(d), "");
    }
  }

  const sectionOrder = [
    "Constraints",
    "Outcome signals",
    "References to prior decisions",
    "Rejected or unchosen options",
    "Uncertainty and unresolved questions",
    "Decision dynamics",
  ];
  for (const key of sectionOrder) {
    const body = a.sections[key];
    if (body && body.trim()) {
      out.push(`## ${key}`, "", body.trim(), "");
    }
  }

  return out.join("\n");
}

export function artifactsToMarkdown(arts: ParsedArtifact[]): string {
  return arts.map(artifactToMarkdown).join("\n\n---\n\n");
}

// ---------- Download helpers ----------

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadMarkdown(a: ParsedArtifact) {
  const md = artifactToMarkdown(a);
  downloadBlob(new Blob([md], { type: "text/markdown" }), `${a.artifactId || a.inputId}.md`);
}

export function downloadAllMarkdown(arts: ParsedArtifact[]) {
  const md = artifactsToMarkdown(arts);
  downloadBlob(new Blob([md], { type: "text/markdown" }), `decision-artifacts.md`);
}

export function downloadJson(a: ParsedArtifact) {
  const payload = {
    artifact_id: a.artifactId,
    source_input_id: a.inputId,
    artifact_class: a.artifactClass,
    source_type: a.sourceType,
    date: a.date,
    participants: a.participants,
    topic_tags: a.topicTags,
    triggering_issue: a.triggeringIssue,
    decision_status: a.decisionStatus,
    decisions: a.decisions.map((d) => ({ index: d.index, ...d.fields })),
    sections: a.sections,
    raw: a.rawText,
  };
  downloadBlob(
    new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
    `${a.artifactId || a.inputId}.json`,
  );
}

export function downloadAllJson(arts: ParsedArtifact[]) {
  const payload = arts.map((a) => ({
    artifact_id: a.artifactId,
    source_input_id: a.inputId,
    artifact_class: a.artifactClass,
    source_type: a.sourceType,
    date: a.date,
    participants: a.participants,
    topic_tags: a.topicTags,
    triggering_issue: a.triggeringIssue,
    decision_status: a.decisionStatus,
    decisions: a.decisions.map((d) => ({ index: d.index, ...d.fields })),
    sections: a.sections,
  }));
  downloadBlob(
    new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
    `decision-artifacts.json`,
  );
}

// ---------- PDF ----------

interface PdfContext {
  doc: jsPDF;
  y: number;
  pageHeight: number;
  marginX: number;
  marginTop: number;
  marginBottom: number;
  contentWidth: number;
}

function newPdf(): PdfContext {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 54; // 0.75"
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

function ensureSpace(ctx: PdfContext, needed: number) {
  if (ctx.y + needed > ctx.pageHeight - ctx.marginBottom) {
    ctx.doc.addPage();
    ctx.y = ctx.marginTop;
  }
}

function writeText(
  ctx: PdfContext,
  text: string,
  opts: { size?: number; style?: "normal" | "bold" | "italic"; color?: [number, number, number]; gap?: number } = {},
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

function writeLabelValue(ctx: PdfContext, label: string, value?: string) {
  if (!value || !value.trim() || value.trim().toLowerCase() === "none") return;
  writeText(ctx, label.toUpperCase(), { size: 7.5, style: "bold", color: [110, 110, 120], gap: 1 });
  writeText(ctx, value.trim(), { size: 9.5, color: [40, 40, 45], gap: 8 });
}

function writeDivider(ctx: PdfContext) {
  ensureSpace(ctx, 14);
  ctx.doc.setDrawColor(210, 210, 215);
  ctx.doc.setLineWidth(0.5);
  ctx.doc.line(ctx.marginX, ctx.y, ctx.marginX + ctx.contentWidth, ctx.y);
  ctx.y += 12;
}

function writeArtifactToPdf(ctx: PdfContext, a: ParsedArtifact, isFirst: boolean) {
  if (!isFirst) {
    ctx.doc.addPage();
    ctx.y = ctx.marginTop;
  }

  // Header
  writeText(ctx, `ARTIFACT · ${a.artifactClass.toUpperCase()}`, {
    size: 8,
    style: "bold",
    color: [90, 90, 100],
    gap: 2,
  });
  writeText(ctx, a.artifactId || a.inputId, { size: 16, style: "bold", gap: 10 });

  // Metadata grid
  writeLabelValue(ctx, "Source type", a.sourceType);
  writeLabelValue(ctx, "Date", a.date);
  writeLabelValue(ctx, "Participants", a.participants);
  if (a.topicTags.length) writeLabelValue(ctx, "Topic tags", a.topicTags.join(", "));
  writeLabelValue(ctx, "Triggering issue", a.triggeringIssue);
  writeLabelValue(ctx, "Decision status", a.decisionStatus);
  writeLabelValue(ctx, "Confidence", a.confidence);

  // Decisions
  if (a.decisions.length) {
    writeDivider(ctx);
    writeText(ctx, "DECISIONS", { size: 9, style: "bold", color: [90, 90, 100], gap: 6 });

    for (const d of a.decisions) {
      const decisionText = d.fields["decision"] || "";
      const resolution = d.fields["question resolution status"] || "";
      writeText(ctx, `Decision ${d.index}${resolution ? `  ·  ${resolution}` : ""}`, {
        size: 8,
        style: "bold",
        color: [90, 90, 100],
        gap: 3,
      });
      if (decisionText) writeText(ctx, decisionText, { size: 11, style: "bold", gap: 6 });

      const fieldOrder = [
        "what changed",
        "triggering issue",
        "decision question(s)",
        "decision questions",
        "why",
        "directly supported reasoning (observed)",
        "directly supported reasoning",
        "inferred reasoning (interpretation)",
        "inferred reasoning",
        "decision type",
        "decision strength",
        "decision completeness",
        "confidence in extraction",
        "confidence",
        "authority",
        "constraints produced",
      ];
      const seen = new Set<string>();
      for (const key of fieldOrder) {
        if (seen.has(key)) continue;
        seen.add(key);
        if (key === "decision") continue;
        writeLabelValue(ctx, key, d.fields[key]);
      }
      // Any leftover fields not in the order list
      for (const [k, v] of Object.entries(d.fields)) {
        if (k === "decision" || k === "question resolution status") continue;
        if (fieldOrder.includes(k)) continue;
        writeLabelValue(ctx, k, v);
      }
      ctx.y += 4;
    }
  }

  // Sections
  const sectionOrder = [
    "Constraints",
    "Outcome signals",
    "References to prior decisions",
    "Rejected or unchosen options",
    "Uncertainty and unresolved questions",
    "Decision dynamics",
  ];
  let dividerWritten = false;
  for (const key of sectionOrder) {
    const body = a.sections[key];
    if (!body || !body.trim()) continue;
    if (!dividerWritten) {
      writeDivider(ctx);
      dividerWritten = true;
    }
    writeText(ctx, key.toUpperCase(), { size: 9, style: "bold", color: [90, 90, 100], gap: 4 });
    writeText(ctx, body.trim(), { size: 9.5, color: [40, 40, 45], gap: 10 });
  }
}

export function downloadPdf(a: ParsedArtifact) {
  const ctx = newPdf();
  writeArtifactToPdf(ctx, a, true);
  ctx.doc.save(`${a.artifactId || a.inputId}.pdf`);
}

export function downloadAllPdf(arts: ParsedArtifact[]) {
  const ctx = newPdf();
  arts.forEach((a, i) => writeArtifactToPdf(ctx, a, i === 0));
  ctx.doc.save(`decision-artifacts.pdf`);
}
