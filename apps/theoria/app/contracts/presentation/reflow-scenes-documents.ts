import type { Obstacle, ReflowScene } from "../obstacle.js"

const obstacle = (definition: Obstacle): Obstacle => definition

export const legalPolicyScene: ReflowScene = {
  summary:
    "Compliance prose now wraps around a retention clause, an evidence bundle rail, and a breach window that all feel native to policy text.",
  obstacles: [
    obstacle({
      badge: "7Y RETAIN",
      detail: "Seven audit cycles",
      id: "legal-retention-clause",
      label: "Retention clause",
      heightPx: 96,
      tone: "seal",
      topPx: 24,
      placement: "right",
      variant: "panel",
      widthPx: 160
    }),
    obstacle({
      badge: "SIGNED",
      detail: "Hash, seal, receipt",
      id: "legal-evidence-bundle",
      label: "Evidence bundle",
      heightPx: 120,
      tone: "digest",
      topPx: 140,
      placement: "left",
      variant: "stack",
      widthPx: 118
    }),
    obstacle({
      badge: "24H",
      detail: "Disclosure window",
      id: "legal-breach-window",
      label: "Breach notice",
      heightPx: 96,
      tone: "sign",
      topPx: 280,
      placement: "right",
      variant: "quote",
      widthPx: 168
    })
  ]
}

export const researchAbstractScene: ReflowScene = {
  summary:
    "The abstract reads like a paper layout: a hypothesis callout, a result figure, and a compact factor matrix bend the same prepared text.",
  obstacles: [
    obstacle({
      badge: "H1",
      detail: "Scaffolding cuts entropy",
      id: "abstract-hypothesis-callout",
      label: "Hypothesis",
      heightPx: 96,
      tone: "text",
      topPx: 24,
      placement: "right",
      variant: "quote",
      widthPx: 152
    }),
    obstacle({
      badge: "FIG 1",
      detail: "Convergence after repair",
      id: "abstract-result-figure",
      label: "Convergence plot",
      heightPx: 132,
      tone: "search",
      topPx: 136,
      placement: "left",
      variant: "figure",
      widthPx: 136
    }),
    obstacle({
      badge: "N=4",
      detail: "Condition, drift, repair",
      id: "abstract-factor-matrix",
      label: "Factor matrix",
      heightPx: 96,
      tone: "math",
      topPx: 286,
      placement: "right",
      variant: "stack",
      widthPx: 160
    })
  ]
}

export const markdownDocsScene: ReflowScene = {
  summary:
    "The migration notes now read like structured docs, with a release callout, a checklist rail, and a contract note shaping the same prepared text.",
  obstacles: [
    obstacle({
      badge: "DOCS",
      detail: "Migration guide",
      id: "markdown-release-callout",
      label: "Release callout",
      heightPx: 88,
      tone: "digest",
      topPx: 24,
      placement: "right",
      variant: "panel",
      widthPx: 152
    }),
    obstacle({
      badge: "CHECK",
      detail: "Contract, envelope, render",
      id: "markdown-checklist-rail",
      label: "Checklist rail",
      heightPx: 112,
      tone: "math",
      topPx: 132,
      placement: "left",
      variant: "stack",
      widthPx: 132
    }),
    obstacle({
      badge: "SOT",
      detail: "Authority stays in contracts",
      id: "markdown-contract-note",
      label: "Contract note",
      heightPx: 92,
      tone: "text",
      topPx: 268,
      placement: "right",
      variant: "quote",
      widthPx: 166
    })
  ]
}

export const releaseNotesScene: ReflowScene = {
  summary:
    "The notes read like a product changelog with a trust badge, an evaluation figure, and a replay checklist built into the flow.",
  obstacles: [
    obstacle({
      badge: "TRUST",
      detail: "Evidence stays attributable",
      id: "release-trust-badge",
      label: "Trust badge",
      heightPx: 88,
      tone: "sign",
      topPx: 24,
      placement: "left",
      variant: "panel",
      widthPx: 146
    }),
    obstacle({
      badge: "EVAL",
      detail: "Provider capability proof",
      id: "release-evaluation-figure",
      label: "Evaluation figure",
      heightPx: 118,
      tone: "search",
      topPx: 126,
      placement: "right",
      variant: "figure",
      widthPx: 160
    }),
    obstacle({
      badge: "REPLAY",
      detail: "Deterministic by default",
      id: "release-replay-checklist",
      label: "Replay checklist",
      heightPx: 96,
      tone: "seal",
      topPx: 258,
      placement: "right",
      variant: "stack",
      widthPx: 158
    })
  ]
}

export const codeCommentaryScene: ReflowScene = {
  summary:
    "The commentary now resembles engineering notes: a prepared handle card, a delta figure, and a derivation note occupy stable rails.",
  obstacles: [
    obstacle({
      badge: "PREPARE()",
      detail: "One handle, many layouts",
      id: "code-prepared-handle",
      label: "Prepared handle",
      heightPx: 96,
      tone: "search",
      topPx: 24,
      placement: "right",
      variant: "code",
      widthPx: 166
    }),
    obstacle({
      badge: "DELTA",
      detail: "Width and bands vary",
      id: "code-projection-delta",
      label: "Projection delta",
      heightPx: 118,
      tone: "digest",
      topPx: 140,
      placement: "left",
      variant: "figure",
      widthPx: 132
    }),
    obstacle({
      badge: "PURE",
      detail: "Browser honors contract",
      id: "code-derived-layout",
      label: "Derived layout",
      heightPx: 96,
      tone: "math",
      topPx: 276,
      placement: "right",
      variant: "stack",
      widthPx: 156
    })
  ]
}
