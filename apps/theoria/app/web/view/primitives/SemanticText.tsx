import { Match } from "effect"
import * as Arr from "effect/Array"
import * as Option from "effect/Option"
import type { CSSProperties } from "react"

import type { SurfaceVariant } from "../../../contracts/presentation.js"
import { semanticsFor, type TextProjection, type TextRole, type TextWrapAuthority } from "../../../contracts/text.js"
import { useTextProjection } from "../../atoms/text.js"
import { classNames } from "./classNames.js"
import { glyphClassName, lineHeightVar, maxWidthClassName } from "./semanticTextClasses.js"

type SemanticTextElement = "span" | "p" | "h1" | "h2" | "h3" | "dt" | "dd" | "code" | "kbd"

type BlockElement = "p" | "h1" | "h2" | "h3" | "dt" | "dd"

const isBlockElement = (el: SemanticTextElement): el is BlockElement => el !== "span" && el !== "code" && el !== "kbd"

const projectedLineWhitespaceClass = (preserveWhitespace: boolean): string =>
  preserveWhitespace ? "whitespace-pre" : "whitespace-nowrap"

const projectedLineText = (text: string): string => text.length === 0 ? "\u00a0" : text

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
    onSome: (limit) => {
      const visibleLines = Arr.take(projection.lines, limit)
      return Arr.isEmptyReadonlyArray(visibleLines) ? projection.lines : visibleLines
    }
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
  const semantics = semanticsFor(role)
  const Component = as
  const glyph = glyphClassName(role)
  const leading = `leading-(${lineHeightVar(role)})`
  const maxWidthClass = maxWidthClassName(role, variant)
  const whiteSpace = Match.value(semantics.whiteSpace).pipe(
    Match.when("pre-wrap", () => "whitespace-pre-wrap"),
    Match.orElse(() => "whitespace-normal")
  )
  const fallback = `${whiteSpace} ${glyph} ${leading} ${maxWidthClass}`

  return (
    <Component
      className={classNames(className, fallback)}
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

  if (projection !== null) {
    const projected = `${glyph} ${leading} ${maxWidthClass}`
    const visibleLines = limitedProjectionLines({ maxLines, projection })

    return (
      <Component
        ref={ref}
        className={classNames(className, projected)}
        data-lines={visibleLines.length}
        data-height={visibleLines.length * semantics.lineHeight}
        data-max-line-width={projection.summary.maxLineWidth}
        style={reservedLineStyle(role, reserveLines)}
      >
        <ProjectedLines
          preserveWhitespace={semantics.whiteSpace === "pre-wrap"}
          projection={{ ...projection, lines: visibleLines }}
        />
      </Component>
    )
  }

  return (
    <BrowserWrappedBlockText
      as={as}
      className={className}
      maxLines={maxLines}
      reserveLines={reserveLines}
      role={role}
      text={text}
      variant={variant}
    />
  )
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
  const element = as
  const semantics = semanticsFor(role)
  const resolvedWrapAuthority = wrapAuthority ?? semantics.wrapAuthority
  const maxLines = Option.fromNullable(lineLimit)
  const reserved = Option.fromNullable(reserveLines)

  if (!isBlockElement(element)) {
    return <InlineText as={element} className={className} role={role} text={text} />
  }

  if (semantics.lineBreaks === "nowrap") {
    return <NoWrapBlockText as={element} className={className} role={role} text={text} />
  }

  if (resolvedWrapAuthority === "native-browser") {
    return (
      <BrowserWrappedBlockText
        as={element}
        className={className}
        maxLines={maxLines}
        reserveLines={reserved}
        role={role}
        text={text}
        variant={variant}
      />
    )
  }

  return (
    <ProjectedWrappedBlockText
      as={element}
      className={className}
      maxLines={maxLines}
      reserveLines={reserved}
      role={role}
      text={text}
      variant={variant}
    />
  )
}
