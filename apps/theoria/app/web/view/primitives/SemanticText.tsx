import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { Match } from "effect"
import * as Arr from "effect/Array"
import { useId } from "react"

import type { SurfaceVariant } from "../../../contracts/presentation.js"
import { semanticsFor, type TextProjection, type TextRole } from "../../../contracts/text.js"
import { elementWidthAtom, makeWidthObserver } from "../../atoms/element-width.js"
import { textProjectionAtom, textProjectionKey } from "../../atoms/text.js"

type SemanticTextElement = "span" | "p" | "h1" | "h2" | "h3" | "dt" | "dd" | "code"

type BlockElement = "p" | "h1" | "h2" | "h3" | "dt" | "dd"

const isBlockElement = (el: SemanticTextElement): el is BlockElement => el !== "span" && el !== "code"

const fontSizeVar = (role: TextRole): string => `--st-fs-${role}`
const fontWeightVar = (role: TextRole): string => `--st-fw-${role}`
const trackingVar = (role: TextRole): string => `--st-tr-${role}`
const fontFamilyVar = (role: TextRole): string => `--st-ff-${role}`
const lineHeightVar = (role: TextRole): string => `--st-lh-${role}`
const maxWidthCssVar = (role: TextRole, variant: SurfaceVariant): string => `--st-mw-${role}-${variant}`

const textTransformFor = (role: TextRole): string => role === "row-label" ? "uppercase" : ""

const glyphClassName = (role: TextRole): string =>
  [
    `text-(length:${fontSizeVar(role)})`,
    `font-weight-(${fontWeightVar(role)})`,
    `tracking-(${trackingVar(role)})`,
    `font-family-(${fontFamilyVar(role)})`,
    textTransformFor(role)
  ].filter((c) => c.length > 0).join(" ")

const shouldConstrainWidth = (role: TextRole): boolean =>
  Match.value(role).pipe(
    Match.when("button-label", () => false),
    Match.when("tab-label", () => false),
    Match.orElse(() => true)
  )

const ProjectedLines = ({ projection }: { readonly projection: TextProjection }) => (
  <>
    {Arr.map(projection.lines, (line) => (
      <span key={line.index} className="block whitespace-nowrap">
        {line.text}
      </span>
    ))}
  </>
)

const InlineText = ({
  as,
  className,
  role,
  text
}: {
  readonly as: SemanticTextElement
  readonly className: string | undefined
  readonly role: TextRole
  readonly text: string
}) => {
  const Component = as
  const glyph = glyphClassName(role)
  const leading = `leading-(${lineHeightVar(role)})`
  const base = `whitespace-nowrap ${glyph} ${leading}`
  const combined = className === undefined ? base : `${base} ${className}`

  return <Component className={combined}>{text}</Component>
}

const BlockText = ({
  as,
  className,
  role,
  text,
  variant
}: {
  readonly as: BlockElement
  readonly className: string | undefined
  readonly role: TextRole
  readonly text: string
  readonly variant: SurfaceVariant
}) => {
  const elementId = useId()
  const setWidth = useAtomSet(elementWidthAtom(elementId))
  const refCallback = makeWidthObserver(setWidth)
  const projection = useAtomValue(textProjectionAtom(textProjectionKey(role, variant, text, elementId)))
  const Component = as
  const glyph = glyphClassName(role)
  const leading = `leading-(${lineHeightVar(role)})`

  if (projection !== null) {
    const projected = `${glyph} ${leading}`
    const combined = className === undefined ? projected : `${projected} ${className}`

    return (
      <Component
        ref={refCallback}
        className={combined}
        data-lines={projection.summary.lineCount}
        data-height={projection.summary.height}
        data-max-line-width={projection.summary.maxLineWidth}
      >
        <ProjectedLines projection={projection} />
      </Component>
    )
  }

  const whiteSpace = Match.value(semanticsFor(role).whiteSpace).pipe(
    Match.when("pre-wrap", () => "whitespace-pre-wrap break-words"),
    Match.orElse(() => "whitespace-normal break-words")
  )
  const maxWidthClass = shouldConstrainWidth(role) ? `max-w-(${maxWidthCssVar(role, variant)})` : ""
  const fallback = `${whiteSpace} ${glyph} ${leading} ${maxWidthClass}`
  const combined = className === undefined ? fallback : `${fallback} ${className}`

  return (
    <Component ref={refCallback} className={combined}>
      {text}
    </Component>
  )
}

export const SemanticText = ({
  as,
  className,
  role,
  text,
  variant
}: {
  readonly as?: SemanticTextElement
  readonly className?: string
  readonly role: TextRole
  readonly text: string
  readonly variant: SurfaceVariant
}) => {
  const element = as ?? "p"

  if (!isBlockElement(element)) {
    return <InlineText as={element} className={className} role={role} text={text} />
  }

  return <BlockText as={element} className={className} role={role} text={text} variant={variant} />
}
