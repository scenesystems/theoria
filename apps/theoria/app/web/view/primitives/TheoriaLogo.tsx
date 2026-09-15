import { Match, Schema } from "effect"
import * as Arr from "effect/Array"

import { mark, markStroke } from "../../../contracts/brand.js"
import { markPointsAttribute, markViewBoxAttribute } from "../../brand/brandAssets.js"
import { classNames } from "./classNames.js"
import { semanticClassName } from "./semanticTextClasses.js"
import { WordmarkMorph } from "./WordmarkMorph.js"

/** How the wordmark behaves: still, or crossfading between "Theoria" and "θεωρία". */
export const LogoAnimation = Schema.Literal("glossary", "none")

export type LogoAnimation = typeof LogoAnimation.Type

const CubeMark = ({ className }: { readonly className: string }) => (
  <svg
    aria-hidden
    className={className}
    fill="none"
    preserveAspectRatio="xMidYMid meet"
    viewBox={markViewBoxAttribute(mark.viewBox)}
  >
    {Arr.map(mark.faces, (face) => (
      <polygon
        key={markPointsAttribute(face)}
        fill="currentColor"
        fillOpacity={face.fillOpacity}
        points={markPointsAttribute(face)}
        stroke="currentColor"
        strokeLinejoin="round"
        strokeOpacity={markStroke.opacity}
        strokeWidth={markStroke.width}
      />
    ))}
  </svg>
)

const wordmark = (animation: LogoAnimation) =>
  Match.value(animation).pipe(
    Match.when("none", () => <span className="text-ink">Theoria</span>),
    Match.when("glossary", () => (
      <span aria-label="Theoria" role="img">
        <WordmarkMorph />
      </span>
    )),
    Match.exhaustive
  )

/**
 * Branded Theoria logo — isometric cube mark + wordmark.
 *
 * The cube is the brand contract's mark (`app/contracts/brand.ts`): a single
 * voxel projected at the canonical isometric angle, the same geometry that
 * `favicon.svg` and the share cards carry, in `currentColor`.
 *
 * When `animation` is `"glossary"`, the wordmark renders via `WordmarkMorph`,
 * which crossfades per-character between "Theoria" and "θεωρία" once as the
 * session begins, rests, and plays again when a reader meets it.
 *
 * @since 0.1.0
 */
export const TheoriaLogo = ({
  animation,
  className = ""
}: {
  readonly animation: LogoAnimation
  readonly className?: string
}) => {
  const base = `inline-flex items-center gap-[0.25em] select-none ${semanticClassName("wordmark", "compact")}`

  return (
    <span className={classNames(base, className)}>
      <CubeMark className="h-[0.85em] shrink-0" />
      {wordmark(animation)}
    </span>
  )
}
