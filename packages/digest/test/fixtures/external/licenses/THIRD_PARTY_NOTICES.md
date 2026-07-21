# Third-party fixture notices

These notices cover the external and generated conformance fixtures vendored for Digest Commit 10. The normalized fixture transformations and exclusions, together with the authoritative local content hashes, are recorded in [`../sources.manifest.json`](../sources.manifest.json).

## Repository test vectors

- **JSON Canonicalization testdata** — Copyright 2018 Anders Rundgren. Licensed under [Apache-2.0](Apache-2.0.txt). Source: `cyberphone/json-canonicalization` commit [`19d51d7fe467d4706a3ff08adf8a748f29fc21e0`](https://github.com/cyberphone/json-canonicalization/tree/19d51d7fe467d4706a3ff08adf8a748f29fc21e0), path `testdata/`. The repository-level Apache-2.0 license applies to that testdata; there is no `NOTICE` file at this pin.
- **Wycheproof HKDF-SHA512 vectors** — Licensed under [Apache-2.0](Apache-2.0.txt). Source: `C2SP/wycheproof` commit [`e0df04e0c033f2d25c5051dd06230336c7822358`](https://github.com/C2SP/wycheproof/tree/e0df04e0c033f2d25c5051dd06230336c7822358), path `testvectors_v1/hkdf_sha512_test.json`. There is no `NOTICE` file at this pin.
- **BLAKE3 official vectors** — Upstream offers CC0-1.0, Apache-2.0, or Apache-2.0 WITH LLVM-exception; this fixture selects [CC0-1.0](CC0-1.0.txt). Source: `BLAKE3-team/BLAKE3` commit [`8aa5145039b972ba30e98e788752d37d14568824`](https://github.com/BLAKE3-team/BLAKE3/tree/8aa5145039b972ba30e98e788752d37d14568824), path `test_vectors/test_vectors.json`. There is no `NOTICE` file at this pin.

The Apache-2.0 text reproduced here is byte-for-byte the Wycheproof license at its pin. The cyberphone repository's pin uses the same Apache License, Version 2.0, with its copyright notice and license application notice in its repository `LICENSE`.

## RFC extracts

- **RFC 2202**, Section 3 (`rfc2202/hmac-sha1.json`): Copyright © 1997 The Internet Society; the RFC states that distribution is unlimited. Immutable RFC Editor document: [RFC 2202](https://www.rfc-editor.org/rfc/rfc2202.txt).
- **RFC 4231**, Section 4 (`rfc4231/hmac-sha256.json`): Copyright © 2005 The Internet Society; the RFC states that it is subject to the rights, licenses, and restrictions in BCP 78, except as set forth in that RFC. Immutable RFC Editor document: [RFC 4231](https://www.rfc-editor.org/rfc/rfc4231.txt).
- **RFC 5869**, Appendix A (`rfc5869/hkdf-sha256.json`): Copyright © 2010 IETF Trust and the persons identified as the document authors; the RFC is subject to BCP 78 and the IETF Trust Legal Provisions in effect on its publication date, and extracted code components are under the Simplified BSD License stated in those provisions. Immutable RFC Editor document: [RFC 5869](https://www.rfc-editor.org/rfc/rfc5869.txt).
- **RFC 8785**, Sections 3.2.2 through 3.2.3 and Appendix B (`rfc8785/canonicalization.json` and local malformed-Unicode cases): Copyright © 2020 IETF Trust and the persons identified as the document authors; the RFC is subject to BCP 78 and the IETF Trust Legal Provisions in effect on its publication date, and extracted code components are under the Simplified BSD License stated in those provisions. Immutable RFC Editor document: [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785.txt).

Current and historical IETF Trust copyright and license information is available from the [IETF Trust Legal Provisions](https://trustee.ietf.org/license-info/). No standalone IETF license text is reproduced here.

## NIST CAVP vectors

The SHA-256 short-message fixture derives from the NIST Cryptographic Algorithm Validation Program archive [`shabytetestvectors.zip`](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Algorithm-Validation-Program/documents/shs/shabytetestvectors.zip), archive SHA-256 `929ef80b7b3418aca026643f6f248815913b60e01741a44bba9e118067f4c9b8`, internal path `shabytetestvectors/SHA256ShortMsg.rsp`. NIST works are generally not subject to copyright in the United States under 17 U.S.C. § 105; see NIST's [Copyrights, fair use, and licensing statements for SRD, data, and software](https://www.nist.gov/open/copyrights-fair-use-and-licensing-statements-srd-data-and-software).

Use of these vectors does not constitute or replace NIST CAVP validation. No claim of CAVP validation is made for Theoria or for an implementation merely because it passes these fixtures.

## Generated parity outputs

The Python and Rust parity outputs are generated within the MIT-licensed [Theoria repository](https://github.com/scenesystems/theoria) from pinned, independent Python and Rust runtimes. Their exact generator and dependency pins are recorded in [`../sources.manifest.json`](../sources.manifest.json).
