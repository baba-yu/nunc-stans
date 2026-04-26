-- Future Prediction Theme Intelligence Schema
-- SQLite-compatible.
-- This schema backs a local/CI analytics pipeline.
-- The GitHub Pages UI consumes exported JSON, not this database directly.

PRAGMA foreign_keys = ON;

-- ============================================================
-- 1. Source files
-- ============================================================

CREATE TABLE IF NOT EXISTS source_files (
  source_file_id TEXT PRIMARY KEY,
  path TEXT NOT NULL UNIQUE,
  file_type TEXT NOT NULL CHECK (file_type IN ('daily_report', 'future_prediction_report', 'other')),
  report_date TEXT,
  content_sha TEXT,
  parsed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_source_files_report_date
ON source_files(report_date);

-- ============================================================
-- 2. Scopes, windows, and categories
-- ============================================================

CREATE TABLE IF NOT EXISTS scopes (
  scope_id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS metric_windows (
  window_id TEXT PRIMARY KEY CHECK (window_id IN ('7d', '30d', '90d')),
  label TEXT NOT NULL,
  days INTEGER NOT NULL CHECK (days IN (7, 30, 90)),
  sort_order INTEGER NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS categories (
  category_id TEXT PRIMARY KEY,
  scope_id TEXT NOT NULL,
  label TEXT NOT NULL,
  short_label TEXT,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT,
  FOREIGN KEY (scope_id) REFERENCES scopes(scope_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_scope_label
ON categories(scope_id, label);

-- ============================================================
-- 3. Evidence items
-- ============================================================

CREATE TABLE IF NOT EXISTS evidence_items (
  evidence_id TEXT PRIMARY KEY,
  url TEXT,
  canonical_url TEXT,
  title TEXT,
  summary TEXT,

  source_name TEXT,
  source_type TEXT CHECK (
    source_type IN (
      'official',
      'vendor_blog',
      'github',
      'security_advisory',
      'news',
      'analysis',
      'social',
      'paper',
      'unknown'
    )
  ) DEFAULT 'unknown',

  first_seen_date TEXT,
  last_seen_date TEXT,

  memory_status TEXT NOT NULL DEFAULT 'cited_today'
    CHECK (memory_status IN ('cited_today', 'active_memory', 'expired_memory')),

  active_until TEXT,

  source_file_id TEXT,
  raw_markdown TEXT,
  raw_json TEXT,

  embedding_model TEXT,
  embedding_version TEXT,
  embedding_json TEXT,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT,

  FOREIGN KEY (source_file_id) REFERENCES source_files(source_file_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_evidence_canonical_url_unique
ON evidence_items(canonical_url)
WHERE canonical_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_evidence_first_seen
ON evidence_items(first_seen_date);

CREATE INDEX IF NOT EXISTS idx_evidence_memory_status
ON evidence_items(memory_status, active_until);

-- ============================================================
-- 4. Themes and subthemes
-- ============================================================

CREATE TABLE IF NOT EXISTS themes (
  theme_id TEXT PRIMARY KEY,
  scope_id TEXT NOT NULL,
  category_id TEXT NOT NULL,

  canonical_label TEXT NOT NULL,
  short_label TEXT,
  generated_label TEXT,
  description TEXT,

  origin_evidence_id TEXT,

  status TEXT NOT NULL DEFAULT 'candidate'
    CHECK (status IN ('candidate', 'active', 'merged', 'retired')),

  merged_into_theme_id TEXT,

  centroid_json TEXT,
  anchor_keywords_json TEXT,
  anchor_examples_json TEXT,

  first_seen_date TEXT,
  last_seen_date TEXT,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT,

  FOREIGN KEY (scope_id) REFERENCES scopes(scope_id),
  FOREIGN KEY (category_id) REFERENCES categories(category_id),
  FOREIGN KEY (origin_evidence_id) REFERENCES evidence_items(evidence_id),
  FOREIGN KEY (merged_into_theme_id) REFERENCES themes(theme_id)
);

CREATE INDEX IF NOT EXISTS idx_themes_scope_category
ON themes(scope_id, category_id);

CREATE INDEX IF NOT EXISTS idx_themes_status
ON themes(status);

CREATE TABLE IF NOT EXISTS subthemes (
  subtheme_id TEXT PRIMARY KEY,
  theme_id TEXT NOT NULL,
  canonical_label TEXT NOT NULL,
  short_label TEXT,
  generated_label TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'candidate'
    CHECK (status IN ('candidate', 'active', 'merged', 'retired')),
  merged_into_subtheme_id TEXT,
  centroid_json TEXT,
  first_seen_date TEXT,
  last_seen_date TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT,
  FOREIGN KEY (theme_id) REFERENCES themes(theme_id),
  FOREIGN KEY (merged_into_subtheme_id) REFERENCES subthemes(subtheme_id)
);

CREATE INDEX IF NOT EXISTS idx_subthemes_theme
ON subthemes(theme_id);

-- ============================================================
-- 5. Theme history and mappings
-- ============================================================

CREATE TABLE IF NOT EXISTS theme_history (
  theme_history_id TEXT PRIMARY KEY,
  theme_id TEXT NOT NULL,

  operation TEXT NOT NULL CHECK (
    operation IN (
      'create',
      'rename',
      'merge',
      'split',
      'move',
      'promote',
      'retire',
      'reactivate',
      'description_update',
      'anchor_update'
    )
  ),

  old_value_json TEXT,
  new_value_json TEXT,
  effective_date TEXT NOT NULL,
  note TEXT,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (theme_id) REFERENCES themes(theme_id)
);

CREATE INDEX IF NOT EXISTS idx_theme_history_theme_date
ON theme_history(theme_id, effective_date);

CREATE TABLE IF NOT EXISTS theme_mappings (
  mapping_id TEXT PRIMARY KEY,
  scope_id TEXT NOT NULL,
  old_theme_id TEXT NOT NULL,
  new_theme_id TEXT NOT NULL,

  mapping_type TEXT NOT NULL CHECK (
    mapping_type IN ('same', 'rename', 'merge', 'split', 'move', 'deprecated')
  ),

  effective_date TEXT NOT NULL,
  similarity REAL,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (scope_id) REFERENCES scopes(scope_id),
  FOREIGN KEY (old_theme_id) REFERENCES themes(theme_id),
  FOREIGN KEY (new_theme_id) REFERENCES themes(theme_id)
);

CREATE INDEX IF NOT EXISTS idx_theme_mappings_old
ON theme_mappings(old_theme_id, effective_date);

CREATE INDEX IF NOT EXISTS idx_theme_mappings_new
ON theme_mappings(new_theme_id, effective_date);

-- ============================================================
-- 6. Predictions
-- ============================================================

CREATE TABLE IF NOT EXISTS predictions (
  prediction_id TEXT PRIMARY KEY,

  prediction_summary TEXT NOT NULL,
  prediction_short_label TEXT,
  prediction_date TEXT,

  source_file_id TEXT,
  source_row_index INTEGER,

  raw_text TEXT,
  raw_json TEXT,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT,

  FOREIGN KEY (source_file_id) REFERENCES source_files(source_file_id)
);

CREATE INDEX IF NOT EXISTS idx_predictions_date
ON predictions(prediction_date);

CREATE TABLE IF NOT EXISTS prediction_scope_assignments (
  prediction_id TEXT NOT NULL,
  scope_id TEXT NOT NULL,

  category_id TEXT,
  theme_id TEXT,
  subtheme_id TEXT,

  assignment_method TEXT DEFAULT 'centroid'
    CHECK (assignment_method IN ('anchor', 'centroid', 'llm', 'manual', 'candidate')),

  assignment_score REAL,
  confidence REAL,

  latest_observed_relevance INTEGER CHECK (latest_observed_relevance BETWEEN 1 AND 5),
  latest_realization_score REAL,
  latest_contradiction_score REAL,

  latest_observation_status TEXT CHECK (
    latest_observation_status IN (
      'supported',
      'weakly_supported',
      'no_signal',
      'mixed',
      'contradicted'
    )
  ),

  embedding_model TEXT,
  embedding_version TEXT,
  embedding_json TEXT,

  assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT,

  PRIMARY KEY (prediction_id, scope_id),

  FOREIGN KEY (prediction_id) REFERENCES predictions(prediction_id),
  FOREIGN KEY (scope_id) REFERENCES scopes(scope_id),
  FOREIGN KEY (category_id) REFERENCES categories(category_id),
  FOREIGN KEY (theme_id) REFERENCES themes(theme_id),
  FOREIGN KEY (subtheme_id) REFERENCES subthemes(subtheme_id)
);

CREATE INDEX IF NOT EXISTS idx_prediction_scope_theme
ON prediction_scope_assignments(scope_id, theme_id);

CREATE INDEX IF NOT EXISTS idx_prediction_scope_category
ON prediction_scope_assignments(scope_id, category_id);

-- ============================================================
-- 7. Evidence assignments and prediction-evidence links
-- ============================================================

CREATE TABLE IF NOT EXISTS evidence_scope_assignments (
  evidence_id TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  category_id TEXT,
  theme_id TEXT,
  subtheme_id TEXT,

  assignment_score REAL,
  confidence REAL,

  assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT,

  PRIMARY KEY (evidence_id, scope_id),

  FOREIGN KEY (evidence_id) REFERENCES evidence_items(evidence_id),
  FOREIGN KEY (scope_id) REFERENCES scopes(scope_id),
  FOREIGN KEY (category_id) REFERENCES categories(category_id),
  FOREIGN KEY (theme_id) REFERENCES themes(theme_id),
  FOREIGN KEY (subtheme_id) REFERENCES subthemes(subtheme_id)
);

CREATE INDEX IF NOT EXISTS idx_evidence_scope_theme
ON evidence_scope_assignments(scope_id, theme_id);

CREATE TABLE IF NOT EXISTS prediction_evidence_links (
  prediction_id TEXT NOT NULL,
  evidence_id TEXT NOT NULL,
  scope_id TEXT NOT NULL,

  support_direction TEXT NOT NULL
    CHECK (support_direction IN ('support', 'contradict', 'neutral')),

  relatedness_score REAL NOT NULL DEFAULT 0,
  evidence_strength REAL NOT NULL DEFAULT 0,
  novelty_score REAL,
  contradiction_score REAL,

  evidence_recency_type TEXT NOT NULL
    CHECK (evidence_recency_type IN ('new', 'continuing')),

  validation_date TEXT NOT NULL,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT,

  PRIMARY KEY (prediction_id, evidence_id, scope_id, validation_date),

  FOREIGN KEY (prediction_id) REFERENCES predictions(prediction_id),
  FOREIGN KEY (evidence_id) REFERENCES evidence_items(evidence_id),
  FOREIGN KEY (scope_id) REFERENCES scopes(scope_id)
);

CREATE INDEX IF NOT EXISTS idx_prediction_evidence_validation
ON prediction_evidence_links(validation_date, scope_id);

CREATE INDEX IF NOT EXISTS idx_prediction_evidence_prediction
ON prediction_evidence_links(prediction_id, scope_id);

-- ============================================================
-- 8. Validation rows and realization snapshots
-- ============================================================

CREATE TABLE IF NOT EXISTS validation_rows (
  validation_row_id TEXT PRIMARY KEY,

  source_file_id TEXT NOT NULL,
  validation_date TEXT NOT NULL,

  prediction_id TEXT,
  prediction_summary TEXT NOT NULL,
  prediction_date TEXT,

  related_items_text TEXT,
  reference_links_json TEXT,

  observed_relevance INTEGER CHECK (observed_relevance BETWEEN 1 AND 5),

  raw_row_markdown TEXT,
  raw_json TEXT,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (source_file_id) REFERENCES source_files(source_file_id),
  FOREIGN KEY (prediction_id) REFERENCES predictions(prediction_id)
);

CREATE INDEX IF NOT EXISTS idx_validation_rows_date
ON validation_rows(validation_date);

CREATE INDEX IF NOT EXISTS idx_validation_rows_prediction
ON validation_rows(prediction_id);

CREATE TABLE IF NOT EXISTS prediction_realization_snapshots (
  prediction_id TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  validation_date TEXT NOT NULL,
  window_id TEXT NOT NULL CHECK (window_id IN ('7d', '30d', '90d')),

  validation_row_id TEXT,

  new_evidence_relevance REAL,
  continuing_evidence_relevance REAL,
  observed_relevance INTEGER CHECK (observed_relevance BETWEEN 1 AND 5),
  realization_score REAL,
  contradiction_score REAL,

  observation_status TEXT CHECK (
    observation_status IN (
      'supported',
      'weakly_supported',
      'no_signal',
      'mixed',
      'contradicted'
    )
  ),

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (prediction_id, scope_id, validation_date, window_id),

  FOREIGN KEY (prediction_id) REFERENCES predictions(prediction_id),
  FOREIGN KEY (scope_id) REFERENCES scopes(scope_id),
  FOREIGN KEY (window_id) REFERENCES metric_windows(window_id),
  FOREIGN KEY (validation_row_id) REFERENCES validation_rows(validation_row_id)
);

CREATE INDEX IF NOT EXISTS idx_prediction_realization_window
ON prediction_realization_snapshots(scope_id, validation_date, window_id);

-- ============================================================
-- 9. Daily activity for themes and subthemes
-- ============================================================

CREATE TABLE IF NOT EXISTS topic_daily_activity (
  activity_id TEXT PRIMARY KEY,

  activity_date TEXT NOT NULL,
  window_id TEXT NOT NULL CHECK (window_id IN ('7d', '30d', '90d')),
  scope_id TEXT NOT NULL,

  category_id TEXT,
  theme_id TEXT NOT NULL,
  subtheme_id TEXT,

  activity_level TEXT NOT NULL CHECK (activity_level IN ('theme', 'subtheme')),

  new_signal REAL NOT NULL DEFAULT 0,
  continuing_signal REAL NOT NULL DEFAULT 0,
  contradiction_signal REAL NOT NULL DEFAULT 0,

  attention_score REAL NOT NULL DEFAULT 0,
  realization_score REAL,
  grass_level INTEGER NOT NULL DEFAULT 0 CHECK (grass_level BETWEEN 0 AND 4),

  new_evidence_count INTEGER NOT NULL DEFAULT 0,
  active_prior_evidence_count INTEGER NOT NULL DEFAULT 0,
  prediction_count INTEGER NOT NULL DEFAULT 0,

  max_observed_relevance INTEGER,
  avg_observed_relevance REAL,

  status TEXT NOT NULL DEFAULT 'dormant'
    CHECK (status IN ('new', 'active', 'continuing', 'dormant', 'contradicted', 'mixed')),

  streak_days INTEGER DEFAULT 0,
  last_active_date TEXT,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT,

  FOREIGN KEY (window_id) REFERENCES metric_windows(window_id),
  FOREIGN KEY (scope_id) REFERENCES scopes(scope_id),
  FOREIGN KEY (category_id) REFERENCES categories(category_id),
  FOREIGN KEY (theme_id) REFERENCES themes(theme_id),
  FOREIGN KEY (subtheme_id) REFERENCES subthemes(subtheme_id),

  CHECK (
    (activity_level = 'theme' AND subtheme_id IS NULL)
    OR
    (activity_level = 'subtheme' AND subtheme_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_topic_daily_theme_activity
ON topic_daily_activity(activity_date, window_id, scope_id, theme_id)
WHERE activity_level = 'theme';

CREATE UNIQUE INDEX IF NOT EXISTS idx_topic_daily_subtheme_activity
ON topic_daily_activity(activity_date, window_id, scope_id, theme_id, subtheme_id)
WHERE activity_level = 'subtheme';

CREATE INDEX IF NOT EXISTS idx_topic_daily_scope_date_window
ON topic_daily_activity(scope_id, activity_date, window_id);

CREATE INDEX IF NOT EXISTS idx_topic_daily_theme_date_window
ON topic_daily_activity(theme_id, activity_date, window_id);

-- ============================================================
-- 10. Category daily activity
-- ============================================================

CREATE TABLE IF NOT EXISTS category_daily_activity (
  category_activity_id TEXT PRIMARY KEY,

  activity_date TEXT NOT NULL,
  window_id TEXT NOT NULL CHECK (window_id IN ('7d', '30d', '90d')),
  scope_id TEXT NOT NULL,
  category_id TEXT NOT NULL,

  attention_score REAL NOT NULL DEFAULT 0,
  realization_score REAL,
  contradiction_signal REAL NOT NULL DEFAULT 0,
  grass_level INTEGER NOT NULL DEFAULT 0 CHECK (grass_level BETWEEN 0 AND 4),

  theme_count INTEGER NOT NULL DEFAULT 0,
  active_theme_count INTEGER NOT NULL DEFAULT 0,
  prediction_count INTEGER NOT NULL DEFAULT 0,

  status TEXT NOT NULL DEFAULT 'dormant'
    CHECK (status IN ('new', 'active', 'continuing', 'dormant', 'contradicted', 'mixed')),

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT,

  FOREIGN KEY (window_id) REFERENCES metric_windows(window_id),
  FOREIGN KEY (scope_id) REFERENCES scopes(scope_id),
  FOREIGN KEY (category_id) REFERENCES categories(category_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_category_daily_unique
ON category_daily_activity(activity_date, window_id, scope_id, category_id);

-- ============================================================
-- 11. Theme candidates
-- ============================================================

CREATE TABLE IF NOT EXISTS theme_candidates (
  candidate_id TEXT PRIMARY KEY,

  scope_id TEXT NOT NULL,
  suggested_category_id TEXT,
  suggested_theme_label TEXT NOT NULL,
  suggested_short_label TEXT,
  suggested_description TEXT,

  origin_evidence_id TEXT,
  origin_prediction_id TEXT,

  candidate_reason TEXT,
  novelty_score REAL,
  nearest_theme_id TEXT,
  nearest_theme_similarity REAL,

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'promoted', 'merged', 'rejected', 'ignored')),

  promoted_theme_id TEXT,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT,

  FOREIGN KEY (scope_id) REFERENCES scopes(scope_id),
  FOREIGN KEY (suggested_category_id) REFERENCES categories(category_id),
  FOREIGN KEY (origin_evidence_id) REFERENCES evidence_items(evidence_id),
  FOREIGN KEY (origin_prediction_id) REFERENCES predictions(prediction_id),
  FOREIGN KEY (nearest_theme_id) REFERENCES themes(theme_id),
  FOREIGN KEY (promoted_theme_id) REFERENCES themes(theme_id)
);

CREATE INDEX IF NOT EXISTS idx_theme_candidates_status
ON theme_candidates(status, scope_id);

-- ============================================================
-- 12. Graph layout and export metadata
-- ============================================================

CREATE TABLE IF NOT EXISTS graph_node_layouts (
  scope_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  node_type TEXT NOT NULL CHECK (node_type IN ('category', 'theme', 'subtheme', 'prediction')),

  x REAL,
  y REAL,
  z REAL,
  radius REAL,
  fixed INTEGER NOT NULL DEFAULT 0,

  layout_version TEXT,
  updated_at TEXT,

  PRIMARY KEY (scope_id, node_id),

  FOREIGN KEY (scope_id) REFERENCES scopes(scope_id)
);

CREATE TABLE IF NOT EXISTS graph_exports (
  export_id TEXT PRIMARY KEY,

  scope_id TEXT NOT NULL,
  window_id TEXT CHECK (window_id IN ('7d', '30d', '90d')),

  output_path TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  generated_at TEXT NOT NULL,

  node_count INTEGER,
  link_count INTEGER,

  date_start TEXT,
  date_end TEXT,

  content_sha TEXT,

  FOREIGN KEY (scope_id) REFERENCES scopes(scope_id),
  FOREIGN KEY (window_id) REFERENCES metric_windows(window_id)
);

CREATE INDEX IF NOT EXISTS idx_graph_exports_scope_window
ON graph_exports(scope_id, window_id, generated_at);

-- ============================================================
-- 13. Embedding run metadata
-- ============================================================

CREATE TABLE IF NOT EXISTS embedding_runs (
  embedding_run_id TEXT PRIMARY KEY,
  embedding_model TEXT NOT NULL,
  embedding_version TEXT,
  scope_id TEXT,
  input_count INTEGER,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TEXT,
  notes TEXT,
  FOREIGN KEY (scope_id) REFERENCES scopes(scope_id)
);

-- ============================================================
-- 14. Seed data
-- ============================================================

INSERT OR IGNORE INTO scopes(scope_id, label, description)
VALUES
  ('tech', 'Technology', 'Technical mechanisms, architecture, models, security, infrastructure, and standards.'),
  ('business', 'Business', 'Market structure, competition, distribution, adoption, regulation, and capital strategy.');

INSERT OR IGNORE INTO metric_windows(window_id, label, days, sort_order, is_default)
VALUES
  ('7d', '7D', 7, 10, 0),
  ('30d', '30D', 30, 20, 1),
  ('90d', '90D', 90, 30, 0);

INSERT OR IGNORE INTO categories(category_id, scope_id, label, short_label, description, sort_order)
VALUES
  ('tech.models', 'tech', 'Models', 'Models', 'Model architecture, training, quantization, open weights, model releases.', 10),
  ('tech.agents', 'tech', 'Agents', 'Agents', 'Agent frameworks, registries, tools, workflows, runtime behavior.', 20),
  ('tech.security', 'tech', 'Security', 'Security', 'Prompt injection, CVEs, sandbox escape, RCE, secrets, supply-chain attacks.', 30),
  ('tech.inference-runtime', 'tech', 'Inference Runtime', 'Runtime', 'Local inference, serving stacks, llama.cpp, vLLM, SGLang, Ollama, MLX, GGUF.', 40),
  ('tech.infrastructure', 'tech', 'Infrastructure', 'Infra', 'GPU, TPU, Trainium, data centers, cloud training and inference systems.', 50),
  ('tech.standards', 'tech', 'Standards', 'Standards', 'MCP, registries, schemas, governance protocols, interoperability.', 60),

  ('business.market-structure', 'business', 'Market Structure', 'Market', 'Industry structure, platform consolidation, hyperscaler/frontier lab alignment.', 10),
  ('business.distribution', 'business', 'Distribution', 'Distribution', 'Cloud versus local, hosted versus open-weight, edge deployment, channel shifts.', 20),
  ('business.competition', 'business', 'Competition', 'Competition', 'Vendor competition, model differentiation, proprietary versus open ecosystems.', 30),
  ('business.enterprise-adoption', 'business', 'Enterprise Adoption', 'Adoption', 'Enterprise usage, procurement, workflow integration, developer tooling.', 40),
  ('business.regulation-compliance', 'business', 'Regulation / Compliance', 'Compliance', 'CVE/CVSS/OWASP, AI regulation, auditability, legal and compliance pressure.', 50),
  ('business.capital-supply-chain', 'business', 'Capital / Supply Chain', 'Capital', 'Compute capex, chip supply, data center commitments, cloud capacity strategy.', 60);

INSERT OR IGNORE INTO themes(theme_id, scope_id, category_id, canonical_label, short_label, generated_label, description, status)
VALUES
  ('tech.one_bit_edge_llm', 'tech', 'tech.models', '1-bit / Edge LLM', '1-bit Edge LLM', '1-bit / Edge LLM',
   '1-bit native training, quantization alternatives, compact local models, Qwen/Llama derivatives, GGUF/MLX deployment.', 'active'),

  ('tech.agent_control_plane', 'tech', 'tech.agents', 'Agent Control Plane', 'Control Plane', 'Agent Control Plane',
   'Agent control plane, agent registry, managed harness, workspace agents, OAuth cross-trust, identity for AI agents, Entra Agent ID, Okta for AI Agents, Keycard, AgentCore, coding agents, Claude Code, Codex, Cursor, Kiro, agent tool permissions, agent lifecycle.', 'active'),

  ('tech.agent_runtime_security', 'tech', 'tech.security', 'Agent Runtime Security', 'Agent Runtime', 'Agent Runtime Security',
   'Prompt injection, sandbox escape, tool misuse, RCE, CVE/CVSS issues in AI agent runtimes.', 'active'),

  ('tech.model_supply_chain', 'tech', 'tech.security', 'Model Supply Chain', 'Model Supply', 'Model Supply Chain',
   'Malicious model files, GGUF supply-chain risk, tokenizer templates, Hugging Face/Ollama/ModelScope distribution risks.', 'active'),

  ('tech.agent_registry_architecture', 'tech', 'tech.standards', 'Agent Registry Architecture', 'Agent Registry', 'Agent Registry Architecture',
   'Registries for skills, tool permissions, audit traces, MCP-adjacent metadata, and agent artifacts.', 'active'),

  ('tech.local_inference_runtime', 'tech', 'tech.inference-runtime', 'Local Inference Runtime', 'Local Runtime', 'Local Inference Runtime',
   'Local inference stacks, llama.cpp, Ollama, MLX, WebGPU, OpenVINO, on-device deployment.', 'active'),

  ('tech.ai_chip_architecture', 'tech', 'tech.infrastructure', 'AI Chip Architecture', 'AI Chips', 'AI Chip Architecture',
   'TPU, Trainium, MAIA, MI300X, training/inference SKU separation, accelerator-specific model behavior.', 'active'),

  ('business.cloud_vs_local_distribution', 'business', 'business.distribution', 'Cloud vs Local AI Distribution', 'Cloud vs Local', 'Cloud vs Local AI Distribution',
   'Shift between cloud-hosted frontier AI and local or edge AI adoption, including privacy, cost, and SMB deployment.', 'active'),

  ('business.hyperscaler_frontier_lab_alliance', 'business', 'business.market-structure', 'Hyperscaler × Frontier Lab Alliance', 'Hyperscaler Alliance', 'Hyperscaler × Frontier Lab Alliance',
   'Exclusive or semi-exclusive alliances between hyperscalers and frontier labs, compute commitments, and platform lock-in.', 'active'),

  ('business.open_weight_vs_proprietary', 'business', 'business.competition', 'Open Weight vs Proprietary AI', 'Open vs Proprietary', 'Open Weight vs Proprietary AI',
   'Open-weight versus hosted-only model dynamics, geopolitical fragmentation, and proprietary frontier model gating.', 'active'),

  ('business.ai_security_compliance_market', 'business', 'business.regulation-compliance', 'AI Security Compliance Market', 'AI Security Compliance', 'AI Security Compliance Market',
   'AI vulnerabilities becoming compliance, CVE/CVSS/OWASP categories, enterprise risk budgets, and security tooling demand.', 'active'),

  ('business.developer_platformization', 'business', 'business.enterprise-adoption', 'Developer Toolchain Platformization', 'Dev Platformization', 'Developer Toolchain Platformization',
   'AI coding tools, CI/CD agents, tool registries, and enterprise developer workflow consolidation.', 'active'),

  ('business.compute_capex_strategy', 'business', 'business.capital-supply-chain', 'Compute Capex Strategy', 'Compute Capex', 'Compute Capex Strategy',
   'AI chip investments, data center capex, accelerator differentiation, and cloud capacity constraints.', 'active');

-- ============================================================
-- 15. Views for exporter
-- ============================================================

CREATE VIEW IF NOT EXISTS v_prediction_assignments AS
SELECT
  p.prediction_id,
  p.prediction_summary,
  p.prediction_short_label,
  p.prediction_date,
  sf.path AS source_report_path,
  psa.scope_id,
  psa.category_id,
  c.label AS category_label,
  c.short_label AS category_short_label,
  psa.theme_id,
  t.canonical_label AS theme_label,
  t.short_label AS theme_short_label,
  psa.subtheme_id,
  st.canonical_label AS subtheme_label,
  st.short_label AS subtheme_short_label,
  psa.assignment_method,
  psa.assignment_score,
  psa.latest_observed_relevance,
  psa.latest_realization_score,
  psa.latest_contradiction_score,
  psa.latest_observation_status
FROM predictions p
JOIN prediction_scope_assignments psa ON p.prediction_id = psa.prediction_id
LEFT JOIN source_files sf ON p.source_file_id = sf.source_file_id
LEFT JOIN categories c ON psa.category_id = c.category_id
LEFT JOIN themes t ON psa.theme_id = t.theme_id
LEFT JOIN subthemes st ON psa.subtheme_id = st.subtheme_id;

CREATE VIEW IF NOT EXISTS v_latest_topic_activity AS
SELECT tda.*
FROM topic_daily_activity tda
JOIN (
  SELECT
    scope_id,
    window_id,
    theme_id,
    activity_level,
    COALESCE(subtheme_id, '') AS subtheme_key,
    MAX(activity_date) AS max_activity_date
  FROM topic_daily_activity
  GROUP BY scope_id, window_id, theme_id, activity_level, COALESCE(subtheme_id, '')
) latest
ON tda.scope_id = latest.scope_id
AND tda.window_id = latest.window_id
AND tda.theme_id = latest.theme_id
AND tda.activity_level = latest.activity_level
AND COALESCE(tda.subtheme_id, '') = latest.subtheme_key
AND tda.activity_date = latest.max_activity_date;

CREATE VIEW IF NOT EXISTS v_latest_category_activity AS
SELECT cda.*
FROM category_daily_activity cda
JOIN (
  SELECT scope_id, window_id, category_id, MAX(activity_date) AS max_activity_date
  FROM category_daily_activity
  GROUP BY scope_id, window_id, category_id
) latest
ON cda.scope_id = latest.scope_id
AND cda.window_id = latest.window_id
AND cda.category_id = latest.category_id
AND cda.activity_date = latest.max_activity_date;
