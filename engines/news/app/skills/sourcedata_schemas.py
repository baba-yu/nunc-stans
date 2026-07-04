"""Dataclass-based JSON schema validators for ``app/sourcedata/<date>/*.json``.

Spec: ``design/sourcedata-layout.md §JSON schemas (canonical)``.

One dataclass per file type. Each dataclass exposes:

  * ``from_dict(d) -> Self`` — strict validator. Raises
    ``SourcedataValidationError`` with a path-qualified message when the
    incoming dict is missing a required field, has the wrong type, or
    contains an unknown key at a checked level.
  * ``to_dict() -> dict`` — round-trip back to a JSON-serializable shape.

We deliberately avoid the ``jsonschema`` dependency; the schemas are
small enough that hand-rolled validators are clearer for the contributor
debugging a malformed sourcedata file.
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Any


class SourcedataValidationError(ValueError):
    """Raised when a sourcedata JSON dict does not match its schema."""


# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------


def _require(d: dict, key: str, types: tuple[type, ...], path: str) -> Any:
    if not isinstance(d, dict):
        raise SourcedataValidationError(
            f"{path}: expected object, got {type(d).__name__}"
        )
    if key not in d:
        raise SourcedataValidationError(f"{path}: missing required key {key!r}")
    val = d[key]
    if val is not None and not isinstance(val, types):
        names = ", ".join(t.__name__ for t in types)
        raise SourcedataValidationError(
            f"{path}.{key}: expected {names}, got {type(val).__name__}"
        )
    return val


def _optional(d: dict, key: str, types: tuple[type, ...], path: str) -> Any:
    if key not in d:
        return None
    val = d[key]
    if val is None:
        return None
    if not isinstance(val, types):
        names = ", ".join(t.__name__ for t in types)
        raise SourcedataValidationError(
            f"{path}.{key}: expected {names}, got {type(val).__name__}"
        )
    return val


def _require_list(d: dict, key: str, path: str) -> list:
    val = _require(d, key, (list,), path)
    if val is None:
        raise SourcedataValidationError(f"{path}.{key}: must not be null")
    return val


def _require_str(d: dict, key: str, path: str) -> str:
    val = _require(d, key, (str,), path)
    if val is None:
        raise SourcedataValidationError(f"{path}.{key}: must not be null")
    return val


# ---------------------------------------------------------------------------
# predictions.json
# ---------------------------------------------------------------------------


@dataclass
class Reasoning:
    because: str
    given: str
    so_that: str
    landing: str
    plain_language: str  # Maps to predictions.plain_language DB column.

    @classmethod
    def from_dict(cls, d: dict, path: str = "reasoning") -> "Reasoning":
        return cls(
            because=_require_str(d, "because", path),
            given=_require_str(d, "given", path),
            so_that=_require_str(d, "so_that", path),
            landing=_require_str(d, "landing", path),
            plain_language=_require_str(d, "plain_language", path),
        )

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class PredictionEntry:
    id: str
    title: str
    body: str
    reasoning: Reasoning
    summary: str
    scope_hint: str | None = None  # Optional metadata; not persisted to DB.

    @classmethod
    def from_dict(cls, d: dict, path: str = "predictions[]") -> "PredictionEntry":
        if not isinstance(d, dict):
            raise SourcedataValidationError(
                f"{path}: expected object, got {type(d).__name__}"
            )
        reasoning_raw = _require(d, "reasoning", (dict,), path)
        return cls(
            id=_require_str(d, "id", path),
            title=_require_str(d, "title", path),
            body=_require_str(d, "body", path),
            reasoning=Reasoning.from_dict(reasoning_raw, path=f"{path}.reasoning"),
            summary=_require_str(d, "summary", path),
            scope_hint=_optional(d, "scope_hint", (str,), path),
        )

    def to_dict(self) -> dict:
        out: dict = {
            "id": self.id,
            "title": self.title,
            "body": self.body,
            "reasoning": self.reasoning.to_dict(),
            "summary": self.summary,
        }
        if self.scope_hint is not None:
            out["scope_hint"] = self.scope_hint
        return out


@dataclass
class PredictionsFile:
    date: str
    predictions: list[PredictionEntry]

    @classmethod
    def from_dict(cls, d: dict) -> "PredictionsFile":
        path = "predictions.json"
        date = _require_str(d, "date", path)
        preds_raw = _require_list(d, "predictions", path)
        preds = [
            PredictionEntry.from_dict(p, path=f"{path}.predictions[{i}]")
            for i, p in enumerate(preds_raw)
        ]
        return cls(date=date, predictions=preds)

    def to_dict(self) -> dict:
        return {
            "date": self.date,
            "predictions": [p.to_dict() for p in self.predictions],
        }


# ---------------------------------------------------------------------------
# needs.json
# ---------------------------------------------------------------------------


@dataclass
class NeedTask:
    who: str | None = None
    what: str | None = None
    where: str | None = None
    when: str | None = None
    why: str | None = None
    how: str | None = None

    @classmethod
    def from_dict(cls, d: dict, path: str = "task") -> "NeedTask":
        if not isinstance(d, dict):
            raise SourcedataValidationError(
                f"{path}: expected object, got {type(d).__name__}"
            )
        return cls(
            who=_optional(d, "who", (str,), path),
            what=_optional(d, "what", (str,), path),
            where=_optional(d, "where", (str,), path),
            when=_optional(d, "when", (str,), path),
            why=_optional(d, "why", (str,), path),
            how=_optional(d, "how", (str,), path),
        )

    def to_dict(self) -> dict:
        return {k: v for k, v in asdict(self).items() if v is not None}


@dataclass
class NeedEntry:
    actor: str
    job: str
    outcome: str | None = None
    motivation: str | None = None
    task: NeedTask | None = None

    @classmethod
    def from_dict(cls, d: dict, path: str = "needs[]") -> "NeedEntry":
        if not isinstance(d, dict):
            raise SourcedataValidationError(
                f"{path}: expected object, got {type(d).__name__}"
            )
        task_raw = _optional(d, "task", (dict,), path)
        return cls(
            actor=_require_str(d, "actor", path),
            job=_require_str(d, "job", path),
            outcome=_optional(d, "outcome", (str,), path),
            motivation=_optional(d, "motivation", (str,), path),
            task=NeedTask.from_dict(task_raw, path=f"{path}.task")
            if task_raw is not None
            else None,
        )

    def to_dict(self) -> dict:
        out: dict = {"actor": self.actor, "job": self.job}
        if self.outcome is not None:
            out["outcome"] = self.outcome
        if self.motivation is not None:
            out["motivation"] = self.motivation
        if self.task is not None:
            out["task"] = self.task.to_dict()
        return out


@dataclass
class NeedsFile:
    date: str
    by_prediction: dict[str, list[NeedEntry]]

    @classmethod
    def from_dict(cls, d: dict) -> "NeedsFile":
        path = "needs.json"
        date = _require_str(d, "date", path)
        by_pred_raw = _require(d, "by_prediction", (dict,), path)
        if by_pred_raw is None:
            raise SourcedataValidationError(f"{path}.by_prediction: must not be null")
        by_pred: dict[str, list[NeedEntry]] = {}
        for pid, needs_list in by_pred_raw.items():
            sub_path = f"{path}.by_prediction[{pid!r}]"
            if not isinstance(needs_list, list):
                raise SourcedataValidationError(
                    f"{sub_path}: expected list, got {type(needs_list).__name__}"
                )
            by_pred[pid] = [
                NeedEntry.from_dict(n, path=f"{sub_path}[{i}]")
                for i, n in enumerate(needs_list)
            ]
        return cls(date=date, by_prediction=by_pred)

    def to_dict(self) -> dict:
        return {
            "date": self.date,
            "by_prediction": {
                pid: [n.to_dict() for n in needs]
                for pid, needs in self.by_prediction.items()
            },
        }


# ---------------------------------------------------------------------------
# bridges.json
# ---------------------------------------------------------------------------


@dataclass
class ReferenceLink:
    label: str
    url: str

    @classmethod
    def from_dict(cls, d: dict, path: str = "reference_links[]") -> "ReferenceLink":
        if not isinstance(d, dict):
            raise SourcedataValidationError(
                f"{path}: expected object, got {type(d).__name__}"
            )
        return cls(
            label=_require_str(d, "label", path),
            url=_require_str(d, "url", path),
        )

    def to_dict(self) -> dict:
        return {"label": self.label, "url": self.url}


@dataclass
class PredictionRef:
    id: str
    short_label: str
    prediction_date: str

    @classmethod
    def from_dict(cls, d: dict, path: str = "prediction_ref") -> "PredictionRef":
        if not isinstance(d, dict):
            raise SourcedataValidationError(
                f"{path}: expected object, got {type(d).__name__}"
            )
        return cls(
            id=_require_str(d, "id", path),
            short_label=_require_str(d, "short_label", path),
            prediction_date=_require_str(d, "prediction_date", path),
        )

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class Bridge:
    support_dimension: str
    narrative: str
    coherence: int
    remaining_gap: str

    @classmethod
    def from_dict(cls, d: dict, path: str = "bridge") -> "Bridge":
        if not isinstance(d, dict):
            raise SourcedataValidationError(
                f"{path}: expected object, got {type(d).__name__}"
            )
        sd = _require_str(d, "support_dimension", path)
        valid = ("because", "given", "so_that", "landing", "none")
        if sd not in valid:
            raise SourcedataValidationError(
                f"{path}.support_dimension: must be one of {valid}, got {sd!r}"
            )
        coh = _require(d, "coherence", (int,), path)
        if coh is None:
            raise SourcedataValidationError(
                f"{path}.coherence: must not be null"
            )
        return cls(
            support_dimension=sd,
            narrative=_require_str(d, "narrative", path),
            coherence=coh,
            remaining_gap=_require_str(d, "remaining_gap", path),
        )

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class ValidationRowEntry:
    prediction_ref: PredictionRef
    today_relevance: int
    evidence_summary: str
    reference_links: list[ReferenceLink]
    bridge: Bridge

    @classmethod
    def from_dict(
        cls, d: dict, path: str = "validation_rows[]"
    ) -> "ValidationRowEntry":
        if not isinstance(d, dict):
            raise SourcedataValidationError(
                f"{path}: expected object, got {type(d).__name__}"
            )
        pred_ref_raw = _require(d, "prediction_ref", (dict,), path)
        rel = _require(d, "today_relevance", (int,), path)
        if rel is None:
            raise SourcedataValidationError(
                f"{path}.today_relevance: must not be null"
            )
        refs_raw = _require_list(d, "reference_links", path)
        bridge_raw = _require(d, "bridge", (dict,), path)
        return cls(
            prediction_ref=PredictionRef.from_dict(
                pred_ref_raw, path=f"{path}.prediction_ref"
            ),
            today_relevance=rel,
            evidence_summary=_require_str(d, "evidence_summary", path),
            reference_links=[
                ReferenceLink.from_dict(r, path=f"{path}.reference_links[{i}]")
                for i, r in enumerate(refs_raw)
            ],
            bridge=Bridge.from_dict(bridge_raw, path=f"{path}.bridge"),
        )

    def to_dict(self) -> dict:
        return {
            "prediction_ref": self.prediction_ref.to_dict(),
            "today_relevance": self.today_relevance,
            "evidence_summary": self.evidence_summary,
            "reference_links": [r.to_dict() for r in self.reference_links],
            "bridge": self.bridge.to_dict(),
        }


@dataclass
class BridgesFile:
    date: str
    validation_rows: list[ValidationRowEntry]

    @classmethod
    def from_dict(cls, d: dict) -> "BridgesFile":
        path = "bridges.json"
        date = _require_str(d, "date", path)
        rows_raw = _require_list(d, "validation_rows", path)
        rows = [
            ValidationRowEntry.from_dict(r, path=f"{path}.validation_rows[{i}]")
            for i, r in enumerate(rows_raw)
        ]
        return cls(date=date, validation_rows=rows)

    def to_dict(self) -> dict:
        return {
            "date": self.date,
            "validation_rows": [r.to_dict() for r in self.validation_rows],
        }


# ---------------------------------------------------------------------------
# headlines.json
# ---------------------------------------------------------------------------


@dataclass
class TechnicalHeadline:
    lead: str
    body: str
    citations: list[ReferenceLink] = field(default_factory=list)

    @classmethod
    def from_dict(cls, d: dict, path: str = "technical[]") -> "TechnicalHeadline":
        if not isinstance(d, dict):
            raise SourcedataValidationError(
                f"{path}: expected object, got {type(d).__name__}"
            )
        cites_raw = _optional(d, "citations", (list,), path) or []
        return cls(
            lead=_require_str(d, "lead", path),
            body=_require_str(d, "body", path),
            citations=[
                ReferenceLink.from_dict(c, path=f"{path}.citations[{i}]")
                for i, c in enumerate(cites_raw)
            ],
        )

    def to_dict(self) -> dict:
        return {
            "lead": self.lead,
            "body": self.body,
            "citations": [c.to_dict() for c in self.citations],
        }


@dataclass
class HeadlinesFile:
    date: str
    technical: list[TechnicalHeadline]
    plain: list[str]

    @classmethod
    def from_dict(cls, d: dict) -> "HeadlinesFile":
        path = "headlines.json"
        date = _require_str(d, "date", path)
        tech_raw = _require_list(d, "technical", path)
        plain_raw = _require_list(d, "plain", path)
        tech = [
            TechnicalHeadline.from_dict(t, path=f"{path}.technical[{i}]")
            for i, t in enumerate(tech_raw)
        ]
        plain: list[str] = []
        for i, p in enumerate(plain_raw):
            if not isinstance(p, str):
                raise SourcedataValidationError(
                    f"{path}.plain[{i}]: expected str, got {type(p).__name__}"
                )
            plain.append(p)
        return cls(date=date, technical=tech, plain=plain)

    def to_dict(self) -> dict:
        return {
            "date": self.date,
            "technical": [t.to_dict() for t in self.technical],
            "plain": list(self.plain),
        }


# ---------------------------------------------------------------------------
# change_log.json
# ---------------------------------------------------------------------------


@dataclass
class ChangeLogItem:
    kind: str
    headline: str
    diff_narrative: str

    @classmethod
    def from_dict(cls, d: dict, path: str = "items[]") -> "ChangeLogItem":
        if not isinstance(d, dict):
            raise SourcedataValidationError(
                f"{path}: expected object, got {type(d).__name__}"
            )
        kind = _require_str(d, "kind", path)
        valid = ("new", "updated", "continuing")
        if kind not in valid:
            raise SourcedataValidationError(
                f"{path}.kind: must be one of {valid}, got {kind!r}"
            )
        return cls(
            kind=kind,
            headline=_require_str(d, "headline", path),
            diff_narrative=_require_str(d, "diff_narrative", path),
        )

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class ChangeLogFile:
    date: str
    vs_date: str
    items: list[ChangeLogItem]

    @classmethod
    def from_dict(cls, d: dict) -> "ChangeLogFile":
        path = "change_log.json"
        date = _require_str(d, "date", path)
        vs_date = _require_str(d, "vs_date", path)
        items_raw = _require_list(d, "items", path)
        items = [
            ChangeLogItem.from_dict(it, path=f"{path}.items[{i}]")
            for i, it in enumerate(items_raw)
        ]
        return cls(date=date, vs_date=vs_date, items=items)

    def to_dict(self) -> dict:
        return {
            "date": self.date,
            "vs_date": self.vs_date,
            "items": [it.to_dict() for it in self.items],
        }


# ---------------------------------------------------------------------------
# news_section.json
# ---------------------------------------------------------------------------


@dataclass
class NewsBullet:
    body: str
    citations: list[ReferenceLink] = field(default_factory=list)

    @classmethod
    def from_dict(cls, d: dict, path: str = "bullets[]") -> "NewsBullet":
        if not isinstance(d, dict):
            raise SourcedataValidationError(
                f"{path}: expected object, got {type(d).__name__}"
            )
        cites_raw = _optional(d, "citations", (list,), path) or []
        return cls(
            body=_require_str(d, "body", path),
            citations=[
                ReferenceLink.from_dict(c, path=f"{path}.citations[{i}]")
                for i, c in enumerate(cites_raw)
            ],
        )

    def to_dict(self) -> dict:
        return {
            "body": self.body,
            "citations": [c.to_dict() for c in self.citations],
        }


@dataclass
class NewsSection:
    category: str
    bullets: list[NewsBullet]

    @classmethod
    def from_dict(cls, d: dict, path: str = "sections[]") -> "NewsSection":
        if not isinstance(d, dict):
            raise SourcedataValidationError(
                f"{path}: expected object, got {type(d).__name__}"
            )
        bullets_raw = _require_list(d, "bullets", path)
        return cls(
            category=_require_str(d, "category", path),
            bullets=[
                NewsBullet.from_dict(b, path=f"{path}.bullets[{i}]")
                for i, b in enumerate(bullets_raw)
            ],
        )

    def to_dict(self) -> dict:
        return {
            "category": self.category,
            "bullets": [b.to_dict() for b in self.bullets],
        }


@dataclass
class NewsSectionFile:
    date: str
    sections: list[NewsSection]

    @classmethod
    def from_dict(cls, d: dict) -> "NewsSectionFile":
        path = "news_section.json"
        date = _require_str(d, "date", path)
        secs_raw = _require_list(d, "sections", path)
        secs = [
            NewsSection.from_dict(s, path=f"{path}.sections[{i}]")
            for i, s in enumerate(secs_raw)
        ]
        return cls(date=date, sections=secs)

    def to_dict(self) -> dict:
        return {
            "date": self.date,
            "sections": [s.to_dict() for s in self.sections],
        }


# ---------------------------------------------------------------------------
# readings.json (Phase 6.5 — cross-prediction relations + chain edges +
#                cluster pointers)
# ---------------------------------------------------------------------------
#
# Schema source: design/sourcedata-layout.md §JSON schemas (canonical) and
# the canonical Readings stream description in
# design/scheduled/6_weekly_maintenance.md §Cross-stream correlation. The
# DB target tables are ``prediction_chain`` (chain edges) and
# ``prediction_relations`` (semantic relations); ``cluster_pointers`` is
# informational metadata consumed by the export layer (see
# ``app/src/export.py:_build_evidence_cluster_index``) and has no
# dedicated DB column.


@dataclass
class ChainEdge:
    """One ``prediction_chain`` row: source -> downstream, optionally via evidence.

    ``strength`` lives in ``[0, 1]``. ``via_evidence_id`` is the evidence
    item that mediates the chain (nullable when the edge is direct
    semantic implication).
    """

    source_prediction_id: str
    downstream_prediction_id: str
    via_evidence_id: str | None
    strength: float
    notes: str | None

    @classmethod
    def from_dict(cls, d: dict, path: str = "chain_edges[]") -> "ChainEdge":
        if not isinstance(d, dict):
            raise SourcedataValidationError(
                f"{path}: expected object, got {type(d).__name__}"
            )
        strength = _require(d, "strength", (int, float), path)
        if strength is None:
            raise SourcedataValidationError(
                f"{path}.strength: must not be null"
            )
        strength_f = float(strength)
        if not (0.0 <= strength_f <= 1.0):
            raise SourcedataValidationError(
                f"{path}.strength: must be in [0, 1], got {strength_f}"
            )
        return cls(
            source_prediction_id=_require_str(d, "source_prediction_id", path),
            downstream_prediction_id=_require_str(
                d, "downstream_prediction_id", path
            ),
            via_evidence_id=_optional(d, "via_evidence_id", (str,), path),
            strength=strength_f,
            notes=_optional(d, "notes", (str,), path),
        )

    def to_dict(self) -> dict:
        return {
            "source_prediction_id": self.source_prediction_id,
            "downstream_prediction_id": self.downstream_prediction_id,
            "via_evidence_id": self.via_evidence_id,
            "strength": self.strength,
            "notes": self.notes,
        }


@dataclass
class Relation:
    """One ``prediction_relations`` row: structural relation between A and B.

    ``relation_type`` is one of the five canonical values defined in the
    DB schema: ``parallel`` / ``exclusive_variant`` / ``negation`` /
    ``entails`` / ``equivalent``. ``family_id`` groups
    ``exclusive_variant`` rows that share an outcome space; NULL for the
    other relation types. ``prob_mass`` is an optional probability share
    in ``[0, 1]`` for ``exclusive_variant`` rows (the frontend
    normalizes the family to 100% when rendering).
    """

    prediction_a: str
    prediction_b: str
    relation_type: str
    family_id: str | None
    prob_mass: float | None
    notes: str | None

    _VALID_RELATION_TYPES = (
        "parallel",
        "exclusive_variant",
        "negation",
        "entails",
        "equivalent",
    )

    @classmethod
    def from_dict(cls, d: dict, path: str = "relations[]") -> "Relation":
        if not isinstance(d, dict):
            raise SourcedataValidationError(
                f"{path}: expected object, got {type(d).__name__}"
            )
        rt = _require_str(d, "relation_type", path)
        if rt not in cls._VALID_RELATION_TYPES:
            raise SourcedataValidationError(
                f"{path}.relation_type: must be one of "
                f"{cls._VALID_RELATION_TYPES}, got {rt!r}"
            )
        pm_raw = _optional(d, "prob_mass", (int, float), path)
        pm: float | None
        if pm_raw is None:
            pm = None
        else:
            pm = float(pm_raw)
            if not (0.0 <= pm <= 1.0):
                raise SourcedataValidationError(
                    f"{path}.prob_mass: must be in [0, 1], got {pm}"
                )
        return cls(
            prediction_a=_require_str(d, "prediction_a", path),
            prediction_b=_require_str(d, "prediction_b", path),
            relation_type=rt,
            family_id=_optional(d, "family_id", (str,), path),
            prob_mass=pm,
            notes=_optional(d, "notes", (str,), path),
        )

    def to_dict(self) -> dict:
        return {
            "prediction_a": self.prediction_a,
            "prediction_b": self.prediction_b,
            "relation_type": self.relation_type,
            "family_id": self.family_id,
            "prob_mass": self.prob_mass,
            "notes": self.notes,
        }


@dataclass
class ClusterPointer:
    """Per-prediction list of evidence-cluster keys that support it.

    Cluster keys follow the export layer's shape — ``"<theme_id>|<YYYY-Www>"``
    (see ``app/src/export.py:_build_evidence_cluster_index``). The
    Readings tab consumes these pointers when the export layer renders
    the cluster density block; there is no per-prediction DB column for
    them, so the JSON file itself is the source of truth.
    """

    prediction_id: str
    cluster_keys: list[str]

    @classmethod
    def from_dict(
        cls, d: dict, path: str = "cluster_pointers[]"
    ) -> "ClusterPointer":
        if not isinstance(d, dict):
            raise SourcedataValidationError(
                f"{path}: expected object, got {type(d).__name__}"
            )
        keys_raw = _require_list(d, "cluster_keys", path)
        keys: list[str] = []
        for i, k in enumerate(keys_raw):
            if not isinstance(k, str):
                raise SourcedataValidationError(
                    f"{path}.cluster_keys[{i}]: expected str, got "
                    f"{type(k).__name__}"
                )
            keys.append(k)
        return cls(
            prediction_id=_require_str(d, "prediction_id", path),
            cluster_keys=keys,
        )

    def to_dict(self) -> dict:
        return {
            "prediction_id": self.prediction_id,
            "cluster_keys": list(self.cluster_keys),
        }


@dataclass
class ReadingsFile:
    """Day's readings: chain edges + structural relations + cluster pointers.

    Schema is language-agnostic (no locale fields); ``notes`` is the
    only translatable field, and locale fan-out is optional.
    """

    date: str
    chain_edges: list[ChainEdge]
    relations: list[Relation]
    cluster_pointers: list[ClusterPointer]

    @classmethod
    def from_dict(cls, d: dict) -> "ReadingsFile":
        path = "readings.json"
        date = _require_str(d, "date", path)
        edges_raw = _require_list(d, "chain_edges", path)
        rels_raw = _require_list(d, "relations", path)
        cps_raw = _require_list(d, "cluster_pointers", path)
        edges = [
            ChainEdge.from_dict(e, path=f"{path}.chain_edges[{i}]")
            for i, e in enumerate(edges_raw)
        ]
        rels = [
            Relation.from_dict(r, path=f"{path}.relations[{i}]")
            for i, r in enumerate(rels_raw)
        ]
        cps = [
            ClusterPointer.from_dict(c, path=f"{path}.cluster_pointers[{i}]")
            for i, c in enumerate(cps_raw)
        ]
        return cls(
            date=date,
            chain_edges=edges,
            relations=rels,
            cluster_pointers=cps,
        )

    def to_dict(self) -> dict:
        return {
            "date": self.date,
            "chain_edges": [e.to_dict() for e in self.chain_edges],
            "relations": [r.to_dict() for r in self.relations],
            "cluster_pointers": [c.to_dict() for c in self.cluster_pointers],
        }


# ---------------------------------------------------------------------------
# maintenance-candidates.json (Sunday slot 5.5 — 6_weekly_maintenance Step 0)
# ---------------------------------------------------------------------------


@dataclass
class MaintenanceCandidatePrediction:
    prediction_id: str
    change_signals: list[str]
    confidence_drift_score: float

    @classmethod
    def from_dict(
        cls, d: dict, path: str = "predictions[]"
    ) -> "MaintenanceCandidatePrediction":
        if not isinstance(d, dict):
            raise SourcedataValidationError(
                f"{path}: expected object, got {type(d).__name__}"
            )
        signals_raw = _require_list(d, "change_signals", path)
        for i, s in enumerate(signals_raw):
            if not isinstance(s, str):
                raise SourcedataValidationError(
                    f"{path}.change_signals[{i}]: expected str, got "
                    f"{type(s).__name__}"
                )
        score = _require(d, "confidence_drift_score", (int, float), path)
        if score is None:
            raise SourcedataValidationError(
                f"{path}.confidence_drift_score: must not be null"
            )
        return cls(
            prediction_id=_require_str(d, "prediction_id", path),
            change_signals=list(signals_raw),
            confidence_drift_score=float(score),
        )

    def to_dict(self) -> dict:
        return {
            "prediction_id": self.prediction_id,
            "change_signals": list(self.change_signals),
            "confidence_drift_score": self.confidence_drift_score,
        }


@dataclass
class MaintenanceCandidateGlossaryTerm:
    term_id: str
    ttl_expired_days: int

    @classmethod
    def from_dict(
        cls, d: dict, path: str = "glossary_terms[]"
    ) -> "MaintenanceCandidateGlossaryTerm":
        if not isinstance(d, dict):
            raise SourcedataValidationError(
                f"{path}: expected object, got {type(d).__name__}"
            )
        ttl = _require(d, "ttl_expired_days", (int,), path)
        if ttl is None:
            raise SourcedataValidationError(
                f"{path}.ttl_expired_days: must not be null"
            )
        return cls(
            term_id=_require_str(d, "term_id", path),
            ttl_expired_days=ttl,
        )

    def to_dict(self) -> dict:
        return {
            "term_id": self.term_id,
            "ttl_expired_days": self.ttl_expired_days,
        }


@dataclass
class MaintenanceCandidatesFile:
    week_ending: str
    predictions: list[MaintenanceCandidatePrediction]
    glossary_terms: list[MaintenanceCandidateGlossaryTerm]

    @classmethod
    def from_dict(cls, d: dict) -> "MaintenanceCandidatesFile":
        path = "maintenance-candidates.json"
        week_ending = _require_str(d, "week_ending", path)
        preds_raw = _require_list(d, "predictions", path)
        gloss_raw = _require_list(d, "glossary_terms", path)
        preds = [
            MaintenanceCandidatePrediction.from_dict(
                p, path=f"{path}.predictions[{i}]"
            )
            for i, p in enumerate(preds_raw)
        ]
        gloss = [
            MaintenanceCandidateGlossaryTerm.from_dict(
                g, path=f"{path}.glossary_terms[{i}]"
            )
            for i, g in enumerate(gloss_raw)
        ]
        return cls(week_ending=week_ending, predictions=preds, glossary_terms=gloss)

    def to_dict(self) -> dict:
        return {
            "week_ending": self.week_ending,
            "predictions": [p.to_dict() for p in self.predictions],
            "glossary_terms": [g.to_dict() for g in self.glossary_terms],
        }


# ---------------------------------------------------------------------------
# maintenance-judgements.json (Sunday slot 5.5 — 6_weekly_maintenance Step 1)
# ---------------------------------------------------------------------------


@dataclass
class MaintenanceJudgement:
    prediction_id: str
    stream: str  # one of: reasoning|bridge|needs|readings|glossary
    entry_id: str
    verdict: str  # one of: fresh|stale|broken|retire
    reason: str
    cross_stream_evidence: list[str]
    proposed_action: str  # one of: rewrite|retire|noop
    confidence: float

    _VALID_STREAMS = ("reasoning", "bridge", "needs", "readings", "glossary")
    _VALID_VERDICTS = ("fresh", "stale", "broken", "retire")
    _VALID_ACTIONS = ("rewrite", "retire", "noop")

    @classmethod
    def from_dict(
        cls, d: dict, path: str = "judgements[]"
    ) -> "MaintenanceJudgement":
        if not isinstance(d, dict):
            raise SourcedataValidationError(
                f"{path}: expected object, got {type(d).__name__}"
            )
        stream = _require_str(d, "stream", path)
        if stream not in cls._VALID_STREAMS:
            raise SourcedataValidationError(
                f"{path}.stream: must be one of {cls._VALID_STREAMS}, "
                f"got {stream!r}"
            )
        verdict = _require_str(d, "verdict", path)
        if verdict not in cls._VALID_VERDICTS:
            raise SourcedataValidationError(
                f"{path}.verdict: must be one of {cls._VALID_VERDICTS}, "
                f"got {verdict!r}"
            )
        action = _require_str(d, "proposed_action", path)
        if action not in cls._VALID_ACTIONS:
            raise SourcedataValidationError(
                f"{path}.proposed_action: must be one of {cls._VALID_ACTIONS}, "
                f"got {action!r}"
            )
        cse_raw = _require_list(d, "cross_stream_evidence", path)
        for i, c in enumerate(cse_raw):
            if not isinstance(c, str):
                raise SourcedataValidationError(
                    f"{path}.cross_stream_evidence[{i}]: expected str, got "
                    f"{type(c).__name__}"
                )
        conf = _require(d, "confidence", (int, float), path)
        if conf is None:
            raise SourcedataValidationError(
                f"{path}.confidence: must not be null"
            )
        return cls(
            prediction_id=_require_str(d, "prediction_id", path),
            stream=stream,
            entry_id=_require_str(d, "entry_id", path),
            verdict=verdict,
            reason=_require_str(d, "reason", path),
            cross_stream_evidence=list(cse_raw),
            proposed_action=action,
            confidence=float(conf),
        )

    def to_dict(self) -> dict:
        return {
            "prediction_id": self.prediction_id,
            "stream": self.stream,
            "entry_id": self.entry_id,
            "verdict": self.verdict,
            "reason": self.reason,
            "cross_stream_evidence": list(self.cross_stream_evidence),
            "proposed_action": self.proposed_action,
            "confidence": self.confidence,
        }


@dataclass
class MaintenanceJudgementsFile:
    week_ending: str
    judgements: list[MaintenanceJudgement]

    @classmethod
    def from_dict(cls, d: dict) -> "MaintenanceJudgementsFile":
        path = "maintenance-judgements.json"
        week_ending = _require_str(d, "week_ending", path)
        j_raw = _require_list(d, "judgements", path)
        judgements = [
            MaintenanceJudgement.from_dict(j, path=f"{path}.judgements[{i}]")
            for i, j in enumerate(j_raw)
        ]
        return cls(week_ending=week_ending, judgements=judgements)

    def to_dict(self) -> dict:
        return {
            "week_ending": self.week_ending,
            "judgements": [j.to_dict() for j in self.judgements],
        }
