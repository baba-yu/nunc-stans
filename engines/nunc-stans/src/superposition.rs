//! The superposition_state lane — the AI's understanding of the user's
//! strategy, saved as grounds for a decision (Phase F, lane F-3).
//!
//! prd-override §1.5 / constitution §3 / journey T11: the AI's understanding
//! is NOT given a new location — it reuses SPL's `superposition_state`
//! (transparent / versioned / user-dismissable) and holds an `informed_by`
//! edge to the app it read (`artifact/artifact_version/<slug>@v<N>`). A
//! cross-scope FK cannot be drawn, so the edge carries the target id as text
//! plus a `to_label` (the treatment every edge gets). This is the save-path
//! behind FourFive's `/strategy` card: the card is ephemeral until the user
//! saves it here, turning a read-out into grounds (F9 world→self provenance
//! becomes the working loop).
//!
//! `grounding[]` lists the declared app-metric names the read-out rests on.
//! "no metric the app does not measure" (check 10 / journey T11) is enforced
//! at GENERATION time — FourFive's `parseStrategyCard`, which knows the
//! declared list and refuses an undeclared grounding. The engine has no
//! cross-scope metric read, so it stores `grounding[]` for audit and enforces
//! only what it can see: that `informed_by` names a well-formed artifact.

use serde::{Deserialize, Serialize};

use crate::edge::{Author, valid_scope_id};

/// The self-scope node type token. Matches constitution §3 (`superposition_state`)
/// and the scope-id contract; the id is `self/superposition_state/<original-id>`.
pub const NODE_TYPE: &str = "superposition_state";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Superposition {
    /// scope id: `self/superposition_state/<original-id>`.
    pub id: String,
    /// The three read-out fields (PE12 / journey T11).
    pub win: String,
    pub constraint: String,
    pub risk_to_watch: String,
    /// The declared metric names this understanding is grounded in
    /// (grounding ⊆ declared enforced upstream at generation time). Non-empty.
    pub grounding: Vec<String>,
    /// The artifact this understanding reads: `artifact/artifact_version/<slug>@v<N>`.
    /// The `informed_by` EDGE drawn on save is the canonical link (§10-A); this
    /// field is the record's own copy of the target for convenience/audit.
    pub informed_by: String,
    /// Degradable label for the informed_by edge (survives id breakage; §10-A).
    pub informed_by_label: String,
    pub author: Author,
    pub created_at: String,
    /// The prior superposition_state id this version supersedes (a versioned
    /// chain — updates never edit, they append).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub supersedes: Option<String>,
    /// When re-authored after a close, the close content that prompted the
    /// update (prd-override §1.5 — evidence the loop is turning).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cites_close: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
}

impl Superposition {
    pub fn validate(&self) -> Result<(), String> {
        if self.author != Author::Ai {
            return Err(
                "a superposition_state (strategy understanding) is authored by the ai; \
                 the user reads and dismisses it"
                    .into(),
            );
        }
        if self.win.trim().is_empty()
            || self.constraint.trim().is_empty()
            || self.risk_to_watch.trim().is_empty()
        {
            return Err("win, constraint, and risk_to_watch must all be non-empty".into());
        }
        if self.grounding.is_empty() || self.grounding.iter().any(|g| g.trim().is_empty()) {
            return Err(
                "grounding must name at least one declared app metric (an ungrounded \
                 read-out is not a reading of the app — check 10)"
                    .into(),
            );
        }
        if !self.informed_by.starts_with("artifact/") || !valid_scope_id(&self.informed_by) {
            return Err(format!(
                "informed_by '{}' must be an artifact scope id \
                 (artifact/artifact_version/<slug>@v<N>)",
                self.informed_by
            ));
        }
        if self.informed_by_label.trim().is_empty() {
            return Err("informed_by_label must be non-empty (fallback display, F1/§10-A)".into());
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn base() -> Superposition {
        Superposition {
            id: "self/superposition_state/s1".into(),
            win: "external income ¥200k/month".into(),
            constraint: "do not fall below 12 months of runway".into(),
            risk_to_watch: "concentration of dependence".into(),
            grounding: vec![
                "monthly_external_income".into(),
                "cash_runway".into(),
                "income_concentration".into(),
            ],
            informed_by: "artifact/artifact_version/runway-tracker@v1".into(),
            informed_by_label: "runway-tracker@v1".into(),
            author: Author::Ai,
            created_at: "2026-02-01T00:00:00Z".into(),
            supersedes: None,
            cites_close: None,
            note: None,
        }
    }

    #[test]
    fn valid_superposition_passes() {
        assert!(base().validate().is_ok());
    }

    #[test]
    fn user_authored_understanding_refused() {
        let mut s = base();
        s.author = Author::User;
        assert!(s.validate().is_err());
    }

    #[test]
    fn informed_by_must_be_artifact() {
        let mut s = base();
        s.informed_by = "self/commitment/x".into();
        assert!(s.validate().is_err());
        s.informed_by = "artifact/artifact_version/runway-tracker@v1".into();
        assert!(s.validate().is_ok());
    }

    #[test]
    fn grounding_required() {
        let mut s = base();
        s.grounding.clear();
        assert!(s.validate().is_err());
    }

    #[test]
    fn empty_readout_fields_refused() {
        let mut s = base();
        s.win = "  ".into();
        assert!(s.validate().is_err());
    }
}
