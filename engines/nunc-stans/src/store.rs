use std::{
    fs,
    io::Write as _,
    path::PathBuf,
    process::Command,
};

use anyhow::{Context, Result, bail};
use serde_json::Value;

use crate::edge::Edge;

/// File-backed store over the self vault. Everything here is append-only at
/// the API layer: new files are created with create_new (never overwrite),
/// edges.jsonl is only ever opened in append mode, and nothing exposes an
/// edit or delete operation. DB-trigger enforcement arrives with SPL v3.
pub struct SelfStore {
    dir: PathBuf,
}

pub struct LaneRead {
    pub values: Vec<Value>,
    pub malformed: usize,
}

impl SelfStore {
    pub fn open(dir: PathBuf) -> Result<Self> {
        if !dir.is_dir() {
            bail!(
                "self dir {} does not exist — initialize the vault first (Pre-v1 Phase 0 step 7)",
                dir.display()
            );
        }
        fs::create_dir_all(dir.join("me/commitments"))?;
        fs::create_dir_all(dir.join("me/outcomes"))?;
        restrict_permissions(&dir.join("me"));
        Ok(Self { dir })
    }

    /// Verify the vault is safe to write to before the server serves a single
    /// request. The engine is the component that actually writes, so it must
    /// re-check the Phase-0 invariants rather than trust that setup ran:
    ///   - the vault must be its OWN git repo root, so vault_commit's
    ///     `git add -A` can never reach up into an enclosing repository, and
    ///   - it must have no remote (F11): the self source of truth never leaves
    ///     the machine.
    /// Called on the production path (api::router); unit tests that construct a
    /// store directly are exempt.
    pub fn check_vault_safety(&self) -> Result<()> {
        let toplevel = Command::new("git")
            .arg("-C")
            .arg(&self.dir)
            .args(["rev-parse", "--show-toplevel"])
            .output();
        let is_root = match toplevel {
            Ok(out) if out.status.success() => {
                let top = String::from_utf8_lossy(&out.stdout);
                let top = PathBuf::from(top.trim());
                match (top.canonicalize(), self.dir.canonicalize()) {
                    (Ok(a), Ok(b)) => a == b,
                    _ => false,
                }
            }
            _ => false,
        };
        if !is_root {
            bail!(
                "self vault {} is not a git repository root; refusing to start so that \
                 audit commits cannot reach into an enclosing repo (F11). \
                 Run `git init` in the vault directory.",
                self.dir.display()
            );
        }
        let remotes = Command::new("git")
            .arg("-C")
            .arg(&self.dir)
            .arg("remote")
            .output()?;
        if !String::from_utf8_lossy(&remotes.stdout).trim().is_empty() {
            bail!(
                "self vault {} has a git remote; the self source of truth must be \
                 local-only (F11). Remove the remote before starting.",
                self.dir.display()
            );
        }
        Ok(())
    }

    fn commitments_dir(&self) -> PathBuf {
        self.dir.join("me/commitments")
    }
    fn outcomes_dir(&self) -> PathBuf {
        self.dir.join("me/outcomes")
    }
    fn edges_path(&self) -> PathBuf {
        self.dir.join("me/edges.jsonl")
    }

    pub fn commitment_exists(&self, slug: &str) -> bool {
        self.commitments_dir().join(format!("{slug}.json")).exists()
    }

    pub fn list_commitments(&self) -> Result<LaneRead> {
        let mut paths: Vec<PathBuf> = fs::read_dir(self.commitments_dir())?
            .filter_map(|e| e.ok())
            .map(|e| e.path())
            .filter(|p| p.extension().is_some_and(|x| x == "json"))
            .collect();
        paths.sort();
        let mut values = Vec::new();
        let mut malformed = 0;
        for path in paths {
            match fs::read_to_string(&path)
                .ok()
                .and_then(|s| serde_json::from_str::<Value>(&s).ok())
            {
                Some(v) => values.push(v),
                None => {
                    tracing::warn!("skipping malformed commitment {}", path.display());
                    malformed += 1;
                }
            }
        }
        Ok(LaneRead { values, malformed })
    }

    /// Append-only: creates a new file, never overwrites.
    pub fn create_commitment(&self, slug: &str, doc: &Value) -> Result<()> {
        let path = self.commitments_dir().join(format!("{slug}.json"));
        let mut f = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&path)
            .with_context(|| format!("cannot create commitment '{slug}'"))?;
        f.write_all(serde_json::to_string_pretty(doc)?.as_bytes())?;
        f.write_all(b"\n")?;
        restrict_permissions(&path);
        Ok(())
    }

    pub fn read_edges(&self) -> Result<(Vec<Edge>, usize)> {
        let path = self.edges_path();
        if !path.exists() {
            return Ok((Vec::new(), 0));
        }
        let mut edges = Vec::new();
        let mut malformed = 0;
        for line in fs::read_to_string(&path)?.lines() {
            if line.trim().is_empty() {
                continue;
            }
            match serde_json::from_str::<Edge>(line) {
                Ok(e) => edges.push(e),
                Err(err) => {
                    tracing::warn!("skipping malformed edge line: {err}");
                    malformed += 1;
                }
            }
        }
        Ok((edges, malformed))
    }

    /// Append-only: the record and its newline go down in one write; the
    /// file is only ever opened in append mode by this engine (F2). If the
    /// file does not already end in a newline (e.g. a hand edit that dropped
    /// the trailing '\n'), a separator newline is written first so the new
    /// record cannot be concatenated onto — and thereby alter — the previous
    /// line.
    pub fn append_edge(&self, edge: &Edge) -> Result<()> {
        let path = self.edges_path();
        let needs_sep = match fs::read(&path) {
            Ok(bytes) => !bytes.is_empty() && bytes.last() != Some(&b'\n'),
            Err(_) => false,
        };
        let mut line = String::new();
        if needs_sep {
            line.push('\n');
        }
        line.push_str(&serde_json::to_string(edge)?);
        line.push('\n');
        let existed = path.exists();
        let mut f = fs::OpenOptions::new().create(true).append(true).open(&path)?;
        f.write_all(line.as_bytes())?;
        if !existed {
            restrict_permissions(&path);
        }
        Ok(())
    }

    /// Outcomes are individual append-only files under me/outcomes/<slug>/.
    /// A revision of the felt sense is a new file (supersedes), never an edit.
    /// The sequence number is (max existing numeric suffix for this exact
    /// component) + 1, and a collision (e.g. a hand-placed file, or a second
    /// process) is retried rather than surfaced as a 500. Counting entries
    /// would misnumber whenever the files are non-contiguous.
    pub fn append_outcome(&self, slug: &str, component: &str, mut doc: Value) -> Result<String> {
        let dir = self.outcomes_dir().join(slug);
        fs::create_dir_all(&dir)?;
        restrict_permissions(&dir);
        let prefix = format!("{component}-");
        let mut next = fs::read_dir(&dir)?
            .filter_map(|e| e.ok())
            .filter_map(|e| {
                let name = e.file_name().to_string_lossy().into_owned();
                // Exact component match only: "subjective-" must not also
                // count a hypothetical "subjective_extra-".
                let stem = name.strip_suffix(".json")?.strip_prefix(&prefix)?;
                stem.parse::<u32>().ok()
            })
            .max()
            .unwrap_or(0)
            + 1;
        // Retry on EEXIST so a gap (max<count) or a race cannot wedge writes.
        loop {
            let stem = format!("{component}-{next:03}");
            let name = format!("{stem}.json");
            match fs::OpenOptions::new().write(true).create_new(true).open(dir.join(&name)) {
                Ok(mut f) => {
                    // A scope id so a felt-sense revision can point at the
                    // record it supersedes (prd-override §1.1).
                    if let Value::Object(map) = &mut doc {
                        map.insert(
                            "id".into(),
                            Value::String(format!("self/outcome/{slug}/{stem}")),
                        );
                    }
                    f.write_all(serde_json::to_string_pretty(&doc)?.as_bytes())?;
                    f.write_all(b"\n")?;
                    restrict_permissions(&dir.join(&name));
                    return Ok(name);
                }
                Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {
                    next += 1;
                }
                Err(e) => return Err(e.into()),
            }
        }
    }

    pub fn list_outcomes(&self, slug: &str) -> Result<LaneRead> {
        let dir = self.outcomes_dir().join(slug);
        if !dir.is_dir() {
            return Ok(LaneRead { values: Vec::new(), malformed: 0 });
        }
        let mut paths: Vec<PathBuf> = fs::read_dir(&dir)?
            .filter_map(|e| e.ok())
            .map(|e| e.path())
            .collect();
        paths.sort();
        let mut values = Vec::new();
        let mut malformed = 0;
        for path in paths {
            match fs::read_to_string(&path)
                .ok()
                .and_then(|s| serde_json::from_str::<Value>(&s).ok())
            {
                Some(v) => values.push(v),
                None => malformed += 1,
            }
        }
        Ok(LaneRead { values, malformed })
    }

    // --- Generic doc lane (superposition_state; reusable for future lanes) --
    //
    // A doc lane is one create_new json file per record under me/<subdir>/,
    // exactly the commitment shape. Storage stays Value-based (like
    // create_commitment) so the store keeps no compile dependency on the typed
    // record modules; typed validation lives in the module + api.

    fn lane_dir(&self, subdir: &str) -> PathBuf {
        self.dir.join("me").join(subdir)
    }

    /// Append-only doc create under me/<subdir>/<slug>.json (never overwrite).
    pub fn create_doc(&self, subdir: &str, slug: &str, doc: &Value) -> Result<()> {
        let dir = self.lane_dir(subdir);
        fs::create_dir_all(&dir)?;
        restrict_permissions(&dir);
        let path = dir.join(format!("{slug}.json"));
        let mut f = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&path)
            .with_context(|| format!("cannot create {subdir} '{slug}'"))?;
        f.write_all(serde_json::to_string_pretty(doc)?.as_bytes())?;
        f.write_all(b"\n")?;
        restrict_permissions(&path);
        Ok(())
    }

    pub fn doc_exists(&self, subdir: &str, slug: &str) -> bool {
        self.lane_dir(subdir).join(format!("{slug}.json")).exists()
    }

    /// List every well-formed doc in a lane (sorted, malformed skipped). An
    /// unread lane is empty, not an error.
    pub fn list_docs(&self, subdir: &str) -> Result<LaneRead> {
        let dir = self.lane_dir(subdir);
        if !dir.is_dir() {
            return Ok(LaneRead { values: Vec::new(), malformed: 0 });
        }
        let mut paths: Vec<PathBuf> = fs::read_dir(&dir)?
            .filter_map(|e| e.ok())
            .map(|e| e.path())
            .filter(|p| p.extension().is_some_and(|x| x == "json"))
            .collect();
        paths.sort();
        let mut values = Vec::new();
        let mut malformed = 0;
        for path in paths {
            match fs::read_to_string(&path)
                .ok()
                .and_then(|s| serde_json::from_str::<Value>(&s).ok())
            {
                Some(v) => values.push(v),
                None => {
                    tracing::warn!("skipping malformed {subdir} {}", path.display());
                    malformed += 1;
                }
            }
        }
        Ok(LaneRead { values, malformed })
    }

    /// Best-effort audit commit into the vault's own git history — the
    /// interim audit record (prd-override §1.2). Failure never blocks the
    /// write itself; the caller reports vault_committed to the client. The
    /// author identity is pinned per-invocation so the commit succeeds even
    /// where no ambient git identity is configured (fresh machine / CI), and
    /// so the audit trail is attributed to the engine, not the ambient user.
    pub fn vault_commit(&self, message: &str) -> bool {
        let run = |args: &[&str]| {
            Command::new("git")
                .arg("-C")
                .arg(&self.dir)
                .args([
                    "-c",
                    "user.name=nunc-stans-engine",
                    "-c",
                    "user.email=nunc-stans-engine@localhost",
                ])
                .args(args)
                .output()
        };
        match run(&["add", "-A"]).and_then(|_| run(&["commit", "-m", message])) {
            Ok(out) if out.status.success() => true,
            Ok(out) => {
                tracing::warn!("vault commit failed: {}", String::from_utf8_lossy(&out.stderr));
                false
            }
            Err(e) => {
                tracing::warn!("vault commit failed: {e}");
                false
            }
        }
    }
}

/// Tighten permissions on vault files/dirs to owner-only. The self vault is a
/// sovereignty record; its confidentiality should not depend on ambient umask.
/// No-op on non-Unix targets.
fn restrict_permissions(path: &std::path::Path) {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Ok(meta) = fs::metadata(path) {
            let mode = if meta.is_dir() { 0o700 } else { 0o600 };
            let _ = fs::set_permissions(path, fs::Permissions::from_mode(mode));
        }
    }
    #[cfg(not(unix))]
    let _ = path;
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::edge::{Author, Edge, EdgeType};
    use serde_json::json;

    fn temp_store() -> (SelfStore, PathBuf) {
        use std::sync::atomic::{AtomicU32, Ordering};
        static N: AtomicU32 = AtomicU32::new(0);
        let n = N.fetch_add(1, Ordering::Relaxed);
        let dir = std::env::temp_dir().join(format!("ns-test-{}-{n}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        (SelfStore::open(dir.clone()).unwrap(), dir)
    }

    fn edge(id: &str) -> Edge {
        Edge {
            id: id.into(),
            edge_type: EdgeType::Serves,
            from: "self/commitment/a".into(),
            to: "self/prediction/b".into(),
            to_label: "P2".into(),
            from_label: None,
            author: Author::User,
            created_at: "2026-07-04T00:00:00Z".into(),
            note: None,
        }
    }

    #[test]
    fn commitment_create_is_append_only() {
        let (s, dir) = temp_store();
        s.create_commitment("a", &json!({"id": "self/commitment/a"})).unwrap();
        // A second create for the same slug must fail: no overwrite, ever.
        assert!(s.create_commitment("a", &json!({"id": "x"})).is_err());
        assert!(s.commitment_exists("a"));
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn edges_append_and_read_back_skipping_malformed() {
        let (s, dir) = temp_store();
        s.append_edge(&edge("e1")).unwrap();
        // a hand-edit typo in the file must not poison the lane
        fs::OpenOptions::new()
            .append(true)
            .open(s.edges_path())
            .unwrap()
            .write_all(b"not json\n")
            .unwrap();
        s.append_edge(&edge("e2")).unwrap();
        let (edges, malformed) = s.read_edges().unwrap();
        assert_eq!(edges.len(), 2);
        assert_eq!(malformed, 1);
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn append_edge_after_missing_newline_preserves_both() {
        let (s, dir) = temp_store();
        // a hand-written line with NO trailing newline
        let hand = r#"{"id":"hand","type":"serves","from":"self/commitment/a","to":"self/prediction/b","to_label":"P2","author":"user","created_at":"2026-07-04T00:00:00Z"}"#;
        fs::write(s.edges_path(), hand).unwrap(); // no '\n'
        s.append_edge(&edge("e2")).unwrap();
        let (edges, malformed) = s.read_edges().unwrap();
        assert_eq!(malformed, 0, "the engine append must not corrupt the prior line");
        assert_eq!(edges.len(), 2);
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn outcome_seq_survives_gap_without_500() {
        let (s, dir) = temp_store();
        // a hand-placed non-contiguous file (002 with no 001)
        let odir = s.outcomes_dir().join("a");
        fs::create_dir_all(&odir).unwrap();
        fs::write(odir.join("subjective-002.json"), "{}").unwrap();
        // the engine must not collide into EEXIST; it lands at 003
        let name = s.append_outcome("a", "subjective", json!({"result": "happy"})).unwrap();
        assert_eq!(name, "subjective-003.json");
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn outcomes_sequence_as_new_files() {
        let (s, dir) = temp_store();
        let a = s.append_outcome("a", "subjective", json!({"result": "happy"})).unwrap();
        let b = s.append_outcome("a", "subjective", json!({"result": "unchanged"})).unwrap();
        assert_ne!(a, b); // a revision is a new file, not an edit
        let read = s.list_outcomes("a").unwrap();
        assert_eq!(read.values.len(), 2);
        // each outcome carries a scope id for supersedes linkage
        assert!(read.values.iter().all(|v| v["id"].as_str().is_some_and(|s| s.starts_with("self/outcome/a/"))));
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn generic_doc_lane_is_append_only() {
        let (s, dir) = temp_store();
        s.create_doc("superposition_state", "s1", &json!({"id": "self/superposition_state/s1"}))
            .unwrap();
        // No overwrite, ever.
        assert!(s.create_doc("superposition_state", "s1", &json!({"id": "x"})).is_err());
        assert!(s.doc_exists("superposition_state", "s1"));
        let listed = s.list_docs("superposition_state").unwrap();
        assert_eq!(listed.values.len(), 1);
        assert_eq!(listed.values[0]["id"], "self/superposition_state/s1");
        // an unread lane is empty, not an error
        assert_eq!(s.list_docs("nonexistent_lane").unwrap().values.len(), 0);
        let _ = fs::remove_dir_all(dir);
    }
}
