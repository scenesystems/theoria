use serde::{Deserialize, Serialize};
use sha2::{Digest as _, Sha256};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Deserialize)]
struct ExternalManifest {
    sources: Vec<ExternalSource>,
}

#[derive(Debug, Deserialize)]
struct ExternalSource {
    id: String,
    kind: String,
    #[serde(rename = "fixturePath")]
    fixture_path: String,
}

#[derive(Debug, Deserialize)]
struct HashFixture {
    id: String,
    algorithm: String,
    #[serde(rename = "inputUtf8")]
    input_utf8: String,
}

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

    let package_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../..")
        .canonicalize()
        .map_err(|error| format!("Failed to resolve package root: {error}"))?;

    let external_root = package_root.join("test/fixtures/external");
    let manifest_path = external_root.join("sources.manifest.json");
    let output_path = package_root.join("test/fixtures/parity/generated/rust.json");

    let manifest_content = fs::read_to_string(&manifest_path)
        .map_err(|error| format!("Failed to read manifest {}: {error}", manifest_path.display()))?;
    let manifest: ExternalManifest = serde_json::from_str(&manifest_content)
        .map_err(|error| format!("Failed to parse manifest {}: {error}", manifest_path.display()))?;

    let mut hash_sources = manifest
        .sources
        .into_iter()
        .filter(|source| source.kind == "hash")
        .collect::<Vec<_>>();
    hash_sources.sort_by(|left, right| left.id.cmp(&right.id));

    let mut cases = Vec::with_capacity(hash_sources.len());
    for source in hash_sources {
        let fixture_path = external_root.join(source.fixture_path);
        let fixture_content = fs::read_to_string(&fixture_path).map_err(|error| {
            format!("Failed to read hash fixture {}: {error}", fixture_path.display())
        })?;
        let fixture: HashFixture = serde_json::from_str(&fixture_content).map_err(|error| {
            format!("Failed to parse hash fixture {}: {error}", fixture_path.display())
        })?;

        cases.push(RuntimeParityCase {
            expected_hex: compute_digest(&fixture.algorithm, &fixture.input_utf8)?,
            id: fixture.id,
            algorithm: fixture.algorithm,
            input_utf8: fixture.input_utf8,
        });
    }

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
