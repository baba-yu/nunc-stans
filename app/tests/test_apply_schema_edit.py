"""Tests for apply_schema_edit JSON-block parsing + apply paths."""

from __future__ import annotations

import json
import sqlite3
import textwrap
from pathlib import Path

import pytest

from app.skills.apply_schema_edit import (
    _extract_action_json,
    apply_to_schema,
    parse_proposal,
    validate_schema,
)


def test_extract_action_json_with_action_fence():
    item = textwrap.dedent(
        """\
        **Add new theme `tech.foo`**. Some prose.

           ```action
           {
             "kind": "add",
             "theme_id": "tech.foo",
             "category_id": "tech.infrastructure",
             "label_en": "Foo"
           }
           ```
        """
    )
    block = _extract_action_json(item)
    assert block is not None
    assert block["kind"] == "add"
    assert block["theme_id"] == "tech.foo"
    assert block["category_id"] == "tech.infrastructure"


def test_extract_action_json_with_json_fence():
    item = textwrap.dedent(
        """\
        **Rewrite description on `tech.bar`**.

           ```json
           {"kind": "rewrite-description", "theme_id": "tech.bar", "new_description_en": "x"}
           ```
        """
    )
    block = _extract_action_json(item)
    assert block is not None
    assert block["kind"] == "rewrite-description"
    assert block["new_description_en"] == "x"


def test_extract_action_json_missing_block_returns_none():
    item = "**Investigate threshold tuning** (no schema edit)."
    assert _extract_action_json(item) is None


def test_extract_action_json_bad_json_returns_none():
    item = "**Add `x`**.\n\n   ```action\n   not json\n   ```"
    assert _extract_action_json(item) is None


def test_parse_proposal_json_overrides_prose(tmp_path: Path):
    proposal = tmp_path / "theme-review-test.md"
    proposal.write_text(
        textwrap.dedent(
            """\
            # Theme review — week ending 2026-05-10

            ## Recommended actions

            1. **Add new theme `tech.new_one`** under `tech.infrastructure`.

               ```action
               {
                 "kind": "add",
                 "theme_id": "tech.new_one",
                 "category_id": "tech.infrastructure",
                 "label_en": "New One",
                 "short_label_en": "New",
                 "tooltip_en": "New One",
                 "description_en": "First test theme."
               }
               ```

            2. **Investigate something** (no schema edit).
            """
        ),
        encoding="utf-8",
    )
    ops = parse_proposal(proposal)
    assert len(ops) == 2
    assert ops[0].kind == "add"
    assert ops[0].args["theme_id"] == "tech.new_one"
    assert ops[0].args["category_id"] == "tech.infrastructure"
    assert "json_block" in ops[0].args
    assert ops[0].args["json_block"]["description_en"] == "First test theme."
    assert ops[1].kind == "log-only"
    assert "json_block" not in ops[1].args


def test_apply_add_with_json_writes_full_description(tmp_path: Path):
    # Minimal valid schema fixture with a categories + themes seed block.
    schema = tmp_path / "schema.sql"
    schema.write_text(
        textwrap.dedent(
            """\
            CREATE TABLE categories (
              category_id TEXT PRIMARY KEY, scope TEXT, label TEXT, short_label TEXT, description TEXT, sort_order INTEGER
            );
            CREATE TABLE themes (
              theme_id TEXT PRIMARY KEY, scope TEXT, category_id TEXT,
              label TEXT, short_label TEXT, tooltip TEXT,
              description TEXT, status TEXT,
              label_ja TEXT, short_label_ja TEXT, description_ja TEXT,
              label_es TEXT, short_label_es TEXT, description_es TEXT,
              label_fil TEXT, short_label_fil TEXT, description_fil TEXT
            );

            INSERT OR IGNORE INTO categories(category_id, scope, label, short_label, description, sort_order) VALUES
              ('tech.infrastructure', 'tech', 'Infra', 'Infra', 'Infra category.', 1);

            INSERT OR IGNORE INTO themes(theme_id, scope, category_id, label, short_label, tooltip, description, status) VALUES
              ('tech.seed', 'tech', 'tech.infrastructure', 'Seed', 'Seed', 'Seed',
               'Seed theme description.', 'active');

            -- ============================================================
            -- 17. Migration note for ALTER TABLE
            -- ============================================================
            -- (notes)
            """
        ),
        encoding="utf-8",
    )
    proposal = tmp_path / "proposal.md"
    proposal.write_text(
        textwrap.dedent(
            """\
            # Theme review

            ## Recommended actions

            1. **Add new theme `tech.foo`** under `tech.infrastructure`.

               ```action
               {
                 "kind": "add",
                 "theme_id": "tech.foo",
                 "category_id": "tech.infrastructure",
                 "label_en": "Foo Theme",
                 "short_label_en": "Foo",
                 "tooltip_en": "Foo Theme",
                 "description_en": "Foo theme with embedded 'apostrophe' character.",
                 "label_ja": "フー",
                 "short_label_ja": "フー",
                 "label_es": "Foo",
                 "short_label_es": "Foo",
                 "label_fil": "Foo",
                 "short_label_fil": "Foo"
               }
               ```
            """
        ),
        encoding="utf-8",
    )
    ops = parse_proposal(proposal)
    new_text, result = apply_to_schema(schema, ops)
    assert not result.skipped, f"unexpected skips: {result.skipped}"

    # Apostrophe got SQL-escaped (single quote → '')
    assert "Foo theme with embedded ''apostrophe'' character." in new_text
    # Locale UPDATE block was appended before the migration-note marker
    assert "label_ja = 'フー'" in new_text
    assert "WHERE theme_id = 'tech.foo'" in new_text

    # Validate the result actually parses as SQLite.
    schema.write_text(new_text, encoding="utf-8")
    ok, msg = validate_schema(schema)
    assert ok, f"validate failed: {msg}"


def test_apply_rewrite_description_with_json_writes_new_text(tmp_path: Path):
    schema = tmp_path / "schema.sql"
    schema.write_text(
        textwrap.dedent(
            """\
            CREATE TABLE themes (
              theme_id TEXT PRIMARY KEY, scope TEXT, category_id TEXT,
              label TEXT, short_label TEXT, tooltip TEXT,
              description TEXT, status TEXT,
              description_ja TEXT
            );

            INSERT OR IGNORE INTO themes(theme_id, scope, category_id, label, short_label, tooltip, description, status) VALUES
              ('tech.target', 'tech', 'tech.infrastructure', 'Target', 'Target', 'Target',
               'Original description.', 'active');

            UPDATE themes SET
              description_ja = 'ja old'
            WHERE theme_id = 'tech.target';
            """
        ),
        encoding="utf-8",
    )
    proposal = tmp_path / "proposal.md"
    proposal.write_text(
        textwrap.dedent(
            """\
            # Theme review

            ## Recommended actions

            1. **Tighten description on `tech.target`**.

               ```action
               {
                 "kind": "rewrite-description",
                 "theme_id": "tech.target",
                 "new_description_en": "Fresh keyword-rich description.",
                 "new_description_ja": "新しい説明"
               }
               ```
            """
        ),
        encoding="utf-8",
    )
    ops = parse_proposal(proposal)
    new_text, result = apply_to_schema(schema, ops)
    assert not result.skipped

    assert "'Fresh keyword-rich description.'" in new_text
    assert "Original description." not in new_text
    assert "description_ja = '新しい説明'" in new_text
    assert "description_ja = 'ja old'" not in new_text


def test_apply_add_idempotent_refuses_duplicate(tmp_path: Path):
    schema = tmp_path / "schema.sql"
    schema.write_text(
        textwrap.dedent(
            """\
            CREATE TABLE themes (theme_id TEXT);

            INSERT OR IGNORE INTO themes(theme_id) VALUES
              ('tech.existing');
            """
        ),
        encoding="utf-8",
    )
    proposal = tmp_path / "proposal.md"
    proposal.write_text(
        textwrap.dedent(
            """\
            # Theme review

            ## Recommended actions

            1. **Add new theme `tech.existing`**.

               ```action
               {"kind": "add", "theme_id": "tech.existing", "category_id": "tech.x"}
               ```
            """
        ),
        encoding="utf-8",
    )
    ops = parse_proposal(proposal)
    _new, result = apply_to_schema(schema, ops)
    assert len(result.skipped) == 1
    op, reason = result.skipped[0]
    assert "already present" in reason


def test_apply_add_missing_category_id_skips(tmp_path: Path):
    schema = tmp_path / "schema.sql"
    schema.write_text("CREATE TABLE themes (theme_id TEXT);\n", encoding="utf-8")
    proposal = tmp_path / "proposal.md"
    # No JSON block AND no inline category — should skip with clear message.
    proposal.write_text(
        textwrap.dedent(
            """\
            # Theme review

            ## Recommended actions

            1. **Add new theme `tech.noplace`**. No category specified.
            """
        ),
        encoding="utf-8",
    )
    ops = parse_proposal(proposal)
    _new, result = apply_to_schema(schema, ops)
    assert len(result.skipped) == 1
    _op, reason = result.skipped[0]
    assert "missing category_id" in reason
