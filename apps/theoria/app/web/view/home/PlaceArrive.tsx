import { Stack } from "../primitives/Layout.js"
import { SemanticText } from "../primitives/SemanticText.js"

/** What the demonstration is: the packages, working. The place they make is named on the paper, by the composer. */
export const placeArriveTitle = "The packages at work"

/**
 * How the demonstration works, said once. The story itself is on the paper;
 * this names the mechanism the acts then show, in their order: compose,
 * arrange, propose, record.
 */
export const placeArriveText =
  "An imagined place built live from a short brief. Theoria packages compose it as prose and features, draw it on the page, take in the proposals you merge, and record every version as a digest you sign."

/** Arrival at the demonstration: what it is, then how it works. */
export const PlaceArrive = () => (
  <Stack className="gap-4" data-place-arrive>
    <SemanticText
      as="h2"
      className="text-balance text-ink-950"
      role="hero-title"
      text={placeArriveTitle}
      variant="expanded"
      wrapAuthority="native-browser"
    />
    <SemanticText
      as="p"
      className="text-ink-700"
      role="lead"
      text={placeArriveText}
      variant="expanded"
      wrapAuthority="native-browser"
    />
  </Stack>
)
