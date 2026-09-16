import { Schema } from "effect"
import * as Arr from "effect/Array"

import { Segment, Whitespace } from "../../src/Text.js"

class UnicodeSegmentationFixture extends Schema.Class<UnicodeSegmentationFixture>(
  "effect-text-test/UnicodeSegmentationFixture"
)({
  expected: Schema.Array(Segment),
  name: Schema.String,
  text: Schema.String,
  whiteSpace: Whitespace
}) {}

class UnicodeOverflowFixture extends Schema.Class<UnicodeOverflowFixture>("effect-text-test/UnicodeOverflowFixture")({
  maxWidth: Schema.Number,
  name: Schema.String,
  text: Schema.String
}) {}

const UnicodeSegmentationFixtures = Schema.Array(UnicodeSegmentationFixture)
const UnicodeOverflowFixtures = Schema.Array(UnicodeOverflowFixture)
const textSegment = Schema.decodeSync(Segment)

export const unicodeSegmentationFixtures: typeof UnicodeSegmentationFixtures.Type = Arr.make(
  new UnicodeSegmentationFixture({
    expected: Arr.make(
      textSegment({ kind: "text", text: "no" }),
      textSegment({ kind: "text", text: "\u00a0" }),
      textSegment({ kind: "text", text: "break" }),
      textSegment({ kind: "space", text: " " }),
      textSegment({ kind: "text", text: "word" }),
      textSegment({ kind: "text", text: "\u2060" }),
      textSegment({ kind: "text", text: "join" }),
      textSegment({ kind: "space", text: " " }),
      textSegment({ kind: "text", text: "a" }),
      textSegment({ kind: "text", text: "\u200b" }),
      textSegment({ kind: "text", text: "b" })
    ),
    name: "nbsp-wj-zwsp",
    text: "no\u00a0break word\u2060join a\u200bb",
    whiteSpace: "normal"
  }),
  new UnicodeSegmentationFixture({
    expected: Arr.of(textSegment({ kind: "text", text: "https://example.com/a-b?x=1,2" })),
    name: "url-like-run",
    text: "https://example.com/a-b?x=1,2",
    whiteSpace: "normal"
  }),
  new UnicodeSegmentationFixture({
    expected: Arr.of(textSegment({ kind: "text", text: "1,234.56" })),
    name: "numeric-run",
    text: "1,234.56",
    whiteSpace: "normal"
  }),
  new UnicodeSegmentationFixture({
    expected: Arr.make(
      textSegment({ kind: "text", text: "(hello)" }),
      textSegment({ kind: "space", text: " " }),
      textSegment({ kind: "text", text: "[world]" })
    ),
    name: "opening-and-closing-punctuation",
    text: "(hello) [world]",
    whiteSpace: "normal"
  }),
  new UnicodeSegmentationFixture({
    expected: Arr.make(
      textSegment({ kind: "text", text: "\u300c\u4f60\u597d\u300d" }),
      textSegment({ kind: "space", text: " " }),
      textSegment({ kind: "text", text: "\u300e\u4e16\u754c\u300f" })
    ),
    name: "cjk-punctuation-pairs",
    text: "\u300c\u4f60\u597d\u300d \u300e\u4e16\u754c\u300f",
    whiteSpace: "normal"
  })
)

export const unicodeOverflowFixtures: typeof UnicodeOverflowFixtures.Type = Arr.make(
  new UnicodeOverflowFixture({
    maxWidth: 25,
    name: "url-like-run",
    text: "https://example.com/a-b?x=1,2"
  }),
  new UnicodeOverflowFixture({
    maxWidth: 20,
    name: "numeric-run",
    text: "1,234.56"
  }),
  new UnicodeOverflowFixture({
    maxWidth: 25,
    name: "opening-and-closing-punctuation",
    text: "(hello) [world]"
  }),
  new UnicodeOverflowFixture({
    maxWidth: 20,
    name: "cjk-punctuation-pairs",
    text: "\u300c\u4f60\u597d\u300d \u300e\u4e16\u754c\u300f"
  })
)
