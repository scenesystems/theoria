import type { ToneClasses } from "./designSystem.js"
import { SemanticText } from "./SemanticText.js"

/**
 * Who is speaking, in their own accent. The name is text in the line: the tone
 * is the only mark, the same tone the participant's discs and rules carry, so
 * the reader learns one colour per voice and never a badge shape.
 *
 * @since 0.1.0
 */
export const ParticipantName = ({
  className = "",
  name,
  tone
}: {
  readonly className?: string
  readonly name: string
  readonly tone: ToneClasses
}) => <SemanticText as="span" className={`${tone.textStrong} ${className}`} role="tab-label" text={name} />
