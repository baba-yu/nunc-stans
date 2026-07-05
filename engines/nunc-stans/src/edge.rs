use serde::{Deserialize, Serialize};

/// Mirrors contracts/edge.schema.json (draft-07). The contract is the source
/// of truth; this struct must stay in sync with it, not the other way round.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Edge {
    pub id: String,
    #[serde(rename = "type")]
    pub edge_type: EdgeType,
    pub from: String,
    pub to: String,
    /// Required by the contract: cross-scope FKs cannot be drawn, so the
    /// label stands in when the target store is unavailable (F2).
    pub to_label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub from_label: Option<String>,
    pub author: Author,
    pub created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EdgeType {
    InformedBy,
    Serves,
    Produced,
    Closes,
    Supersedes,
    Dismisses,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Author {
    User,
    Ai,
    Sensor,
}

/// The contract's `^(world|self|artifact)/[a-z_]+/.+` without a regex dep.
pub fn valid_federation_id(s: &str) -> bool {
    let mut parts = s.splitn(3, '/');
    let (Some(scope), Some(typ), Some(rest)) = (parts.next(), parts.next(), parts.next()) else {
        return false;
    };
    matches!(scope, "world" | "self" | "artifact")
        && !typ.is_empty()
        && typ.chars().all(|c| c.is_ascii_lowercase() || c == '_')
        && !rest.is_empty()
}

impl Edge {
    pub fn validate(&self) -> Result<(), String> {
        if self.id.trim().is_empty() {
            return Err("id must be non-empty".into());
        }
        if self.to_label.trim().is_empty() {
            return Err("to_label must be non-empty (fallback display depends on it)".into());
        }
        if !valid_federation_id(&self.from) {
            return Err(format!(
                "from '{}' is not a federation id (<scope>/<type>/<original-id>)",
                self.from
            ));
        }
        if !valid_federation_id(&self.to) {
            return Err(format!(
                "to '{}' is not a federation id (<scope>/<type>/<original-id>)",
                self.to
            ));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn federation_id_pattern_matches_contract() {
        assert!(valid_federation_id("self/commitment/2025-08-gpu-server"));
        assert!(valid_federation_id("world/prediction/x"));
        assert!(valid_federation_id("artifact/app_version/runway-tracker@v1"));
        assert!(valid_federation_id("self/prediction/a/b")); // `.+` may contain slashes
        assert!(!valid_federation_id("news/item/x")); // unknown scope
        assert!(!valid_federation_id("self/Commitment/x")); // uppercase type
        assert!(!valid_federation_id("self/commitment/")); // empty original-id
        assert!(!valid_federation_id("self")); // too few segments
    }

    #[test]
    fn edge_roundtrips_vault_line() {
        let line = r#"{"id":"e1","type":"serves","from":"self/commitment/a","to":"self/prediction/b","to_label":"P2","author":"user","created_at":"2026-07-04T00:00:00Z"}"#;
        let e: Edge = serde_json::from_str(line).unwrap();
        assert_eq!(e.edge_type, EdgeType::Serves);
        assert_eq!(e.author, Author::User);
        assert!(e.validate().is_ok());
        let out = serde_json::to_string(&e).unwrap();
        assert!(out.contains(r#""type":"serves""#));
        assert!(!out.contains("from_label")); // absent optionals stay absent
    }

    #[test]
    fn edge_rejects_unknown_fields_per_contract() {
        // additionalProperties: false
        let line = r#"{"id":"e1","type":"serves","from":"self/commitment/a","to":"self/prediction/b","to_label":"P2","author":"user","created_at":"2026-07-04T00:00:00Z","weight":1}"#;
        assert!(serde_json::from_str::<Edge>(line).is_err());
    }

    #[test]
    fn empty_to_label_fails_validation() {
        let line = r#"{"id":"e1","type":"serves","from":"self/commitment/a","to":"self/prediction/b","to_label":" ","author":"user","created_at":"2026-07-04T00:00:00Z"}"#;
        let e: Edge = serde_json::from_str(line).unwrap();
        assert!(e.validate().is_err());
    }
}
