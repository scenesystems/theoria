import { Array, Boolean, Match, Option, Predicate, Schema, String } from "effect"
import type { ReactNode } from "react"

import { ApiDocPartSchema, GuideInlineSchema } from "@theoria/docs-model"
import { linkTextClassName } from "../primitives/designSystem.js"
import { ExternalLink, InternalLink } from "../primitives/Link.js"
import { MathContent } from "../primitives/MathContent.js"
import { SemanticContent } from "../primitives/SemanticContent.js"

const RichPart = Schema.Union(ApiDocPartSchema, GuideInlineSchema)
const RichText = Schema.Struct({ parts: Schema.Array(RichPart) })

/** A link into this site — a path or a fragment — stays a client-side link; any other leaves it. */
const staysOnSite: Predicate.Predicate<string> = Predicate.some(
  Array.make(String.startsWith("/"), String.startsWith("#"))
)

const richLink = (href: string, text: string, key: number): ReactNode => {
  const className = linkTextClassName

  return Boolean.match(staysOnSite(href), {
    onTrue: () => <InternalLink className={className} href={href} key={key}>{text}</InternalLink>,
    onFalse: () => <ExternalLink className={className} href={href} key={key}>{text}</ExternalLink>
  })
}

/** A guide's link always has a target; an API part's may have none, and then reads as plain text. */
const linkTarget = (href: string | Option.Option<string>): Option.Option<string> =>
  Match.value(href).pipe(
    Match.when(Predicate.isString, (target) => Option.some(target)),
    Match.orElse((target) => target)
  )

const richPart = (part: typeof RichPart.Type, key: number): ReactNode =>
  Match.value(part).pipe(
    Match.when({ kind: "text" }, ({ text }) => text),
    Match.when({ kind: "math" }, (expression) => <MathContent {...expression} key={key} />),
    Match.when({ kind: "code" }, ({ text }) => (
      <SemanticContent
        as="code"
        className="rounded-mark border border-hairline-glass bg-instrument-glass px-1.5 py-0.5"
        key={key}
        role="code-meta"
      >
        {text}
      </SemanticContent>
    )),
    Match.when({ kind: "link" }, ({ href, text }) =>
      Option.match(linkTarget(href), {
        onNone: () => text,
        onSome: (target) => richLink(target, text, key)
      })),
    Match.exhaustive
  )

export const DocsRichText = ({ parts }: typeof RichText.Type) => (
  <>
    {Array.map(parts, richPart)}
  </>
)
