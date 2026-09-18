import { Data } from "effect"
import * as Arr from "effect/Array"

import { Segment, type Segments, type Whitespace } from "../../src/Text.js"

class UnicodeSegmentationFixture extends Data.Class<{
  readonly expected: Segments
  readonly name: string
  readonly text: string
  readonly whiteSpace: Whitespace
}> {}

class UnicodeOverflowFixture extends Data.Class<{
  readonly maxWidth: number
  readonly name: string
  readonly text: string
}> {}

export const unicodeSegmentationFixtures = Arr.make(
  new UnicodeSegmentationFixture({
    expected: Arr.make(
      Segment.make({ kind: "text", text: "no" }),
      Segment.make({ kind: "text", text: "\u00a0" }),
      Segment.make({ kind: "text", text: "break" }),
      Segment.make({ kind: "space", text: " " }),
      Segment.make({ kind: "text", text: "word" }),
      Segment.make({ kind: "text", text: "\u2060" }),
      Segment.make({ kind: "text", text: "join" }),
      Segment.make({ kind: "space", text: " " }),
      Segment.make({ kind: "text", text: "a" }),
      Segment.make({ kind: "text", text: "\u200b" }),
      Segment.make({ kind: "text", text: "b" })
    ),
    name: "nbsp-wj-zwsp",
    text: "no\u00a0break word\u2060join a\u200bb",
    whiteSpace: "normal"
  }),
  new UnicodeSegmentationFixture({
    expected: Arr.of(Segment.make({ kind: "text", text: "https://example.com/a-b?x=1,2" })),
    name: "url-like-run",
    text: "https://example.com/a-b?x=1,2",
    whiteSpace: "normal"
  }),
  new UnicodeSegmentationFixture({
    expected: Arr.of(Segment.make({ kind: "text", text: "1,234.56" })),
    name: "numeric-run",
    text: "1,234.56",
    whiteSpace: "normal"
  }),
  new UnicodeSegmentationFixture({
    expected: Arr.make(
      Segment.make({ kind: "text", text: "(hello)" }),
      Segment.make({ kind: "space", text: " " }),
      Segment.make({ kind: "text", text: "[world]" })
    ),
    name: "opening-and-closing-punctuation",
    text: "(hello) [world]",
    whiteSpace: "normal"
  }),
  new UnicodeSegmentationFixture({
    expected: Arr.make(
      Segment.make({ kind: "text", text: "\u300c\u4f60\u597d\u300d" }),
      Segment.make({ kind: "space", text: " " }),
      Segment.make({ kind: "text", text: "\u300e\u4e16\u754c\u300f" })
    ),
    name: "cjk-punctuation-pairs",
    text: "\u300c\u4f60\u597d\u300d \u300e\u4e16\u754c\u300f",
    whiteSpace: "normal"
  })
)

export const unicodeOverflowFixtures = Arr.make(
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
