import { useAtomSet } from "@effect-atom/atom-react"

import { copyDocsCodeAtom } from "../../atoms/docs.js"
import { toneClassesFor } from "../primitives/designSystem.js"
import { SemanticText } from "../primitives/SemanticText.js"

import { inlineMarkClassName, ProvenanceMark } from "./PlaceProvenance.js"
import { shortId } from "./placeViewModel.js"

const digestTone = toneClassesFor("digest")

/**
 * A content ID as the page shows it everywhere: the digest in the digest
 * tone, cut short where there is no room. It is a mark: pointing at it
 * answers with the whole ID, what it digests and the call that made it. A
 * click copies it and keeps the answer open to say so, so two IDs on the
 * page can be compared character by character instead of trusting the first
 * ten.
 */
export const ContentId = ({ className = "", form, id }: {
  readonly className?: string
  readonly form: "short" | "full"
  readonly id: string
}) => {
  const copy = useAtomSet(copyDocsCodeAtom)
  return (
    <ProvenanceMark
      aria-label={`Content ID ${id}`}
      className={`${inlineMarkClassName} cursor-copy ${className}`}
      data-place-content-id={id}
      mark={{ _tag: "Digest", contentId: id }}
      onClick={() => {
        copy(id)
      }}
    >
      <SemanticText
        as="code"
        className={form === "full" ? `block truncate ${digestTone.textStrong}` : digestTone.text}
        role="code-meta"
        text={form === "full" ? id : shortId(id)}
      />
    </ProvenanceMark>
  )
}
