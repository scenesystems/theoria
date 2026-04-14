import { Match, Schema } from "effect"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))

export const ConsumerArtifactKind = Schema.Literal(
  "agent-trace",
  "workflow-graph",
  "prompt-set",
  "evaluation-set",
  "model-route",
  "provenance-bundle"
)

export type ConsumerArtifactKind = typeof ConsumerArtifactKind.Type

export const ConsumerArtifactSourceKind = Schema.Literal(
  "pi-mono",
  "amp-thread",
  "amp-capture",
  "claude-share",
  "claude-export",
  "open-agent-trace",
  "workflow-registry"
)

export type ConsumerArtifactSourceKind = typeof ConsumerArtifactSourceKind.Type

export class ConsumerArtifact extends Schema.Class<ConsumerArtifact>("ConsumerArtifact")({
  artifactId: NonEmptyString,
  artifactKind: ConsumerArtifactKind,
  sourceKind: ConsumerArtifactSourceKind,
  sourceLabel: NonEmptyString,
  sourceUrl: NonEmptyString,
  title: NonEmptyString,
  summary: NonEmptyString
}) {
  sourceFamilyLabel(): string {
    return Match.value(this.sourceKind).pipe(
      Match.withReturnType<string>(),
      Match.when("pi-mono", () => "Pi-mono"),
      Match.when("amp-thread", () => "Amp thread"),
      Match.when("amp-capture", () => "Amp capture"),
      Match.when("claude-share", () => "Claude share"),
      Match.when("claude-export", () => "Claude export"),
      Match.when("open-agent-trace", () => "Open-agent-trace"),
      Match.when("workflow-registry", () => "Workflow registry"),
      Match.exhaustive
    )
  }

  detail(): string {
    return `${this.artifactKind} · ${this.sourceFamilyLabel()} · ${this.summary}`
  }
}
