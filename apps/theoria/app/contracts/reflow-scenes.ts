import type { Obstacle, ReflowScene } from "./obstacle.js"

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

export const supportChatScene: ReflowScene = {
  summary:
    "The transcript feels like a real support artifact when the lines dodge a ticket header, an agent side note, and a stale-state warning.",
  obstacles: [
    obstacle({
      badge: "P1",
      detail: "Org switch flash",
      id: "support-escalation-ticket",
      label: "Escalation ticket",
      heightPx: 86,
      tone: "digest",
      topPx: 24,
      placement: "left",
      variant: "panel",
      widthPx: 148
    }),
    obstacle({
      badge: "SUPPORT",
      detail: "Capture id, hash, timing",
      id: "support-agent-note",
      label: "Agent note",
      heightPx: 96,
      tone: "text",
      topPx: 128,
      placement: "right",
      variant: "quote",
      widthPx: 164
    }),
    obstacle({
      badge: "FLASH",
      detail: "Confidence beats truth",
      id: "support-stale-warning",
      label: "Stale-state warning",
      heightPx: 92,
      tone: "sign",
      topPx: 240,
      placement: "right",
      variant: "stack",
      widthPx: 152
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

export const multilingualScene: ReflowScene = {
  summary:
    "The multilingual excerpt bends around a language tag, an interpretation note, and an evidence rail without breaking the prepared-text contract.",
  obstacles: [
    obstacle({
      badge: "ES/EN",
      detail: "Language handoff",
      id: "multilingual-language-tag",
      label: "Language tag",
      heightPx: 86,
      tone: "text",
      topPx: 24,
      placement: "right",
      variant: "panel",
      widthPx: 150
    }),
    obstacle({
      badge: "NOTE",
      detail: "Interpretation remains explicit",
      id: "multilingual-interpretation-note",
      label: "Interpretation note",
      heightPx: 104,
      tone: "digest",
      topPx: 132,
      placement: "left",
      variant: "quote",
      widthPx: 136
    }),
    obstacle({
      badge: "TRACE",
      detail: "Render stays contract-loyal",
      id: "multilingual-evidence-rail",
      label: "Evidence rail",
      heightPx: 96,
      tone: "search",
      topPx: 262,
      placement: "right",
      variant: "stack",
      widthPx: 160
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

export const productCopyScene: ReflowScene = {
  summary:
    "The landing-page copy now bends around a proof badge, a customer quote, and a checklist rail instead of generic boxes.",
  obstacles: [
    obstacle({
      badge: "LIVE DEMO",
      detail: "Every claim cites evidence",
      id: "product-proof-badge",
      label: "Proof badge",
      heightPx: 92,
      tone: "digest",
      topPx: 24,
      placement: "left",
      variant: "panel",
      widthPx: 142
    }),
    obstacle({
      badge: "CUSTOMER",
      detail: "Tools that show their work",
      id: "product-customer-quote",
      label: "Customer quote",
      heightPx: 96,
      tone: "seal",
      topPx: 134,
      placement: "right",
      variant: "quote",
      widthPx: 170
    }),
    obstacle({
      badge: "CHECKLIST",
      detail: "Ask, run, compare, inspect",
      id: "product-proof-checklist",
      label: "Proof checklist",
      heightPx: 96,
      tone: "math",
      topPx: 246,
      placement: "right",
      variant: "stack",
      widthPx: 158
    })
  ]
}

export const customTextScene: ReflowScene = {
  summary:
    "Custom text uses a neutral annotation layout so the browser still demonstrates fixed-plane wrapping without pretending to know your domain.",
  obstacles: [
    obstacle({
      badge: "NOTE",
      detail: "Your text stays primary",
      id: "custom-inline-note",
      label: "Inline note",
      heightPx: 86,
      tone: "text",
      topPx: 24,
      placement: "right",
      variant: "panel",
      widthPx: 150
    }),
    obstacle({
      badge: "TRACE",
      detail: "Projection remains pure",
      id: "custom-reference-panel",
      label: "Reference panel",
      heightPx: 114,
      tone: "search",
      topPx: 128,
      placement: "left",
      variant: "figure",
      widthPx: 124
    }),
    obstacle({
      badge: "STACK",
      detail: "Meaning still comes later",
      id: "custom-evidence-stack",
      label: "Evidence stack",
      heightPx: 96,
      tone: "digest",
      topPx: 260,
      placement: "right",
      variant: "stack",
      widthPx: 154
    })
  ]
}
