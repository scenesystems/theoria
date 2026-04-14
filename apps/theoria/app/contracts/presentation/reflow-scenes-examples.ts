import type { Obstacle, ReflowScene } from "../obstacle.js"

const obstacle = (definition: Obstacle): Obstacle => definition

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
