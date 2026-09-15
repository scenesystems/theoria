import { Match, Schema } from "effect"

import { neutralToneClasses } from "../primitives/designSystem.js"
import { Layer } from "../primitives/Layout.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { GhostText } from "../primitives/Skeleton.js"

import { inlineMarkClassName, inlineMarkRoomClassName, ProvenanceMark } from "./PlaceProvenance.js"
import { contentIdShape, shortId } from "./placeViewModel.js"

const idTone = neutralToneClasses

/** The two forms an ID is cut to: the digest's first characters in the line, or the whole ID on a line of its own. */
export const IdForm = Schema.Literal("short", "full")
export type IdForm = typeof IdForm.Type

const idText = (form: IdForm, id: string): string =>
  Match.value(form).pipe(
    Match.when("full", () => id),
    Match.when("short", () => shortId(id)),
    Match.exhaustive
  )
const idClassName = (form: IdForm): string =>
  Match.value(form).pipe(
    Match.when("full", () => `block truncate ${idTone.textStrong}`),
    Match.when("short", () => idTone.text),
    Match.exhaustive
  )

/**
 * The room a content ID takes before the build digests it: the same form, in
 * the same padding the mark has, so the ID arriving there moves nothing. Not
 * a mark, since there is nothing yet to answer with.
 */
export const ContentIdPending = ({ className = "", form }: {
  readonly className?: string
  readonly form: IdForm
}) => (
  <Layer render={<span />} className={`${inlineMarkRoomClassName} ${className}`} data-place-content-id-pending>
    <GhostText as="code" className={idClassName(form)} role="code-meta" text={idText(form, contentIdShape)} />
  </Layer>
)

/**
 * A content ID as the page shows it everywhere: the digest in the digest
 * tone, cut short where there is no room. It is a mark: pressing it answers
 * with the whole ID, what it digests and the call that made it, and the
 * answer's own control copies the ID — so two IDs on the page can be
 * compared character by character instead of trusting the first ten.
 */
export const ContentId = ({ className = "", form, id }: {
  readonly className?: string
  readonly form: IdForm
  readonly id: string
}) => (
  <ProvenanceMark
    aria-label={`Content ID ${id}`}
    className={`${inlineMarkClassName} ${className}`}
    data-place-content-id={id}
    mark={{ _tag: "Digest", contentId: id }}
  >
    <SemanticText as="code" className={idClassName(form)} role="code-meta" text={idText(form, id)} />
  </ProvenanceMark>
)
