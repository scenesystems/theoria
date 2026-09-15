import type { Id as CardId } from "../../../contracts/id.js"

import { focusClassName, respondColorsClassName } from "./designSystem.js"
import { DocsLink } from "./DocsLink.js"
import { SemanticText } from "./SemanticText.js"

const packageNameClassName =
  `inline-flex min-w-0 items-baseline rounded-control decoration-1 [text-underline-position:under] underline-offset-[0.1em] ${respondColorsClassName} hover:underline ${focusClassName}`

/**
 * A package's short name, in monospace and the quiet ink, linked to its docs.
 * It is a word in the sentence, not a chip beside it: the type says what it
 * is, and the underline arrives only under the pointer. The
 * underline is drawn below the name's descenders — under the `g` of `digest`
 * as under the `n` of `sign` — so it is one line under the word, and the same
 * line under every name in a row. The link carries the ink as well as the
 * name, so the underline is drawn in the name's colour.
 *
 * @since 0.1.0
 */
export const PackageName = ({ id }: { readonly id: CardId }) => (
  <DocsLink className={`${packageNameClassName} text-ink-secondary`} href={`/docs/${id}`} title={id}>
    <SemanticText as="span" className="text-ink-secondary" role="code-meta" text={id} />
  </DocsLink>
)
