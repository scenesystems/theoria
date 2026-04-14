import { Schema } from "effect"
import * as Option from "effect/Option"

import { MessageActorModel, MessageAvatarModel, type MessageRole } from "../../../presentation/interactions.js"

const encodeUnknownJson = Schema.encodeSync(Schema.parseJson(Schema.Unknown))

export const compact = (text: string, max = 220): string =>
  text.length > max ? `${text.slice(0, max).trimEnd()}…` : text

export const encodeJsonText = (value: unknown): string => encodeUnknownJson(value)

export const timestampLabel = (timestamp: string): string => {
  const segments = timestamp.split("T")
  const clock = segments[1]?.replace("Z", "")

  return Option.getOrElse(Option.fromNullable(clock), () => timestamp)
}

export const avatarFallback = (label: string): string =>
  label
    .split(/\s+/u)
    .flatMap((part) => (part.length === 0 ? [] : [part[0] ?? ""]))
    .join("")
    .slice(0, 2)
    .toUpperCase()

export const messageAlignmentFor = (role: MessageRole): "start" | "end" => role === "user" ? "end" : "start"

export const messageActor = ({
  label,
  role,
  supportingText
}: {
  readonly label: string
  readonly role: MessageRole
  readonly supportingText?: string
}): MessageActorModel =>
  MessageActorModel.make({
    avatar: MessageAvatarModel.make({ fallback: avatarFallback(label), label }),
    label,
    role,
    ...Option.match(Option.fromNullable(supportingText), {
      onNone: () => ({}),
      onSome: (resolvedSupportingText) => ({ supportingText: resolvedSupportingText })
    })
  })
