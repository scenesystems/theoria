import type { Id as CardId } from "../../../contracts/id.js"
import { toneForCard } from "../../../contracts/theme.js"

import { focusEdgeClassName, toneClassesFor } from "./designSystem.js"
import { DocsLink } from "./DocsLink.js"
import { SemanticText } from "./SemanticText.js"

const packageNameClassName =
  `inline-flex min-w-0 items-baseline rounded-control decoration-1 [text-underline-position:under] underline-offset-[0.1em] transition-colors duration-150 hover:underline ${focusEdgeClassName} focus-visible:ring-2`

/**
 * A package's short name, in monospace and its own tone, linked to its docs.
 * It is a word in the sentence, not a chip beside it: the tone and the type
 * say what it is, and the underline arrives only under the pointer. The
 * underline is drawn below the name's descenders — under the `g` of `digest`
 * as under the `n` of `sign` — so it is one line under the word, and the same
 * line under every name in a row. The link carries the tone as well as the
 * name, so the underline is drawn in the name's colour.
 *
 * @since 0.1.0
 */
export const PackageName = ({ id }: { readonly id: CardId }) => {
  const tone = toneClassesFor(toneForCard(id))
  return (
    <DocsLink className={`${packageNameClassName} ${tone.text} ${tone.focusRing}`} href={`/docs/${id}`} title={id}>
      <SemanticText as="span" className={tone.text} role="code-meta" text={id} />
    </DocsLink>
  )
}
