import { Result } from "@effect-atom/atom"
import { Boolean as Bool, Equal, Match, Schema } from "effect"
import * as Arr from "effect/Array"
import * as Num from "effect/Number"
import * as Option from "effect/Option"
import * as Str from "effect/String"
import type { CSSProperties } from "react"

import type { SurfaceVariant } from "../../../contracts/presentation.js"
import { semanticsFor, type TextProjection, type TextRole, type TextWrapAuthority } from "../../../contracts/text.js"
import { useTextProjection } from "../../atoms/text.js"
import { classNames } from "./classNames.js"
import { glyphClassName, lineHeightVar, maxWidthClassName, whiteSpaceClassName } from "./semanticTextClasses.js"

/** The block elements a text may be: those the projection may wrap line by line. */
export const BlockElement = Schema.Literal("p", "h1", "h2", "h3", "dt", "dd")
export type BlockElement = typeof BlockElement.Type

/** The inline elements a text may be: set on one line, never projected. */
export const InlineElement = Schema.Literal("span", "code", "kbd")
export type InlineElement = typeof InlineElement.Type

export const SemanticTextElement = Schema.Union(BlockElement, InlineElement)
export type SemanticTextElement = typeof SemanticTextElement.Type

/**
 * Why a block is wrapped by the browser rather than by a projection, exposed
 * as `data-text-layout` so a measurement failure is visible in the document.
 */
const BrowserLayoutReason = Schema.Literal("native", "measuring", "measurement-failed")
type BrowserLayoutReason = typeof BrowserLayoutReason.Type

const projectedLineWhitespaceClass = (preserveWhitespace: boolean): string =>
  Bool.match(preserveWhitespace, { onTrue: () => "whitespace-pre", onFalse: () => "whitespace-nowrap" })

const projectedLineText = (text: string): string =>
  Bool.match(Str.isEmpty(text), { onTrue: () => "\u00a0", onFalse: () => text })

type ProjectionLine = TextProjection["lines"][number]

const lineHeightCalc = (role: TextRole, lines: number): string => `calc(var(${lineHeightVar(role)}) * ${String(lines)})`

const reservedLineStyle = (role: TextRole, reserveLines: Option.Option<number>): CSSProperties =>
  Option.match(reserveLines, {
    onNone: () => ({}),
    onSome: (lines) => ({ minHeight: lineHeightCalc(role, lines) })
  })

const limitedProjectionLines = ({
  maxLines,
  projection
}: {
  readonly maxLines: Option.Option<number>
  readonly projection: TextProjection
}): ReadonlyArray<ProjectionLine> =>
  Option.match(maxLines, {
    onNone: () => projection.lines,
    onSome: (limit) =>
      Arr.match(Arr.take(projection.lines, limit), {
        onEmpty: () => projection.lines,
        onNonEmpty: (visibleLines) => visibleLines
      })
  })

const lineClampStyle = ({
  maxLines,
  reserveLines,
  role
}: {
  readonly maxLines: Option.Option<number>
  readonly reserveLines: Option.Option<number>
  readonly role: TextRole
}): CSSProperties => ({
  ...reservedLineStyle(role, reserveLines),
  ...Option.match(maxLines, {
    onNone: () => ({}),
    onSome: (limit) => ({ overflow: "hidden", maxHeight: lineHeightCalc(role, limit) })
  })
})

const ProjectedLines = ({
  preserveWhitespace,
  projection
}: {
  readonly preserveWhitespace: boolean
  readonly projection: TextProjection
}) => (
  <>
    {Arr.map(
      projection.lines,
      (line) => (
        <span key={line.index} className={`block ${projectedLineWhitespaceClass(preserveWhitespace)}`}>
          {projectedLineText(line.text)}
        </span>
      )
    )}
  </>
)

const InlineText = ({
  as,
  className,
  role,
  text
}: {
  readonly as: SemanticTextElement
  readonly className: string
  readonly role: TextRole
  readonly text: string
}) => {
  const Component = as
  const glyph = glyphClassName(role)
  const leading = `leading-(${lineHeightVar(role)})`
  const base = `whitespace-nowrap ${glyph} ${leading}`

  return <Component className={classNames(className, base)}>{text}</Component>
}

const NoWrapBlockText = ({
  as,
  className,
  role,
  text
}: {
  readonly as: BlockElement
  readonly className: string
  readonly role: TextRole
  readonly text: string
}) => {
  const Component = as
  const glyph = glyphClassName(role)
  const leading = `leading-(${lineHeightVar(role)})`
  const base = `whitespace-nowrap ${glyph} ${leading}`

  return <Component className={classNames(className, base)}>{text}</Component>
}

const BrowserWrappedBlockText = ({
  as,
  className,
  layout,
  maxLines,
  reserveLines,
  role,
  text,
  variant
}: {
  readonly as: BlockElement
  readonly className: string
  readonly layout: BrowserLayoutReason
  readonly maxLines: Option.Option<number>
  readonly reserveLines: Option.Option<number>
  readonly role: TextRole
  readonly text: string
  readonly variant: SurfaceVariant
}) => {
  const semantics = semanticsFor(role)
  const Component = as
  const glyph = glyphClassName(role)
  const leading = `leading-(${lineHeightVar(role)})`
  const maxWidthClass = maxWidthClassName(role, variant)
  const fallback = `${whiteSpaceClassName(semantics.whiteSpace)} ${glyph} ${leading} ${maxWidthClass}`

  return (
    <Component
      className={classNames(className, fallback)}
      data-text-layout={layout}
      style={lineClampStyle({ maxLines, reserveLines, role })}
    >
      {text}
    </Component>
  )
}

const ProjectedWrappedBlockText = ({
  as,
  className,
  maxLines,
  reserveLines,
  role,
  text,
  variant
}: {
  readonly as: BlockElement
  readonly className: string
  readonly maxLines: Option.Option<number>
  readonly reserveLines: Option.Option<number>
  readonly role: TextRole
  readonly text: string
  readonly variant: SurfaceVariant
}) => {
  const { projection, ref } = useTextProjection({ role, text, variant })
  const semantics = semanticsFor(role)
  const Component = as
  const glyph = glyphClassName(role)
  const leading = `leading-(${lineHeightVar(role)})`
  const maxWidthClass = maxWidthClassName(role, variant)
  const browserWrapped = (layout: BrowserLayoutReason) => (
    <BrowserWrappedBlockText
      as={as}
      className={className}
      layout={layout}
      maxLines={maxLines}
      reserveLines={reserveLines}
      role={role}
      text={text}
      variant={variant}
    />
  )

  return Result.match(projection, {
    onInitial: () => browserWrapped("measuring"),
    onFailure: () => browserWrapped("measurement-failed"),
    onSuccess: ({ value: projection }) => {
      const visibleLines = limitedProjectionLines({ maxLines, projection })

      return (
        <Component
          ref={ref}
          className={classNames(className, `${glyph} ${leading} ${maxWidthClass}`)}
          data-lines={Arr.length(visibleLines)}
          data-height={Num.multiply(Arr.length(visibleLines), semantics.lineHeight)}
          data-max-line-width={projection.summary.maxLineWidth}
          style={reservedLineStyle(role, reserveLines)}
        >
          <ProjectedLines
            preserveWhitespace={Equal.equals(semantics.whiteSpace, "pre-wrap")}
            projection={{ ...projection, lines: visibleLines }}
          />
        </Component>
      )
    }
  })
}

export const SemanticText = ({
  as = "p",
  className = "",
  lineLimit,
  role,
  reserveLines,
  text,
  wrapAuthority,
  variant = "expanded"
}: {
  readonly as?: SemanticTextElement
  readonly className?: string
  readonly lineLimit?: number
  readonly role: TextRole
  readonly reserveLines?: number
  readonly text: string
  readonly wrapAuthority?: TextWrapAuthority
  readonly variant?: SurfaceVariant
}) => {
  const semantics = semanticsFor(role)
  const wrapping = Option.getOrElse(Option.fromNullable(wrapAuthority), () => semantics.wrapAuthority)
  const maxLines = Option.fromNullable(lineLimit)
  const reserved = Option.fromNullable(reserveLines)

  return Match.value(as).pipe(
    Match.when(
      Schema.is(InlineElement),
      (element) => <InlineText as={element} className={className} role={role} text={text} />
    ),
    Match.when(Schema.is(BlockElement), (element) =>
      Match.value(semantics.lineBreaks).pipe(
        Match.when("nowrap", () => <NoWrapBlockText as={element} className={className} role={role} text={text} />),
        Match.when("wrap", () =>
          Match.value(wrapping).pipe(
            Match.when("native-browser", () => (
              <BrowserWrappedBlockText
                as={element}
                className={className}
                layout="native"
                maxLines={maxLines}
                reserveLines={reserved}
                role={role}
                text={text}
                variant={variant}
              />
            )),
            Match.when("effect-text-projected", () => (
              <ProjectedWrappedBlockText
                as={element}
                className={className}
                maxLines={maxLines}
                reserveLines={reserved}
                role={role}
                text={text}
                variant={variant}
              />
            )),
            Match.exhaustive
          )),
        Match.exhaustive
      )),
    Match.exhaustive
  )
}
