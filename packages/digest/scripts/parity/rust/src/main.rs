use serde::Serialize;
use sha2::{Digest as _, Sha256};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize)]
struct RuntimeParityFixture {
    runtime: String,
    #[serde(rename = "generatedAt")]
    generated_at: String,
    cases: Vec<RuntimeParityCase>,
}

#[derive(Debug, Serialize)]
struct RuntimeParityCase {
    id: String,
    algorithm: String,
    #[serde(rename = "inputUtf8")]
    input_utf8: String,
    #[serde(rename = "expectedHex")]
    expected_hex: String,
}

fn compute_digest(algorithm: &str, input_utf8: &str) -> Result<String, String> {
    let payload = input_utf8.as_bytes();

    match algorithm {
        "sha256" => {
            let mut hasher = Sha256::new();
            hasher.update(payload);
            Ok(format!("{:x}", hasher.finalize()))
        }
        "blake3-256" => Ok(blake3::hash(payload).to_hex().to_string()),
        _ => Err(format!("Unsupported digest algorithm: {algorithm}")),
    }
}

fn main() -> Result<(), String> {
    let generated_at = "2026-03-25T00:00:00Z";
    let parity_cases = [
        ("blake3:empty", "blake3-256", ""),
        ("sha256:abc", "sha256", "abc"),
    ];

    let package_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../..")
        .canonicalize()
        .map_err(|error| format!("Failed to resolve package root: {error}"))?;

    let output_path = package_root.join("test/fixtures/parity/generated/rust.json");

    let cases = parity_cases
        .into_iter()
        .map(|(id, algorithm, input_utf8)| {
            Ok(RuntimeParityCase {
                expected_hex: compute_digest(algorithm, input_utf8)?,
                id: id.to_string(),
                algorithm: algorithm.to_string(),
                input_utf8: input_utf8.to_string(),
            })
        })
        .collect::<Result<Vec<_>, String>>()?;

    let output = RuntimeParityFixture {
        runtime: "rust".to_string(),
        generated_at: generated_at.to_string(),
        cases,
    };

    let json =
        serde_json::to_string_pretty(&output).map_err(|error| format!("Failed to encode output: {error}"))?;

    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to create output directory {}: {error}", parent.display()))?;
    }

    fs::write(&output_path, format!("{json}\n"))
        .map_err(|error| format!("Failed to write output {}: {error}", output_path.display()))?;

    Ok(())
}
