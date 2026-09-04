import { Schema } from "effect"

import { WhiteSpaceMode } from "../../src/Text/schema.js"

const UnicodeSegmentationFixture = Schema.Struct({
  expectedBreakKinds: Schema.Array(Schema.String),
  expectedSegments: Schema.Array(Schema.String),
  name: Schema.String,
  text: Schema.String,
  whiteSpace: WhiteSpaceMode
})

const UnicodeOverflowFixture = Schema.Struct({
  maxWidth: Schema.Number,
  name: Schema.String,
  text: Schema.String
})

export const unicodeSegmentationFixtures: ReadonlyArray<typeof UnicodeSegmentationFixture.Type> = [
  {
    expectedBreakKinds: [
      "text",
      "glue",
      "text",
      "space",
      "text",
      "glue",
      "text",
      "space",
      "text",
      "zero-width-break",
      "text"
    ],
    expectedSegments: ["no", "\u00a0", "break", " ", "word", "\u2060", "join", " ", "a", "\u200b", "b"],
    name: "nbsp-wj-zwsp",
    text: "no\u00a0break word\u2060join a\u200bb",
    whiteSpace: "normal"
  },
  {
    expectedBreakKinds: ["text"],
    expectedSegments: ["https://example.com/a-b?x=1,2"],
    name: "url-like-run",
    text: "https://example.com/a-b?x=1,2",
    whiteSpace: "normal"
  },
  {
    expectedBreakKinds: ["text"],
    expectedSegments: ["1,234.56"],
    name: "numeric-run",
    text: "1,234.56",
    whiteSpace: "normal"
  },
  {
    expectedBreakKinds: ["text", "space", "text"],
    expectedSegments: ["(hello)", " ", "[world]"],
    name: "opening-and-closing-punctuation",
    text: "(hello) [world]",
    whiteSpace: "normal"
  },
  {
    expectedBreakKinds: ["text", "space", "text"],
    expectedSegments: ["\u300c\u4f60\u597d\u300d", " ", "\u300e\u4e16\u754c\u300f"],
    name: "cjk-punctuation-pairs",
    text: "\u300c\u4f60\u597d\u300d \u300e\u4e16\u754c\u300f",
    whiteSpace: "normal"
  }
]

export const unicodeOverflowFixtures: ReadonlyArray<typeof UnicodeOverflowFixture.Type> = [
  {
    maxWidth: 25,
    name: "url-like-run",
    text: "https://example.com/a-b?x=1,2"
  },
  {
    maxWidth: 20,
    name: "numeric-run",
    text: "1,234.56"
  },
  {
    maxWidth: 25,
    name: "opening-and-closing-punctuation",
    text: "(hello) [world]"
  },
  {
    maxWidth: 20,
    name: "cjk-punctuation-pairs",
    text: "\u300c\u4f60\u597d\u300d \u300e\u4e16\u754c\u300f"
  }
]
