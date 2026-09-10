import { useAtomSet } from "@effect-atom/atom-react"

import { copyDocsCodeAtom } from "../../atoms/docs.js"
import { toneClassesFor } from "../primitives/designSystem.js"
import { Layer } from "../primitives/Layout.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { GhostText } from "../primitives/Skeleton.js"

import { inlineMarkClassName, inlineMarkRoomClassName, ProvenanceMark } from "./PlaceProvenance.js"
import { contentIdShape, shortId } from "./placeViewModel.js"

const digestTone = toneClassesFor("digest")

/** The two forms an ID is cut to: the digest's first characters in the line, or the whole ID on a line of its own. */
const idText = (form: "short" | "full", id: string): string => form === "full" ? id : shortId(id)
const idClassName = (form: "short" | "full"): string =>
  form === "full" ? `block truncate ${digestTone.textStrong}` : digestTone.text

/**
 * The room a content ID takes before the build digests it: the same form, in
 * the same padding the mark has, so the ID arriving there moves nothing. Not
 * a mark, since there is nothing yet to answer with.
 */
export const ContentIdPending = ({ className = "", form }: {
  readonly className?: string
  readonly form: "short" | "full"
}) => (
  <Layer render={<span />} className={`${inlineMarkRoomClassName} ${className}`} data-place-content-id-pending>
    <GhostText as="code" className={idClassName(form)} role="code-meta" text={idText(form, contentIdShape)} />
  </Layer>
)

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
