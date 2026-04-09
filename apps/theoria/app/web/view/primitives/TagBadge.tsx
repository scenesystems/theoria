import { Cluster } from "./Layout.js"
import { SemanticText } from "./SemanticText.js"
import type { Tone } from "./theme/tone.js"

/**
 * Compact inline badge for named metadata — field names, labels, tags.
 *
 * Renders as a tight rounded pill with a tone-accented name and a
 * neutral description. Uses `stage-*` surface tokens for background
 * so it renders correctly in both light and dark mode.
 *
 * @since 0.1.0
 */
export const TagBadge = ({
  description,
  name,
  tone
}: {
  readonly description?: string
  readonly name: string
  readonly tone: Tone
}) => (
  <Cluster
    className={`min-w-0 items-baseline gap-1.5 rounded-md border px-2.5 py-1.5 ${tone.borderSubtle} bg-stage-100/60`}
  >
    <SemanticText as="span" className={tone.text} role="tab-label" text={name} />
    {description !== undefined
      ? <SemanticText as="span" className="text-ink-600" role="code-meta" text={description} />
      : null}
  </Cluster>
)
