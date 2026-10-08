# digest

- `ContentDigest` owns the runtime/encoded identity; `toString` produces the
  protocol string only at a boundary. Structured identities require an
  owner-selected codec, not a generic unknown-value shortcut.
- Hashing and strict encoding are lazy Effects; pure model accessors remain
  synchronous. Preserve upstream error and requirement channels in streams.
- Canonical JSON follows RFC 8785: finite numbers, valid Unicode, dense arrays,
  own enumerable record keys sorted by UTF-16 code units. Ignore inherited,
  non-enumerable, symbol, and non-element array properties. Use JSON-visible
  reads, not descriptor/prototype inspection; callers keep inputs stable.
- Reject malformed values and cycles without retaining rejected text, keys,
  paths, or preimages in errors. Preserve stack safety, bounded cooperative
  traversal, and no partial output after interruption. Byte limits count emitted
  UTF-8 segments; text-stream offsets are absolute UTF-16 indices.
- Delegate encoding to Schema, not a custom Schema AST interpreter. Preserve
  encoding requirements independently of decoding requirements.
- `scripts/fixtures.ts` owns conformance corpus schemas and loading. Provenance
  lives in `test/fixtures/external/sources.manifest.json`. Load
  `maintaining-fixtures` when changing it; expected vectors must be independent
  of digest and Noble at test execution time.
