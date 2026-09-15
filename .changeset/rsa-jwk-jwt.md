---
"@scenesystems/sign": minor
---

Add `rsaPublicKeyFromJwk` and `rsaSha256Verify` for canonical public JWK import and RSASSA-PKCS1-v1_5 SHA-256 verification. Support 2048–4096-bit moduli, odd public exponents from 3 through 2³²−1, and messages up to 8192 bytes. Invalid input and backend unavailability have distinct, material-free failures; an admitted nonmatch returns `false`.

Add `Jwt.verifyRs256` with unique key selection, explicit issuer/audience/lifetime policy, and Effect Clock validation. Issuance and not-before are inclusive; expiry is exclusive, with no clock skew. Application claim Schemas run after authentication and preserve requirements and interruption. Callers own JWKS trust and authorization policy; retain integer Schema refinements when fractional NumericDates are not permitted.

Add independent Wycheproof and OpenSSL coverage, including signed Access-policy fixtures. The new RSA composition uses existing public Noble primitives but is not covered by Noble's dependency audits; no production RSA signer is added.
