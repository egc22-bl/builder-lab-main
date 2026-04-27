// Builder Lab — realistic mock data

export type Source = "Slack" | "Jira" | "Notion" | "Drive" | "Mail" | "Salesforce";

export type DecisionStatus = "FINAL" | "PARTIAL" | "DEFERRAL" | "CONSTRAINT";
export type DecisionType = "Constraint-driven" | "Temporary" | "Exploratory" | "Final";

export interface Artifact {
  id: string;
  source: Source;
  title: string;
  date: string;
  author: string;
  authorRole: string;
  contribution: "Strong signal" | "Supporting" | "Contradicting";
  excerpt: string;
  url?: string;
}

export interface Decision {
  id: string;
  statement: string;
  status: DecisionStatus;
  type: DecisionType;
  confidence: number;
  reasoning: string;
  supportedReasoning: string[];
  inferredReasoning: string[];
  artifactIds: string[];
}

export interface OpenItem {
  text: string;
  tag?: "Deferred" | "Sidestepped" | "Never addressed";
  rationale?: string;
}

export interface TimelineNode {
  date: string;
  kind: "spike" | "gate" | "patch" | "weak-signal" | "deferral";
  title: string;
  detail: string;
}

export interface Reconstruction {
  id: string;
  query: string;
  title: string;
  pattern: string;
  conclusion: string;
  confidence: number;
  drift?: { changed: number; when: string; reason: string };
  meta: {
    strength: "Strong" | "Moderate" | "Weak";
    completeness: "Complete" | "Partial" | "Sparse";
    alignment: "Aligned" | "Contested" | "Unclear";
    learning: "Captured" | "Partial" | "None detected";
  };
  decisions: Decision[];
  open: {
    questions: OpenItem[];
    rejected: OpenItem[];
    assumptions: OpenItem[];
  };
  timeline: TimelineNode[];
  patterns: { fact: string; interpretation: string }[];
  artifacts: Artifact[];
}

// ── Primary reconstruction ──────────────────────────────────────────────

export const fraudReconstruction: Reconstruction = {
  id: "fraud-q3",
  query: "Why did we change the checkout fraud rule in Q3?",
  title: "Checkout fraud rule change — Q3",
  pattern: "urgency → CFO gate → minor adjustment → weak outcome signal → no resolution",
  conclusion:
    "A spike in chargebacks the week of July 8 forced an emergency tightening of the checkout fraud threshold. A proposed rollback two weeks later was blocked at the CFO review gate on chargeback-exposure grounds. The team applied a narrower rule adjustment as a temporary patch. The underlying tradeoff between fraud capture and conversion loss was never formally resolved — the topic has not surfaced in 47 days.",
  confidence: 71,
  meta: {
    strength: "Moderate",
    completeness: "Partial",
    alignment: "Contested",
    learning: "None detected",
  },
  decisions: [
    {
      id: "d1",
      statement: "Tighten fraud-score threshold from 0.62 to 0.74 across all checkout flows",
      status: "FINAL",
      type: "Constraint-driven",
      confidence: 86,
      reasoning:
        "Chargeback rate breached the 1.2% contractual ceiling with the acquiring bank, triggering an immediate response.",
      supportedReasoning: [
        "Stripe radar dashboard (Jul 8) showed chargeback rate at 1.41%, above the 1.2% ceiling.",
        "Maya Chen (Risk Lead) recommended the 0.74 threshold in #checkout-incident at 14:22 UTC.",
        "Threshold was deployed Jul 9 09:00 UTC per Jira CHK-2841.",
      ],
      inferredReasoning: [
        "Speed of decision suggests the team had pre-existing alignment that 0.74 was the safe ceiling, though no prior doc references this number.",
      ],
      artifactIds: ["a1", "a2"],
    },
    {
      id: "d2",
      statement: "Block proposed rollback to 0.65 pending CFO review",
      status: "CONSTRAINT",
      type: "Constraint-driven",
      confidence: 78,
      reasoning:
        "Conversion dropped 4.1% in the two weeks following the change. A rollback was proposed but gated on chargeback-exposure grounds.",
      supportedReasoning: [
        "Diego Park (Growth PM) proposed rollback in product review Jul 22.",
        "Helena Voss (CFO) replied in #finance-leads: 'Not until we see two clean weeks under the current ceiling.'",
      ],
      inferredReasoning: [
        "The CFO position appears to be precautionary rather than data-driven — no specific exposure model was shared.",
        "The product team likely deprioritized further escalation given Q3 close was approaching.",
      ],
      artifactIds: ["a3"],
    },
    {
      id: "d3",
      statement: "Apply narrower rule: exempt returning customers with 6+ months tenure from tightened threshold",
      status: "PARTIAL",
      type: "Temporary",
      confidence: 64,
      reasoning:
        "Compromise patch shipped Aug 5 to recover some conversion loss without changing the headline threshold.",
      supportedReasoning: [
        "PR #4418 'returning-customer fraud exemption' merged Aug 5.",
        "Notion doc 'Fraud rule v2 — interim' authored by Diego Park, last edited Aug 4.",
      ],
      inferredReasoning: [
        "The exemption appears framed as temporary, but no sunset date or success criteria are recorded anywhere in the artifact set.",
      ],
      artifactIds: ["a4"],
    },
  ],
  open: {
    questions: [
      {
        text: "What is the acceptable steady-state tradeoff between chargeback rate and checkout conversion?",
        tag: "Never addressed",
      },
      {
        text: "Should the returning-customer exemption be made permanent or rolled back?",
        tag: "Deferred",
      },
      {
        text: "Is the 1.2% chargeback ceiling renegotiable with the acquiring bank?",
        tag: "Sidestepped",
      },
    ],
    rejected: [
      {
        text: "Full rollback to pre-incident threshold (0.62)",
        rationale: "Blocked at CFO gate; never re-raised.",
      },
      {
        text: "Geo-based rule (tighten only for high-risk regions)",
        rationale: "Mentioned once by Maya Chen Jul 11; no follow-up artifacts.",
      },
    ],
    assumptions: [
      { text: "0.74 threshold is the correct ceiling for sustained operation." },
      { text: "Conversion loss attributed to fraud rule, not to concurrent checkout copy A/B test." },
      { text: "Returning-customer cohort carries materially lower fraud risk." },
    ],
  },
  timeline: [
    {
      date: "Jul 8",
      kind: "spike",
      title: "Chargeback rate breaches contractual ceiling",
      detail: "Stripe radar reports 1.41% — above the 1.2% acquirer threshold.",
    },
    {
      date: "Jul 9",
      kind: "patch",
      title: "Emergency threshold tightened to 0.74",
      detail: "Deployed within 19 hours of spike. No design review.",
    },
    {
      date: "Jul 22",
      kind: "gate",
      title: "CFO blocks proposed rollback",
      detail: "Helena Voss requires 'two clean weeks' before any reduction.",
    },
    {
      date: "Aug 5",
      kind: "patch",
      title: "Returning-customer exemption shipped",
      detail: "Compromise patch — recovers ~1.6% of lost conversion.",
    },
    {
      date: "Aug 19",
      kind: "weak-signal",
      title: "Metrics note circulated, no response",
      detail: "Diego Park posts week-2 numbers in #checkout. Three reactions, no replies.",
    },
    {
      date: "Sep 24",
      kind: "deferral",
      title: "Topic absent from Q4 planning",
      detail: "Fraud/conversion tradeoff not raised in Q4 OKR doc or roadmap review.",
    },
  ],
  patterns: [
    {
      fact: "Three of the last four checkout-policy decisions were made in incident response under 24h.",
      interpretation:
        "The team's checkout decision-making is reactive. Strategic ownership of the fraud/conversion tradeoff has not been established.",
    },
    {
      fact: "CFO has gated 4 of the last 6 fraud-related rollbacks in the past 9 months.",
      interpretation:
        "Finance functions as a de-facto risk authority for checkout. Product authority on this surface is contested.",
    },
  ],
  artifacts: [
    {
      id: "a1",
      source: "Slack",
      title: "#checkout-incident — chargeback spike thread",
      date: "Jul 8, 14:02 UTC",
      author: "Maya Chen",
      authorRole: "Risk Lead",
      contribution: "Strong signal",
      excerpt: "We're at 1.41 over rolling 7-day. Need to push threshold to 0.74 today.",
    },
    {
      id: "a2",
      source: "Jira",
      title: "CHK-2841 — Tighten fraud threshold to 0.74",
      date: "Jul 9",
      author: "Diego Park",
      authorRole: "Growth PM",
      contribution: "Strong signal",
      excerpt: "Deploy to all checkout flows. Owner: Risk. Review in 14 days.",
    },
    {
      id: "a3",
      source: "Slack",
      title: "#finance-leads — Re: rollback request",
      date: "Jul 22, 18:11 UTC",
      author: "Helena Voss",
      authorRole: "CFO",
      contribution: "Strong signal",
      excerpt: "Not until we see two clean weeks under the current ceiling. We can revisit at month-end.",
    },
    {
      id: "a4",
      source: "Notion",
      title: "Fraud rule v2 — interim",
      date: "Aug 4",
      author: "Diego Park",
      authorRole: "Growth PM",
      contribution: "Supporting",
      excerpt:
        "Exempt returning customers with 6+ months tenure. Targets ~30% of blocked transactions, projected to recover 1.5–2.0% conversion.",
    },
  ],
};

// ── Second saved reconstruction (drifted) ──────────────────────────────

export const onboardingReconstruction: Reconstruction = {
  id: "onboarding-step-3",
  query: "Why did we restructure onboarding step 3?",
  title: "Onboarding step 3 restructure",
  pattern: "friction identified → options explored → temporary fix → issue persists",
  conclusion:
    "Drop-off at step 3 of the activation flow was raised in April. Three options were explored; the team shipped the lowest-risk variant in May. Drop-off has decreased modestly but remains above target. The original strategic question — whether step 3 should exist at all — was deferred and has resurfaced twice since.",
  confidence: 61,
  drift: {
    changed: -14,
    when: "1 week ago",
    reason: "3 new artifacts from product review suggest re-litigation of the deferred question.",
  },
  meta: {
    strength: "Weak",
    completeness: "Partial",
    alignment: "Contested",
    learning: "Partial",
  },
  decisions: [
    {
      id: "ob1",
      statement: "Reorder fields within step 3, defer larger restructure",
      status: "PARTIAL",
      type: "Temporary",
      confidence: 67,
      reasoning: "Lowest-risk option chosen to ship before Q2 close.",
      supportedReasoning: ["Notion doc 'Activation step 3 — options' — option B selected May 6."],
      inferredReasoning: ["Choice appears influenced by quarter-end timing rather than first-principles reasoning."],
      artifactIds: [],
    },
  ],
  open: {
    questions: [
      { text: "Should step 3 exist at all in the activation flow?", tag: "Deferred" },
      { text: "Is the drop-off driven by content or by placement?", tag: "Never addressed" },
    ],
    rejected: [
      { text: "Remove step 3 entirely", rationale: "Considered May 4, blocked on data dependency concerns." },
      { text: "Replace with progressive disclosure", rationale: "Deemed too large for Q2." },
    ],
    assumptions: [{ text: "Field order is the primary driver of drop-off." }],
  },
  timeline: [
    { date: "Apr 14", kind: "spike", title: "Drop-off flagged in weekly metrics review", detail: "Step 3 completion at 58%, target 75%." },
    { date: "Apr 28", kind: "gate", title: "Three options scoped", detail: "Remove, restructure, or reorder." },
    { date: "May 6", kind: "patch", title: "Field reorder shipped", detail: "Smallest-surface change selected." },
    { date: "Jun 19", kind: "weak-signal", title: "Modest improvement, still below target", detail: "Completion rose to 64%." },
  ],
  patterns: [
    { fact: "Strategic option (remove step) has been deferred twice.", interpretation: "Pattern of avoiding the higher-leverage decision under quarterly pressure." },
  ],
  artifacts: [],
};

// ── Homepage data ───────────────────────────────────────────────────────

export const platformStats = {
  activityProcessed: 1247,
  artifactsExtracted: 312,
  windowDays: 30,
  backfill: { processed: 8400, total: 14000 },
};

export interface HeatmapZone {
  id: string;
  label: string;
  artifacts: number;
  recent: number;
  recencyLevel: 1 | 2 | 3 | 4;
  query: string;
}

export const heatmapZones: HeatmapZone[] = [
  { id: "z1", label: "Checkout / payment failures", artifacts: 47, recent: 12, recencyLevel: 4, query: "Why did we change the checkout fraud rule in Q3?" },
  { id: "z2", label: "Onboarding flow changes", artifacts: 23, recent: 4, recencyLevel: 2, query: "Why did we restructure onboarding step 3?" },
  { id: "z3", label: "Q4 pricing model", artifacts: 18, recent: 8, recencyLevel: 3, query: "How did the Q4 pricing model take shape?" },
  { id: "z4", label: "API rate limit policy", artifacts: 9, recent: 1, recencyLevel: 1, query: "Why did we revise the API rate limit policy?" },
  { id: "z5", label: "Enterprise SSO requirements", artifacts: 14, recent: 3, recencyLevel: 2, query: "How did the enterprise SSO scope get decided?" },
];

export interface RecentReconstruction {
  id: string;
  title: string;
  confidence: number;
  drift: { state: "stable" | "drifted"; when?: string };
}

export const recentReconstructions: RecentReconstruction[] = [
  { id: "fraud-q3", title: "Checkout fraud rule change — Q3", confidence: 71, drift: { state: "stable" } },
  { id: "renewal-q2", title: "Renewal terms change — Q2", confidence: 74, drift: { state: "drifted", when: "3 days ago" } },
  { id: "fraud-rollback", title: "Checkout fraud rule rollback", confidence: 88, drift: { state: "stable" } },
  { id: "onboarding-step-3", title: "Onboarding step 3 restructure", confidence: 61, drift: { state: "drifted", when: "1 week ago" } },
];

// ── Disambiguation candidates ───────────────────────────────────────────

export interface ThreadCandidate {
  id: string;
  title: string;
  dateRange: string;
  artifacts: number;
  summary: string;
  people: string[];
}

export const disambiguationCandidates: ThreadCandidate[] = [
  {
    id: "fraud-q3",
    title: "Checkout fraud rule change — Q3",
    dateRange: "Jul 8 – Sep 24",
    artifacts: 34,
    summary: "Emergency tightening following chargeback breach, contested rollback, narrow exemption patch.",
    people: ["Maya Chen", "Diego Park", "Helena Voss"],
  },
  {
    id: "fraud-rollback",
    title: "Checkout fraud rule rollback — proposed Q2",
    dateRange: "Apr 22 – May 10",
    artifacts: 12,
    summary: "Q2 proposal to relax fraud thresholds; eventually superseded by Q3 emergency tightening.",
    people: ["Diego Park", "Maya Chen"],
  },
  {
    id: "fraud-3ds",
    title: "3DS fallback rule change — Sep",
    dateRange: "Sep 2 – Sep 18",
    artifacts: 9,
    summary: "Adjacent change to 3DS challenge fallback logic for EU traffic.",
    people: ["Maya Chen", "Anders Holm"],
  },
];

// ── Drift notifications ─────────────────────────────────────────────────

export interface DriftAlert {
  id: string;
  title: string;
  detail: string;
  reconstructionId: string;
}

export const driftAlerts: DriftAlert[] = [
  {
    id: "n1",
    title: "Renewal terms reconstruction drifted",
    detail: "Confidence dropped 23 points — 3 new artifacts suggest re-litigation",
    reconstructionId: "renewal-q2",
  },
  {
    id: "n2",
    title: "Onboarding step 3 drifted",
    detail: "Status changed: Resolved → Partially resolved",
    reconstructionId: "onboarding-step-3",
  },
  {
    id: "n3",
    title: "Checkout fraud reconstruction has new supporting artifacts",
    detail: "2 new Slack threads from #risk-weekly increase confidence by 4 points",
    reconstructionId: "fraud-q3",
  },
];

export const reconstructionsById: Record<string, Reconstruction> = {
  "fraud-q3": fraudReconstruction,
  "onboarding-step-3": onboardingReconstruction,
};
