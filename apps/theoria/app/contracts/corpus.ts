import { Schema } from "effect"

import { ReflowScene } from "./obstacle.js"
import {
  codeCommentaryScene,
  customTextScene,
  legalPolicyScene,
  productCopyScene,
  researchAbstractScene,
  supportChatScene
} from "./reflow-scenes.js"

export const CorpusEntry = Schema.Struct({
  id: Schema.String.pipe(Schema.minLength(1)),
  label: Schema.String.pipe(Schema.minLength(1)),
  scene: ReflowScene,
  text: Schema.String.pipe(Schema.minLength(1))
})

export type CorpusEntry = typeof CorpusEntry.Type

export const customCorpusEntry: CorpusEntry = {
  id: "custom",
  label: "Your text",
  scene: customTextScene,
  text: ""
}

export const corpus: ReadonlyArray<CorpusEntry> = [
  {
    id: "legal",
    label: "Legal policy",
    scene: legalPolicyScene,
    text:
      "The custodian shall retain encrypted audit records for seven years, preserve immutable access logs for every protocol transition, and provide counterparties with a signed evidence bundle on request. Any unauthorized disclosure, replay attempt, or policy bypass must be disclosed within twenty-four hours, accompanied by a machine-readable incident trace, a human-readable narrative of what changed, and a remediation plan that restores source-of-truth alignment before normal operation resumes."
  },
  {
    id: "research-abstract",
    label: "Research abstract",
    scene: researchAbstractScene,
    text:
      "We evaluate whether protocol-level scaffolding reduces coordination entropy in mixed human-agent deliberation loops by measuring convergence, disagreement persistence, citation-grounded revision quality, and recovery speed after intentional ambiguity is introduced into the task. Our working hypothesis is that shared contracts, visible evidence trails, and explicit scene boundaries do not merely improve accuracy; they change the social geometry of reasoning itself, making it easier for participants to ask sharper questions, locate drift earlier, and repair collaboration without falling back to vague intuition."
  },
  {
    id: "support-chat",
    label: "Support chat transcript",
    scene: supportChatScene,
    text:
      "Customer: Hi team, after migrating to typed envelopes our dashboard finally loads consistently, but when I switch organizations the previous run state still flashes for a second before the new data settles. Support: Thank you, that means transport decoding is healthier but surface orchestration is still leaking stale geometry; please capture the scene identifier, the last evidence hash you saw, and whether the flash happens before or after the new run controls mount. Customer: Confirmed, the flash happens before the next evidence stream attaches, and the confusing part is that the UI looks confident even when the contract is briefly wrong."
  },
  {
    id: "code-commentary",
    label: "Code commentary",
    scene: codeCommentaryScene,
    text:
      "The baseline implementation repeatedly recomputed expensive preparation for every viewport width, every obstacle toggle, and every nearby visual adjustment, which made the demo look dynamic while quietly erasing the very distinction it claimed to teach. The corrected path prepares once, preserves that handle as the semantic authority, and projects every subsequent layout summary as a pure function of width, line height, and obstacle bands. That separation is not just a performance trick; it is the same architectural ethic we want everywhere else in the company: derive from one contract, render faithfully, and make drift obvious instead of silently compensating for it."
  },
  {
    id: "product-copy",
    label: "Product copy",
    scene: productCopyScene,
    text:
      "Ask one real question, run a live demonstration, compare baseline versus improved behavior, and inspect the exact code path that produced every reported metric, trace, and claim. Scene Systems is built for teams who are tired of hand-wavy software theater: we want tools that show their work, interfaces that stay loyal to their contracts, and research environments where humans and agents can think together without hiding the evidence under a polished surface."
  }
]
