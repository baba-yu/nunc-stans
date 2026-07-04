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
                "self dir {} does not exist — initialize the vault first (Federation:Phase 0 step 7)",
                dir.display()
            );
        }
        fs::create_dir_all(dir.join("me/commitments"))?;
        fs::create_dir_all(dir.join("me/outcomes"))?;
        Ok(Self { dir })
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
    /// file is only ever opened in append mode by this engine (F2).
    pub fn append_edge(&self, edge: &Edge) -> Result<()> {
        let mut line = serde_json::to_string(edge)?;
        line.push('\n');
        let mut f = fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(self.edges_path())?;
        f.write_all(line.as_bytes())?;
        Ok(())
    }

    /// Outcomes are individual append-only files under me/outcomes/<slug>/.
    /// A revision of the felt sense is a new file (supersedes), never an edit.
    pub fn append_outcome(&self, slug: &str, component: &str, doc: &Value) -> Result<String> {
        let dir = self.outcomes_dir().join(slug);
        fs::create_dir_all(&dir)?;
        let seq = fs::read_dir(&dir)?
            .filter_map(|e| e.ok())
            .filter(|e| e.file_name().to_string_lossy().starts_with(component))
            .count()
            + 1;
        let name = format!("{component}-{seq:03}.json");
        let mut f = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(dir.join(&name))?;
        f.write_all(serde_json::to_string_pretty(doc)?.as_bytes())?;
        f.write_all(b"\n")?;
        Ok(name)
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

    /// Best-effort audit commit into the vault's own git history — the
    /// interim audit record (prd-override §1.2). Failure never blocks the
    /// write itself; the caller reports vault_committed to the client.
    pub fn vault_commit(&self, message: &str) -> bool {
        let run = |args: &[&str]| {
            Command::new("git")
                .arg("-C")
                .arg(&self.dir)
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
    fn outcomes_sequence_as_new_files() {
        let (s, dir) = temp_store();
        let a = s.append_outcome("a", "subjective", &json!({"result": "happy"})).unwrap();
        let b = s.append_outcome("a", "subjective", &json!({"result": "unchanged"})).unwrap();
        assert_ne!(a, b); // a revision is a new file, not an edit
        let read = s.list_outcomes("a").unwrap();
        assert_eq!(read.values.len(), 2);
        let _ = fs::remove_dir_all(dir);
    }
}
