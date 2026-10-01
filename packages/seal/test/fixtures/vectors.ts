import type { Cipher } from "@scenesystems/seal"
import { Array, Data, Schema } from "effect"

class Vector extends Data.Class<{
  readonly algorithm: Cipher.Algorithm
  readonly key: string
  readonly nonce: string
  readonly plaintext: string
  readonly ciphertext: string
}> {}

// Independently published, no-AAD known answers. Ciphertext includes the tag.
// Wycheproof fixtures at paulmillr/acvp-vectors@56669e07d50cd6b0c19d81a63be2e987dd5beeee:
// wycheproof/testvectors_v1/{aes_gcm_test,xchacha20_poly1305_test}.json.gz, tcId 98 and 36.
// GCM-SIV: RFC 8452 C.2, 8-byte plaintext vector (https://www.rfc-editor.org/rfc/rfc8452#appendix-C.2).
export const vectors = Array.make(
  new Vector({
    algorithm: "aes-256-gcm",
    key: "3b2458d8176e1621c0cc24c0c0e24c1e80d72f7ee9149a4b166176629616d011",
    nonce: "45aaa3e5d16d2d42dc03445d",
    plaintext: "3ff1514b1c503915918f0c0c31094a6e1f",
    ciphertext: "73a6b6f45f6ccc5131e07f2caa1f2e2f562d7379ec1db5952d4e95d30c340b1b1d"
  }),
  new Vector({
    algorithm: "aes-256-gcm-siv",
    key: "0100000000000000000000000000000000000000000000000000000000000000",
    nonce: "030000000000000000000000",
    plaintext: "0100000000000000",
    ciphertext: "c2ef328e5c71c83b843122130f7364b761e0b97427e3df28"
  }),
  new Vector({
    algorithm: "xchacha20-poly1305",
    key: "3b11469dc670f5dfbe0aad7d15ee4862c92cb07842e5dcc48fa8e5fc817f1749",
    nonce: "9a61cf35aecbd40a65b35a64b516896f3de7f977b5c9901d",
    plaintext: "540731e4ba3e4e2fd623a1a13233736ee7",
    ciphertext: "0fd7386b41396e0558495c45cdba02906229f601a11f6a1072342c60b631de6085"
  })
)

export const key = Schema.decodeSync(Schema.Uint8Array)(Array.range(1, 32))
export const plaintext = Schema.decodeSync(Schema.Uint8Array)(Array.make(0, 1, 17, 127, 128, 255, 84, 19, 6))
