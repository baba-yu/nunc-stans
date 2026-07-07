BEGIN TRANSACTION;
CREATE TABLE categories (
  category_id TEXT PRIMARY KEY,
  scope_id TEXT NOT NULL,
  label TEXT NOT NULL,
  short_label TEXT,
  description TEXT,
  -- Locale columns: NULL means "fall back to the canonical English value".
  label_ja TEXT,
  label_es TEXT,
  label_fil TEXT,
  short_label_ja TEXT,
  short_label_es TEXT,
  short_label_fil TEXT,
  description_ja TEXT,
  description_es TEXT,
  description_fil TEXT,
  sort_order INTEGER DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT,
  FOREIGN KEY (scope_id) REFERENCES scopes(scope_id)
);
INSERT INTO "categories" VALUES('tech.models','tech','Models','Models','Model architecture, training, quantization, open weights, model releases.','モデル','Modelos','Mga Modelo','モデル','Modelos','Mga Modelo','モデルアーキテクチャ、学習、量子化、オープン重み、モデルリリース。','Arquitectura, entrenamiento, cuantización, pesos abiertos y lanzamientos de modelos.','Arkitektura, pagsasanay, quantization, open weights, at paglabas ng mga modelo.',10,1,'1970-01-01 00:00:00',NULL);
INSERT INTO "categories" VALUES('tech.agents','tech','Agents','Agents','Agent frameworks, registries, tools, workflows, runtime behavior.','エージェント','Agentes','Mga Ahente','エージェント','Agentes','Mga Ahente','エージェント基盤、レジストリ、ツール、ワークフロー、ランタイム挙動。','Marcos de agentes, registros, herramientas, flujos de trabajo y comportamiento en tiempo de ejecución.','Mga framework, registry, tools, workflows, at runtime ng mga ahente.',20,1,'1970-01-01 00:00:00',NULL);
INSERT INTO "categories" VALUES('tech.security','tech','Security','Security','Prompt injection, CVEs, sandbox escape, RCE, secrets, supply-chain attacks.','セキュリティ','Seguridad','Seguridad','セキュリティ','Seguridad','Seguridad','プロンプトインジェクション、CVE、サンドボックス脱出、RCE、シークレット、サプライチェーン攻撃。','Inyección de prompts, CVE, escape de sandbox, RCE, secretos y ataques a la cadena de suministro.','Prompt injection, CVE, sandbox escape, RCE, secrets, at supply-chain attacks.',30,1,'1970-01-01 00:00:00',NULL);
INSERT INTO "categories" VALUES('tech.inference-runtime','tech','Inference Runtime','Runtime','Local inference, serving stacks, llama.cpp, vLLM, SGLang, Ollama, MLX, GGUF.','推論ランタイム','Tiempo de ejecución','Inference Runtime','ランタイム','Runtime','Runtime','ローカル推論、サービングスタック、llama.cpp、vLLM、SGLang、Ollama、MLX、GGUF。','Inferencia local, stacks de servicio, llama.cpp, vLLM, SGLang, Ollama, MLX, GGUF.','Lokal na inference, serving stacks, llama.cpp, vLLM, SGLang, Ollama, MLX, GGUF.',40,1,'1970-01-01 00:00:00',NULL);
INSERT INTO "categories" VALUES('tech.infrastructure','tech','Infrastructure','Infra','GPU, TPU, Trainium, data centers, cloud training and inference systems.','インフラ','Infraestructura','Imprastraktura','インフラ','Infra','Infra','GPU、TPU、Trainium、データセンター、クラウド学習・推論システム。','GPU, TPU, Trainium, centros de datos, sistemas de entrenamiento e inferencia en la nube.','GPU, TPU, Trainium, data centers, cloud training at inference systems.',50,1,'1970-01-01 00:00:00',NULL);
INSERT INTO "categories" VALUES('tech.standards','tech','Standards','Standards','MCP, registries, schemas, governance protocols, interoperability.','標準','Estándares','Mga Pamantayan','標準','Estándares','Pamantayan','MCP、レジストリ、スキーマ、ガバナンスプロトコル、相互運用性。','MCP, registros, esquemas, protocolos de gobernanza e interoperabilidad.','MCP, registries, schemas, governance protocols, interoperability.',60,1,'1970-01-01 00:00:00',NULL);
INSERT INTO "categories" VALUES('business.market-structure','business','Market Structure','Market','Industry structure, platform consolidation, hyperscaler/frontier lab alignment.','市場構造','Estructura de mercado','Istruktura ng Merkado','市場','Mercado','Merkado','産業構造、プラットフォーム集約、ハイパースケーラ／フロンティアラボ提携。','Estructura de la industria, consolidación de plataformas y alianzas hyperscaler/laboratorios frontier.','Istruktura ng industriya, platform consolidation, hyperscaler/frontier lab alignment.',10,1,'1970-01-01 00:00:00',NULL);
INSERT INTO "categories" VALUES('business.distribution','business','Distribution','Distribution','Cloud versus local, hosted versus open-weight, edge deployment, channel shifts.','配信','Distribución','Distribusyon','配信','Distribución','Distribusyon','クラウド対ローカル、ホスト型対オープン重み、エッジ展開、チャネルシフト。','Nube vs local, hospedado vs pesos abiertos, despliegue en el edge, cambios de canal.','Cloud vs local, hosted vs open-weight, edge deployment, channel shifts.',20,1,'1970-01-01 00:00:00',NULL);
INSERT INTO "categories" VALUES('business.competition','business','Competition','Competition','Vendor competition, model differentiation, proprietary versus open ecosystems.','競争','Competencia','Kompetisyon','競争','Competencia','Kompetisyon','ベンダー競争、モデル差別化、プロプライエタリ対オープンエコシステム。','Competencia entre proveedores, diferenciación de modelos, ecosistemas propietarios vs abiertos.','Kompetisyon ng vendor, pagkakaiba ng modelo, proprietary vs open ecosystems.',30,1,'1970-01-01 00:00:00',NULL);
INSERT INTO "categories" VALUES('business.enterprise-adoption','business','Enterprise Adoption','Adoption','Enterprise usage, procurement, workflow integration, developer tooling.','エンタープライズ採用','Adopción empresarial','Adopsyon ng Enterprise','採用','Adopción','Adopsyon','エンタープライズ利用、調達、ワークフロー統合、開発者ツーリング。','Uso empresarial, adquisición, integración de flujos de trabajo y herramientas de desarrollo.','Paggamit sa enterprise, procurement, workflow integration, developer tooling.',40,1,'1970-01-01 00:00:00',NULL);
INSERT INTO "categories" VALUES('business.regulation-compliance','business','Regulation / Compliance','Compliance','CVE/CVSS/OWASP, AI regulation, auditability, legal and compliance pressure.','規制／コンプライアンス','Regulación / Cumplimiento','Regulasyon / Pagsunod','コンプラ','Cumplimiento','Pagsunod','CVE/CVSS/OWASP、AI規制、監査可能性、法務およびコンプライアンス圧力。','CVE/CVSS/OWASP, regulación de IA, auditabilidad, presión legal y de cumplimiento.','CVE/CVSS/OWASP, regulasyon ng AI, auditability, legal at compliance pressure.',50,1,'1970-01-01 00:00:00',NULL);
INSERT INTO "categories" VALUES('business.capital-supply-chain','business','Capital / Supply Chain','Capital','Compute capex, chip supply, data center commitments, cloud capacity strategy.','資本／サプライチェーン','Capital / Cadena de suministro','Kapital / Supply Chain','資本','Capital','Kapital','計算資源 capex、チップ供給、データセンター契約、クラウド容量戦略。','Capex de cómputo, suministro de chips, compromisos de centros de datos y capacidad de la nube.','Compute capex, chip supply, data center commitments, cloud capacity strategy.',60,1,'1970-01-01 00:00:00',NULL);
CREATE TABLE category_daily_activity (
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
INSERT INTO "category_daily_activity" VALUES('catactivity.0efa2ebcf9e30b7a','2026-01-04','7d','tech','tech.agents',0.0,0.0,0.0,0,1,0,0,'dormant','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "category_daily_activity" VALUES('catactivity.501ecbad6914253a','2026-01-04','30d','tech','tech.agents',0.0,0.0,0.0,0,1,0,0,'dormant','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "category_daily_activity" VALUES('catactivity.be9ecb0ac200c018','2026-01-04','90d','tech','tech.agents',0.0,0.0,0.0,0,1,0,0,'dormant','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "category_daily_activity" VALUES('catactivity.fc657429481f477b','2026-01-04','7d','tech','tech.inference-runtime',0.0,0.0,0.0,0,1,0,0,'dormant','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "category_daily_activity" VALUES('catactivity.06fe2b5667bca6dc','2026-01-04','30d','tech','tech.inference-runtime',0.0,0.0,0.0,0,1,0,0,'dormant','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "category_daily_activity" VALUES('catactivity.3d68616c35726aa7','2026-01-04','90d','tech','tech.inference-runtime',0.0,0.0,0.0,0,1,0,0,'dormant','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "category_daily_activity" VALUES('catactivity.6e438190308f3a9c','2026-01-04','7d','tech','tech.infrastructure',1.0,0.29714285714285721,0.0,4,3,1,3,'continuing','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "category_daily_activity" VALUES('catactivity.ac8938e4d94fae02','2026-01-04','30d','tech','tech.infrastructure',1.0,0.29714285714285721,0.0,4,3,1,3,'continuing','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "category_daily_activity" VALUES('catactivity.29d1ce240bdc3119','2026-01-04','90d','tech','tech.infrastructure',1.0,0.29714285714285721,0.0,4,3,1,3,'continuing','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "category_daily_activity" VALUES('catactivity.de4796476bd8da7e','2026-01-04','7d','tech','tech.models',0.0,0.0,0.0,0,1,0,0,'dormant','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "category_daily_activity" VALUES('catactivity.4851a9ff54c5a87a','2026-01-04','30d','tech','tech.models',0.0,0.0,0.0,0,1,0,0,'dormant','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "category_daily_activity" VALUES('catactivity.f0ffa6c554a21081','2026-01-04','90d','tech','tech.models',0.0,0.0,0.0,0,1,0,0,'dormant','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "category_daily_activity" VALUES('catactivity.985812561d3e8e7c','2026-01-04','7d','tech','tech.security',0.0,0.0,0.0,0,2,0,0,'dormant','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "category_daily_activity" VALUES('catactivity.4e918ef989e3a612','2026-01-04','30d','tech','tech.security',0.0,0.0,0.0,0,2,0,0,'dormant','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "category_daily_activity" VALUES('catactivity.e07b3f825223b3b5','2026-01-04','90d','tech','tech.security',0.0,0.0,0.0,0,2,0,0,'dormant','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "category_daily_activity" VALUES('catactivity.2039dbb66bd85a8b','2026-01-04','7d','tech','tech.standards',0.0,0.0,0.0,0,2,0,0,'dormant','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "category_daily_activity" VALUES('catactivity.de98bf979fe77775','2026-01-04','30d','tech','tech.standards',0.0,0.0,0.0,0,2,0,0,'dormant','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "category_daily_activity" VALUES('catactivity.39fda93fee07df9d','2026-01-04','90d','tech','tech.standards',0.0,0.0,0.0,0,2,0,0,'dormant','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "category_daily_activity" VALUES('catactivity.5dd6eb947e826fb5','2026-01-04','7d','business','business.capital-supply-chain',1.0,0.30333333333333334,0.0,4,2,1,9,'continuing','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "category_daily_activity" VALUES('catactivity.da9b4b7ea7b4c9bd','2026-01-04','30d','business','business.capital-supply-chain',1.0,0.30333333333333334,0.0,4,2,1,9,'continuing','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "category_daily_activity" VALUES('catactivity.313ecf29dd805be1','2026-01-04','90d','business','business.capital-supply-chain',1.0,0.30333333333333334,0.0,4,2,1,9,'continuing','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "category_daily_activity" VALUES('catactivity.52f9a2c78b2a00b4','2026-01-04','7d','business','business.competition',0.0,0.0,0.0,0,1,0,0,'dormant','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "category_daily_activity" VALUES('catactivity.227f0880d4c469b9','2026-01-04','30d','business','business.competition',0.0,0.0,0.0,0,1,0,0,'dormant','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "category_daily_activity" VALUES('catactivity.c58ee9b370d4a0eb','2026-01-04','90d','business','business.competition',0.0,0.0,0.0,0,1,0,0,'dormant','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "category_daily_activity" VALUES('catactivity.26677593a2d6699d','2026-01-04','7d','business','business.distribution',0.0,0.0,0.0,0,1,0,0,'dormant','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "category_daily_activity" VALUES('catactivity.2ca6c084abfb4d69','2026-01-04','30d','business','business.distribution',0.0,0.0,0.0,0,1,0,0,'dormant','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "category_daily_activity" VALUES('catactivity.b782ca8b70646909','2026-01-04','90d','business','business.distribution',0.0,0.0,0.0,0,1,0,0,'dormant','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "category_daily_activity" VALUES('catactivity.3d2015a2f29ba351','2026-01-04','7d','business','business.enterprise-adoption',0.0,0.0,0.0,0,1,0,0,'dormant','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "category_daily_activity" VALUES('catactivity.38be53ad862a7dee','2026-01-04','30d','business','business.enterprise-adoption',0.0,0.0,0.0,0,1,0,0,'dormant','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "category_daily_activity" VALUES('catactivity.d11464d3d17ba66f','2026-01-04','90d','business','business.enterprise-adoption',0.0,0.0,0.0,0,1,0,0,'dormant','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "category_daily_activity" VALUES('catactivity.9f4e6427501a401e','2026-01-04','7d','business','business.market-structure',0.0,0.0,0.0,0,1,0,0,'dormant','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "category_daily_activity" VALUES('catactivity.695dc274391c36a8','2026-01-04','30d','business','business.market-structure',0.0,0.0,0.0,0,1,0,0,'dormant','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "category_daily_activity" VALUES('catactivity.6ec78b253c32404a','2026-01-04','90d','business','business.market-structure',0.0,0.0,0.0,0,1,0,0,'dormant','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "category_daily_activity" VALUES('catactivity.07af828021e0a9b2','2026-01-04','7d','business','business.regulation-compliance',0.0,0.0,0.0,0,2,0,0,'dormant','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "category_daily_activity" VALUES('catactivity.48cb2e899135a398','2026-01-04','30d','business','business.regulation-compliance',0.0,0.0,0.0,0,2,0,0,'dormant','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "category_daily_activity" VALUES('catactivity.68867e8259a902e5','2026-01-04','90d','business','business.regulation-compliance',0.0,0.0,0.0,0,2,0,0,'dormant','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
CREATE TABLE embedding_runs (
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
CREATE TABLE evidence_items (
  evidence_id TEXT PRIMARY KEY,
  url TEXT,
  canonical_url TEXT,
  title TEXT,
  -- Localized titles. URL stays canonical (whatever the source serves).
  title_ja TEXT,
  title_es TEXT,
  title_fil TEXT,
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
INSERT INTO "evidence_items" VALUES('evidence.b97a67ea313db741','https://example.com/20260102/0','https://example.com/20260102/0','Example 0 (2026-01-02)',NULL,NULL,NULL,NULL,NULL,'news','2026-01-02','2026-01-02','active_memory',NULL,'source.b762ae83fa1a88db',NULL,NULL,NULL,NULL,NULL,'1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "evidence_items" VALUES('evidence.9a2977faa98767b9','https://example.com/20260102/1','https://example.com/20260102/1','Example 1 (2026-01-02)',NULL,NULL,NULL,NULL,NULL,'news','2026-01-02','2026-01-02','active_memory',NULL,'source.b762ae83fa1a88db',NULL,NULL,NULL,NULL,NULL,'1970-01-01 00:00:00',NULL);
INSERT INTO "evidence_items" VALUES('evidence.af2606d520cb85e6','https://example.com/20260103/0','https://example.com/20260103/0','Example 0 (2026-01-03)',NULL,NULL,NULL,NULL,NULL,'news','2026-01-03','2026-01-03','active_memory',NULL,'source.88a664cde7570cef',NULL,NULL,NULL,NULL,NULL,'1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "evidence_items" VALUES('evidence.b91fdbac666442b6','https://example.com/20260103/1','https://example.com/20260103/1','Example 1 (2026-01-03)',NULL,NULL,NULL,NULL,NULL,'news','2026-01-03','2026-01-03','active_memory',NULL,'source.88a664cde7570cef',NULL,NULL,NULL,NULL,NULL,'1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "evidence_items" VALUES('evidence.379dcf7af643066f','https://example.com/20260104/0','https://example.com/20260104/0','Example 0 (2026-01-04)',NULL,NULL,NULL,NULL,NULL,'news','2026-01-04','2026-01-04','active_memory',NULL,'source.908ca8b3de629dc1',NULL,NULL,NULL,NULL,NULL,'1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "evidence_items" VALUES('evidence.ab28c88510d47e29','https://example.com/20260104/1','https://example.com/20260104/1','Example 1 (2026-01-04)',NULL,NULL,NULL,NULL,NULL,'news','2026-01-04','2026-01-04','active_memory',NULL,'source.908ca8b3de629dc1',NULL,NULL,NULL,NULL,NULL,'1970-01-01 00:00:00','1970-01-01T00:00:00Z');
CREATE TABLE evidence_scope_assignments (
  evidence_id TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  category_id TEXT,
  theme_id TEXT,

  assignment_score REAL,
  confidence REAL,

  assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT,

  PRIMARY KEY (evidence_id, scope_id),

  FOREIGN KEY (evidence_id) REFERENCES evidence_items(evidence_id),
  FOREIGN KEY (scope_id) REFERENCES scopes(scope_id),
  FOREIGN KEY (category_id) REFERENCES categories(category_id),
  FOREIGN KEY (theme_id) REFERENCES themes(theme_id)
);
CREATE TABLE glossary_audit (
  audit_id INTEGER PRIMARY KEY AUTOINCREMENT,
  term TEXT NOT NULL,
  -- check_type: which validation surface ran.
  --   'form'      — Python-side: empty / length / sentence-count /
  --                 banned-word checks
  --   'semantic'  — LLM-as-judge: does the definition match the term's
  --                 commonly-understood industry meaning?
  --   'dedupe'    — Python-side: this term is a synonym / alias of an
  --                 already-active term, should be merged not promoted
  check_type TEXT NOT NULL CHECK (check_type IN ('form', 'semantic', 'dedupe')),
  -- verdict per check.
  --   'pass'   — clean
  --   'warn'   — non-blocking issue (length cap, optional field empty)
  --   'fail'   — blocking; orchestrator retires the row
  verdict TEXT NOT NULL CHECK (verdict IN ('pass', 'warn', 'fail')),
  reason TEXT,
  suggested_fix TEXT,
  checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (term) REFERENCES glossary_terms(term)
);
CREATE TABLE glossary_occurrences (
  term TEXT NOT NULL,
  occurrence_date TEXT NOT NULL,
  hit_count INTEGER NOT NULL DEFAULT 1,
  source TEXT,                    -- 'news' | 'future-prediction'
  PRIMARY KEY (term, occurrence_date),
  FOREIGN KEY (term) REFERENCES glossary_terms(term)
);
INSERT INTO "glossary_occurrences" VALUES('example.com','2026-01-02',8,'news');
INSERT INTO "glossary_occurrences" VALUES('SV','2026-01-02',1,'news');
INSERT INTO "glossary_occurrences" VALUES('example.com','2026-01-03',8,'news');
INSERT INTO "glossary_occurrences" VALUES('SV','2026-01-03',1,'news');
INSERT INTO "glossary_occurrences" VALUES('example.com','2026-01-04',8,'news');
INSERT INTO "glossary_occurrences" VALUES('SV','2026-01-04',1,'news');
CREATE TABLE glossary_terms (
  term TEXT PRIMARY KEY,
  -- JSON array of alternate spellings / abbreviations / common synonyms.
  aliases_json TEXT,
  -- 1-line plain-language definition. No jargon. NULL for candidates.
  quick_def TEXT,
  -- 1-line "why a builder cares". NULL for candidates.
  why_it_matters TEXT,
  -- Locale-fan-out for the EN definitions. NULL = fall back to EN.
  -- Phase 2 prebrought-forward (was originally scheduled later) so
  -- the dashboard's hover tooltip ships in the user's selected
  -- locale instead of always EN.
  quick_def_ja TEXT,
  quick_def_es TEXT,
  quick_def_fil TEXT,
  why_it_matters_ja TEXT,
  why_it_matters_es TEXT,
  why_it_matters_fil TEXT,
  -- Optional canonical link (vendor docs, RFC, primary source).
  canonical_link TEXT,
  status TEXT NOT NULL CHECK (status IN ('candidate', 'active', 'retired')),
  first_seen_date TEXT NOT NULL,
  last_seen_date TEXT,
  occurrences_30d INTEGER NOT NULL DEFAULT 0,
  -- Distinct-days counter inside a 14-day rolling window — feeds the
  -- candidate→active promotion rule (≥ 3 distinct days in 14 = active).
  distinct_days_14d INTEGER NOT NULL DEFAULT 0,
  -- Set once a human has signed off on the auto-generated definition.
  reviewed_by_human INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT
);
INSERT INTO "glossary_terms" VALUES('FixtureTerm','["FXT"]','A term that exists only in the test fixtures.','It proves the glossary seed path without real content.','フィクスチャ専用の用語。','Un término solo de fixtures.','Terminong pang-fixture lamang.','実データなしで検証するため。','Prueba la ruta sin datos reales.','Sinusubok ang daloy nang walang totoong datos.',NULL,'active','2026-01-04',NULL,0,0,1,'1970-01-01 00:00:00',NULL);
INSERT INTO "glossary_terms" VALUES('example.com','[]',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'candidate','2026-01-02','2026-01-04',24,3,0,'1970-01-01 00:00:00',NULL);
INSERT INTO "glossary_terms" VALUES('SV','[]',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'candidate','2026-01-02','2026-01-04',3,3,0,'1970-01-01 00:00:00',NULL);
CREATE TABLE graph_exports (
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
CREATE TABLE graph_node_layouts (
  scope_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  node_type TEXT NOT NULL CHECK (node_type IN ('category', 'theme', 'prediction')),

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
CREATE TABLE metric_windows (
  window_id TEXT PRIMARY KEY CHECK (window_id IN ('7d', '30d', '90d')),
  label TEXT NOT NULL,
  days INTEGER NOT NULL CHECK (days IN (7, 30, 90)),
  sort_order INTEGER NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "metric_windows" VALUES('7d','7D',7,10,0);
INSERT INTO "metric_windows" VALUES('30d','30D',30,20,1);
INSERT INTO "metric_windows" VALUES('90d','90D',90,30,0);
CREATE TABLE needs_tasks (
  task_id TEXT PRIMARY KEY,
  need_id TEXT NOT NULL,
  -- 5W1H — every cell is required by the writer rule but nullable in
  -- the schema so an LLM-extracted partial result can still land
  -- (the orchestrator marks status='blocked' when partial).
  who_text   TEXT,
  what_text  TEXT,
  where_text TEXT,
  when_text  TEXT,                      -- runway period; not the prediction's landing destination
  why_text   TEXT,
  how_text   TEXT,
  -- Phase 4a: locale fan-out for the 5W1H cells (also LLM-generated).
  who_text_ja TEXT, who_text_es TEXT, who_text_fil TEXT,
  what_text_ja TEXT, what_text_es TEXT, what_text_fil TEXT,
  where_text_ja TEXT, where_text_es TEXT, where_text_fil TEXT,
  when_text_ja TEXT, when_text_es TEXT, when_text_fil TEXT,
  why_text_ja TEXT, why_text_es TEXT, why_text_fil TEXT,
  how_text_ja TEXT, how_text_es TEXT, how_text_fil TEXT,
  -- Phase 3: structured time bounds derived from `when_text`. The
  -- task's *runway* — when the actor is doing this work. NOT the
  -- prediction's landing destination (which lives in
  -- `predictions.target_*`). Filled best-effort by the timewindow
  -- parser; NULL when the writer's `when_text` can't be parsed.
  target_start_date TEXT,
  target_end_date TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'done', 'blocked')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT,
  FOREIGN KEY (need_id) REFERENCES prediction_needs(need_id)
);
INSERT INTO "needs_tasks" VALUES('need_task.c4927329155fc066','need.7728f8cd19375dd1','the fixture vendor team','publish milestone artifact 0','example.com','before Q3 2026','the announcement said so','run the fixture release process','the fixture vendor team','the fixture vendor team','the fixture vendor team','publish milestone artifact 0','publish milestone artifact 0','publish milestone artifact 0','example.com','example.com','example.com','before Q3 2026','before Q3 2026','before Q3 2026','the announcement said so','the announcement said so','the announcement said so','run the fixture release process','run the fixture release process','run the fixture release process','2026-07-01','2026-09-30','open','1970-01-01 00:00:00','2026-01-04');
INSERT INTO "needs_tasks" VALUES('need_task.d85707d7f34b5b12','need.75bb239bb73492cc','the fixture vendor team','publish milestone artifact 1','example.com','before Q3 2026','the announcement said so','run the fixture release process','the fixture vendor team','the fixture vendor team','the fixture vendor team','publish milestone artifact 1','publish milestone artifact 1','publish milestone artifact 1','example.com','example.com','example.com','before Q3 2026','before Q3 2026','before Q3 2026','the announcement said so','the announcement said so','the announcement said so','run the fixture release process','run the fixture release process','run the fixture release process','2026-07-01','2026-09-30','open','1970-01-01 00:00:00','2026-01-04');
INSERT INTO "needs_tasks" VALUES('need_task.067b85be0f0b989e','need.c8480f63a4842dbe','the fixture vendor team','publish milestone artifact 2','example.com','before Q3 2026','the announcement said so','run the fixture release process','the fixture vendor team','the fixture vendor team','the fixture vendor team','publish milestone artifact 2','publish milestone artifact 2','publish milestone artifact 2','example.com','example.com','example.com','before Q3 2026','before Q3 2026','before Q3 2026','the announcement said so','the announcement said so','the announcement said so','run the fixture release process','run the fixture release process','run the fixture release process','2026-07-01','2026-09-30','open','1970-01-01 00:00:00','2026-01-04');
INSERT INTO "needs_tasks" VALUES('need_task.5db157c6f48b2a4d','need.e71bbfac2fc015af','the fixture vendor team','publish milestone artifact 0','example.com','before Q3 2026','the announcement said so','run the fixture release process','the fixture vendor team','the fixture vendor team','the fixture vendor team','publish milestone artifact 0','publish milestone artifact 0','publish milestone artifact 0','example.com','example.com','example.com','before Q3 2026','before Q3 2026','before Q3 2026','the announcement said so','the announcement said so','the announcement said so','run the fixture release process','run the fixture release process','run the fixture release process','2026-07-01','2026-09-30','open','1970-01-01 00:00:00','2026-01-04');
INSERT INTO "needs_tasks" VALUES('need_task.14e2e7f985949f3a','need.2f3e994df32ef815','the fixture vendor team','publish milestone artifact 1','example.com','before Q3 2026','the announcement said so','run the fixture release process','the fixture vendor team','the fixture vendor team','the fixture vendor team','publish milestone artifact 1','publish milestone artifact 1','publish milestone artifact 1','example.com','example.com','example.com','before Q3 2026','before Q3 2026','before Q3 2026','the announcement said so','the announcement said so','the announcement said so','run the fixture release process','run the fixture release process','run the fixture release process','2026-07-01','2026-09-30','open','1970-01-01 00:00:00','2026-01-04');
INSERT INTO "needs_tasks" VALUES('need_task.906f621e61661b9f','need.641272c1ecb4e7bf','the fixture vendor team','publish milestone artifact 2','example.com','before Q3 2026','the announcement said so','run the fixture release process','the fixture vendor team','the fixture vendor team','the fixture vendor team','publish milestone artifact 2','publish milestone artifact 2','publish milestone artifact 2','example.com','example.com','example.com','before Q3 2026','before Q3 2026','before Q3 2026','the announcement said so','the announcement said so','the announcement said so','run the fixture release process','run the fixture release process','run the fixture release process','2026-07-01','2026-09-30','open','1970-01-01 00:00:00','2026-01-04');
INSERT INTO "needs_tasks" VALUES('need_task.b3cbd41befc6f8f0','need.17e7343008ed3750','the fixture vendor team','publish milestone artifact 0','example.com','before Q3 2026','the announcement said so','run the fixture release process','the fixture vendor team','the fixture vendor team','the fixture vendor team','publish milestone artifact 0','publish milestone artifact 0','publish milestone artifact 0','example.com','example.com','example.com','before Q3 2026','before Q3 2026','before Q3 2026','the announcement said so','the announcement said so','the announcement said so','run the fixture release process','run the fixture release process','run the fixture release process','2026-07-01','2026-09-30','open','1970-01-01 00:00:00','2026-01-04');
INSERT INTO "needs_tasks" VALUES('need_task.aed4fa183d4d6f58','need.56509979a8f7247f','the fixture vendor team','publish milestone artifact 1','example.com','before Q3 2026','the announcement said so','run the fixture release process','the fixture vendor team','the fixture vendor team','the fixture vendor team','publish milestone artifact 1','publish milestone artifact 1','publish milestone artifact 1','example.com','example.com','example.com','before Q3 2026','before Q3 2026','before Q3 2026','the announcement said so','the announcement said so','the announcement said so','run the fixture release process','run the fixture release process','run the fixture release process','2026-07-01','2026-09-30','open','1970-01-01 00:00:00','2026-01-04');
INSERT INTO "needs_tasks" VALUES('need_task.0486569de071a8ae','need.9f4e85f1b9e66ca8','the fixture vendor team','publish milestone artifact 2','example.com','before Q3 2026','the announcement said so','run the fixture release process','the fixture vendor team','the fixture vendor team','the fixture vendor team','publish milestone artifact 2','publish milestone artifact 2','publish milestone artifact 2','example.com','example.com','example.com','before Q3 2026','before Q3 2026','before Q3 2026','the announcement said so','the announcement said so','the announcement said so','run the fixture release process','run the fixture release process','run the fixture release process','2026-07-01','2026-09-30','open','1970-01-01 00:00:00','2026-01-04');
CREATE TABLE prediction_chain (
  chain_id TEXT PRIMARY KEY,
  source_prediction_id TEXT NOT NULL,
  downstream_prediction_id TEXT NOT NULL,
  via_evidence_id TEXT,
  -- Chain confidence in [0, 1]. 0.5 = plausible mediation; 0.9 =
  -- strong direct entailment.
  strength REAL NOT NULL DEFAULT 0.5
    CHECK (strength BETWEEN 0 AND 1),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT,

  FOREIGN KEY (source_prediction_id) REFERENCES predictions(prediction_id),
  FOREIGN KEY (downstream_prediction_id) REFERENCES predictions(prediction_id),
  FOREIGN KEY (via_evidence_id) REFERENCES evidence_items(evidence_id)
);
CREATE TABLE prediction_evidence_links (
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
INSERT INTO "prediction_evidence_links" VALUES('prediction.ea9dc188119c4848','evidence.b97a67ea313db741','business','support',0.6,0.6,NULL,0.0,'new','2026-01-02','1970-01-01 00:00:00',NULL);
INSERT INTO "prediction_evidence_links" VALUES('prediction.ea9dc188119c4848','evidence.b97a67ea313db741','tech','support',0.6,0.6,NULL,0.0,'new','2026-01-02','1970-01-01 00:00:00',NULL);
INSERT INTO "prediction_evidence_links" VALUES('prediction.653d833667c2e642','evidence.9a2977faa98767b9','business','support',0.6,0.6,NULL,0.0,'new','2026-01-02','1970-01-01 00:00:00',NULL);
INSERT INTO "prediction_evidence_links" VALUES('prediction.653d833667c2e642','evidence.9a2977faa98767b9','tech','support',0.6,0.6,NULL,0.0,'new','2026-01-02','1970-01-01 00:00:00',NULL);
INSERT INTO "prediction_evidence_links" VALUES('prediction.fffecc9edf856be3','evidence.b97a67ea313db741','business','support',0.2,0.2,NULL,0.0,'new','2026-01-02','1970-01-01 00:00:00',NULL);
INSERT INTO "prediction_evidence_links" VALUES('prediction.fffecc9edf856be3','evidence.b97a67ea313db741','tech','support',0.2,0.2,NULL,0.0,'new','2026-01-02','1970-01-01 00:00:00',NULL);
INSERT INTO "prediction_evidence_links" VALUES('prediction.ea9dc188119c4848','evidence.b91fdbac666442b6','business','support',0.2,0.2,NULL,0.0,'new','2026-01-03','1970-01-01 00:00:00',NULL);
INSERT INTO "prediction_evidence_links" VALUES('prediction.ea9dc188119c4848','evidence.b91fdbac666442b6','tech','support',0.2,0.2,NULL,0.0,'new','2026-01-03','1970-01-01 00:00:00',NULL);
INSERT INTO "prediction_evidence_links" VALUES('prediction.ea9dc188119c4848','evidence.af2606d520cb85e6','business','support',0.4,0.4,NULL,0.0,'new','2026-01-03','1970-01-01 00:00:00',NULL);
INSERT INTO "prediction_evidence_links" VALUES('prediction.ea9dc188119c4848','evidence.af2606d520cb85e6','tech','support',0.4,0.4,NULL,0.0,'new','2026-01-03','1970-01-01 00:00:00',NULL);
INSERT INTO "prediction_evidence_links" VALUES('prediction.394e027e97187004','evidence.af2606d520cb85e6','business','support',0.6,0.6,NULL,0.0,'new','2026-01-03','1970-01-01 00:00:00',NULL);
INSERT INTO "prediction_evidence_links" VALUES('prediction.bcfbfe1298ff4ec1','evidence.b91fdbac666442b6','business','support',0.2,0.2,NULL,0.0,'new','2026-01-03','1970-01-01 00:00:00',NULL);
INSERT INTO "prediction_evidence_links" VALUES('prediction.55acc78b25e9754a','evidence.af2606d520cb85e6','business','support',0.4,0.4,NULL,0.0,'new','2026-01-03','1970-01-01 00:00:00',NULL);
INSERT INTO "prediction_evidence_links" VALUES('prediction.ea9dc188119c4848','evidence.ab28c88510d47e29','business','support',0.6,0.6,NULL,0.0,'new','2026-01-04','1970-01-01 00:00:00',NULL);
INSERT INTO "prediction_evidence_links" VALUES('prediction.ea9dc188119c4848','evidence.ab28c88510d47e29','tech','support',0.6,0.6,NULL,0.0,'new','2026-01-04','1970-01-01 00:00:00',NULL);
INSERT INTO "prediction_evidence_links" VALUES('prediction.ea9dc188119c4848','evidence.379dcf7af643066f','business','support',0.6,0.6,NULL,0.0,'new','2026-01-04','1970-01-01 00:00:00',NULL);
INSERT INTO "prediction_evidence_links" VALUES('prediction.ea9dc188119c4848','evidence.379dcf7af643066f','tech','support',0.6,0.6,NULL,0.0,'new','2026-01-04','1970-01-01 00:00:00',NULL);
INSERT INTO "prediction_evidence_links" VALUES('prediction.394e027e97187004','evidence.ab28c88510d47e29','business','support',0.6,0.6,NULL,0.0,'new','2026-01-04','1970-01-01 00:00:00',NULL);
INSERT INTO "prediction_evidence_links" VALUES('prediction.394e027e97187004','evidence.379dcf7af643066f','business','support',0.6,0.6,NULL,0.0,'new','2026-01-04','1970-01-01 00:00:00',NULL);
INSERT INTO "prediction_evidence_links" VALUES('prediction.9bcf1ecbcbd67a64','evidence.379dcf7af643066f','business','support',0.2,0.2,NULL,0.0,'new','2026-01-04','1970-01-01 00:00:00',NULL);
INSERT INTO "prediction_evidence_links" VALUES('prediction.a56031469a9a7ed3','evidence.ab28c88510d47e29','business','support',0.6,0.6,NULL,0.0,'new','2026-01-04','1970-01-01 00:00:00',NULL);
INSERT INTO "prediction_evidence_links" VALUES('prediction.5ef4de1cc1f71cd0','evidence.379dcf7af643066f','business','support',0.6,0.6,NULL,0.0,'new','2026-01-04','1970-01-01 00:00:00',NULL);
CREATE TABLE prediction_needs (
  need_id TEXT PRIMARY KEY,
  prediction_id TEXT NOT NULL,
  actor TEXT NOT NULL,                  -- role abstract; "enterprise security buyer"
  job TEXT NOT NULL,                    -- the job this actor is doing that drives the prediction toward landing
  outcome TEXT,                         -- the concrete deliverable that realizes the prediction's claim (≤ 25 words)
  motivation TEXT,                      -- why this actor pushes the work forward (≤ 25 words)
  -- Phase 4a: locale fan-out for the LLM-generated Need fields. NULL = EN
  -- fallback. Filled by extract-needs when the LLM emits actor_ja / job_ja
  -- etc. alongside the canonical EN values.
  actor_ja TEXT, actor_es TEXT, actor_fil TEXT,
  job_ja TEXT, job_es TEXT, job_fil TEXT,
  outcome_ja TEXT, outcome_es TEXT, outcome_fil TEXT,
  motivation_ja TEXT, motivation_es TEXT, motivation_fil TEXT,
  -- Phase 3: the Need's deadline window — when the actor must
  -- deliver `outcome`. Usually equals the union of the Need's
  -- `needs_tasks.target_*` rows; pre-computed here for fast
  -- aggregation. NULL when no time bound is known.
  target_start_date TEXT,
  target_end_date TEXT,
  reviewed_by_human INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT,
  FOREIGN KEY (prediction_id) REFERENCES predictions(prediction_id)
);
INSERT INTO "prediction_needs" VALUES('need.7728f8cd19375dd1','prediction.ea9dc188119c4848','synthetic vendor 0','ship the fixture milestone','fixture milestone generally available','keep the synthetic market believing announcements','synthetic vendor 0','synthetic vendor 0','synthetic vendor 0','ship the fixture milestone','ship the fixture milestone','ship the fixture milestone','fixture milestone generally available','fixture milestone generally available','fixture milestone generally available','keep the synthetic market believing announcements','keep the synthetic market believing announcements','keep the synthetic market believing announcements','2026-07-01','2026-09-30',0,'1970-01-01 00:00:00','2026-01-04');
INSERT INTO "prediction_needs" VALUES('need.75bb239bb73492cc','prediction.653d833667c2e642','synthetic vendor 1','ship the fixture milestone','fixture milestone generally available','keep the synthetic market believing announcements','synthetic vendor 1','synthetic vendor 1','synthetic vendor 1','ship the fixture milestone','ship the fixture milestone','ship the fixture milestone','fixture milestone generally available','fixture milestone generally available','fixture milestone generally available','keep the synthetic market believing announcements','keep the synthetic market believing announcements','keep the synthetic market believing announcements','2026-07-01','2026-09-30',0,'1970-01-01 00:00:00','2026-01-04');
INSERT INTO "prediction_needs" VALUES('need.c8480f63a4842dbe','prediction.fffecc9edf856be3','synthetic vendor 2','ship the fixture milestone','fixture milestone generally available','keep the synthetic market believing announcements','synthetic vendor 2','synthetic vendor 2','synthetic vendor 2','ship the fixture milestone','ship the fixture milestone','ship the fixture milestone','fixture milestone generally available','fixture milestone generally available','fixture milestone generally available','keep the synthetic market believing announcements','keep the synthetic market believing announcements','keep the synthetic market believing announcements','2026-07-01','2026-09-30',0,'1970-01-01 00:00:00','2026-01-04');
INSERT INTO "prediction_needs" VALUES('need.e71bbfac2fc015af','prediction.394e027e97187004','synthetic vendor 0','ship the fixture milestone','fixture milestone generally available','keep the synthetic market believing announcements','synthetic vendor 0','synthetic vendor 0','synthetic vendor 0','ship the fixture milestone','ship the fixture milestone','ship the fixture milestone','fixture milestone generally available','fixture milestone generally available','fixture milestone generally available','keep the synthetic market believing announcements','keep the synthetic market believing announcements','keep the synthetic market believing announcements','2026-07-01','2026-09-30',0,'1970-01-01 00:00:00','2026-01-04');
INSERT INTO "prediction_needs" VALUES('need.2f3e994df32ef815','prediction.bcfbfe1298ff4ec1','synthetic vendor 1','ship the fixture milestone','fixture milestone generally available','keep the synthetic market believing announcements','synthetic vendor 1','synthetic vendor 1','synthetic vendor 1','ship the fixture milestone','ship the fixture milestone','ship the fixture milestone','fixture milestone generally available','fixture milestone generally available','fixture milestone generally available','keep the synthetic market believing announcements','keep the synthetic market believing announcements','keep the synthetic market believing announcements','2026-07-01','2026-09-30',0,'1970-01-01 00:00:00','2026-01-04');
INSERT INTO "prediction_needs" VALUES('need.641272c1ecb4e7bf','prediction.55acc78b25e9754a','synthetic vendor 2','ship the fixture milestone','fixture milestone generally available','keep the synthetic market believing announcements','synthetic vendor 2','synthetic vendor 2','synthetic vendor 2','ship the fixture milestone','ship the fixture milestone','ship the fixture milestone','fixture milestone generally available','fixture milestone generally available','fixture milestone generally available','keep the synthetic market believing announcements','keep the synthetic market believing announcements','keep the synthetic market believing announcements','2026-07-01','2026-09-30',0,'1970-01-01 00:00:00','2026-01-04');
INSERT INTO "prediction_needs" VALUES('need.17e7343008ed3750','prediction.9bcf1ecbcbd67a64','synthetic vendor 0','ship the fixture milestone','fixture milestone generally available','keep the synthetic market believing announcements','synthetic vendor 0','synthetic vendor 0','synthetic vendor 0','ship the fixture milestone','ship the fixture milestone','ship the fixture milestone','fixture milestone generally available','fixture milestone generally available','fixture milestone generally available','keep the synthetic market believing announcements','keep the synthetic market believing announcements','keep the synthetic market believing announcements','2026-07-01','2026-09-30',0,'1970-01-01 00:00:00','2026-01-04');
INSERT INTO "prediction_needs" VALUES('need.56509979a8f7247f','prediction.a56031469a9a7ed3','synthetic vendor 1','ship the fixture milestone','fixture milestone generally available','keep the synthetic market believing announcements','synthetic vendor 1','synthetic vendor 1','synthetic vendor 1','ship the fixture milestone','ship the fixture milestone','ship the fixture milestone','fixture milestone generally available','fixture milestone generally available','fixture milestone generally available','keep the synthetic market believing announcements','keep the synthetic market believing announcements','keep the synthetic market believing announcements','2026-07-01','2026-09-30',0,'1970-01-01 00:00:00','2026-01-04');
INSERT INTO "prediction_needs" VALUES('need.9f4e85f1b9e66ca8','prediction.5ef4de1cc1f71cd0','synthetic vendor 2','ship the fixture milestone','fixture milestone generally available','keep the synthetic market believing announcements','synthetic vendor 2','synthetic vendor 2','synthetic vendor 2','ship the fixture milestone','ship the fixture milestone','ship the fixture milestone','fixture milestone generally available','fixture milestone generally available','fixture milestone generally available','keep the synthetic market believing announcements','keep the synthetic market believing announcements','keep the synthetic market believing announcements','2026-07-01','2026-09-30',0,'1970-01-01 00:00:00','2026-01-04');
CREATE TABLE prediction_realization_snapshots (
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
INSERT INTO "prediction_realization_snapshots" VALUES('prediction.ea9dc188119c4848','tech','2026-01-04','7d',NULL,0.6,0.0,3,0.6,0.0,'weakly_supported','1970-01-01 00:00:00');
INSERT INTO "prediction_realization_snapshots" VALUES('prediction.ea9dc188119c4848','tech','2026-01-04','30d',NULL,0.6,0.0,3,0.6,0.0,'weakly_supported','1970-01-01 00:00:00');
INSERT INTO "prediction_realization_snapshots" VALUES('prediction.ea9dc188119c4848','tech','2026-01-04','90d',NULL,0.6,0.0,3,0.6,0.0,'weakly_supported','1970-01-01 00:00:00');
INSERT INTO "prediction_realization_snapshots" VALUES('prediction.ea9dc188119c4848','business','2026-01-04','7d',NULL,0.6,0.0,3,0.6,0.0,'weakly_supported','1970-01-01 00:00:00');
INSERT INTO "prediction_realization_snapshots" VALUES('prediction.ea9dc188119c4848','business','2026-01-04','30d',NULL,0.6,0.0,3,0.6,0.0,'weakly_supported','1970-01-01 00:00:00');
INSERT INTO "prediction_realization_snapshots" VALUES('prediction.ea9dc188119c4848','business','2026-01-04','90d',NULL,0.6,0.0,3,0.6,0.0,'weakly_supported','1970-01-01 00:00:00');
INSERT INTO "prediction_realization_snapshots" VALUES('prediction.653d833667c2e642','tech','2026-01-04','7d',NULL,0.6,0.0,3,0.6,0.0,'weakly_supported','1970-01-01 00:00:00');
INSERT INTO "prediction_realization_snapshots" VALUES('prediction.653d833667c2e642','tech','2026-01-04','30d',NULL,0.6,0.0,3,0.6,0.0,'weakly_supported','1970-01-01 00:00:00');
INSERT INTO "prediction_realization_snapshots" VALUES('prediction.653d833667c2e642','tech','2026-01-04','90d',NULL,0.6,0.0,3,0.6,0.0,'weakly_supported','1970-01-01 00:00:00');
INSERT INTO "prediction_realization_snapshots" VALUES('prediction.653d833667c2e642','business','2026-01-04','7d',NULL,0.6,0.0,3,0.6,0.0,'weakly_supported','1970-01-01 00:00:00');
INSERT INTO "prediction_realization_snapshots" VALUES('prediction.653d833667c2e642','business','2026-01-04','30d',NULL,0.6,0.0,3,0.6,0.0,'weakly_supported','1970-01-01 00:00:00');
INSERT INTO "prediction_realization_snapshots" VALUES('prediction.653d833667c2e642','business','2026-01-04','90d',NULL,0.6,0.0,3,0.6,0.0,'weakly_supported','1970-01-01 00:00:00');
INSERT INTO "prediction_realization_snapshots" VALUES('prediction.fffecc9edf856be3','tech','2026-01-04','7d',NULL,0.2,0.0,1,0.2,0.0,'no_signal','1970-01-01 00:00:00');
INSERT INTO "prediction_realization_snapshots" VALUES('prediction.fffecc9edf856be3','tech','2026-01-04','30d',NULL,0.2,0.0,1,0.2,0.0,'no_signal','1970-01-01 00:00:00');
INSERT INTO "prediction_realization_snapshots" VALUES('prediction.fffecc9edf856be3','tech','2026-01-04','90d',NULL,0.2,0.0,1,0.2,0.0,'no_signal','1970-01-01 00:00:00');
INSERT INTO "prediction_realization_snapshots" VALUES('prediction.fffecc9edf856be3','business','2026-01-04','7d',NULL,0.2,0.0,1,0.2,0.0,'no_signal','1970-01-01 00:00:00');
INSERT INTO "prediction_realization_snapshots" VALUES('prediction.fffecc9edf856be3','business','2026-01-04','30d',NULL,0.2,0.0,1,0.2,0.0,'no_signal','1970-01-01 00:00:00');
INSERT INTO "prediction_realization_snapshots" VALUES('prediction.fffecc9edf856be3','business','2026-01-04','90d',NULL,0.2,0.0,1,0.2,0.0,'no_signal','1970-01-01 00:00:00');
INSERT INTO "prediction_realization_snapshots" VALUES('prediction.394e027e97187004','business','2026-01-04','7d',NULL,0.6,0.0,3,0.6,0.0,'weakly_supported','1970-01-01 00:00:00');
INSERT INTO "prediction_realization_snapshots" VALUES('prediction.394e027e97187004','business','2026-01-04','30d',NULL,0.6,0.0,3,0.6,0.0,'weakly_supported','1970-01-01 00:00:00');
INSERT INTO "prediction_realization_snapshots" VALUES('prediction.394e027e97187004','business','2026-01-04','90d',NULL,0.6,0.0,3,0.6,0.0,'weakly_supported','1970-01-01 00:00:00');
INSERT INTO "prediction_realization_snapshots" VALUES('prediction.bcfbfe1298ff4ec1','business','2026-01-04','7d',NULL,0.2,0.0,1,0.2,0.0,'no_signal','1970-01-01 00:00:00');
INSERT INTO "prediction_realization_snapshots" VALUES('prediction.bcfbfe1298ff4ec1','business','2026-01-04','30d',NULL,0.2,0.0,1,0.2,0.0,'no_signal','1970-01-01 00:00:00');
INSERT INTO "prediction_realization_snapshots" VALUES('prediction.bcfbfe1298ff4ec1','business','2026-01-04','90d',NULL,0.2,0.0,1,0.2,0.0,'no_signal','1970-01-01 00:00:00');
INSERT INTO "prediction_realization_snapshots" VALUES('prediction.55acc78b25e9754a','business','2026-01-04','7d',NULL,0.4,0.0,2,0.4,0.0,'weakly_supported','1970-01-01 00:00:00');
INSERT INTO "prediction_realization_snapshots" VALUES('prediction.55acc78b25e9754a','business','2026-01-04','30d',NULL,0.4,0.0,2,0.4,0.0,'weakly_supported','1970-01-01 00:00:00');
INSERT INTO "prediction_realization_snapshots" VALUES('prediction.55acc78b25e9754a','business','2026-01-04','90d',NULL,0.4,0.0,2,0.4,0.0,'weakly_supported','1970-01-01 00:00:00');
INSERT INTO "prediction_realization_snapshots" VALUES('prediction.9bcf1ecbcbd67a64','business','2026-01-04','7d',NULL,0.2,0.0,1,0.2,0.0,'no_signal','1970-01-01 00:00:00');
INSERT INTO "prediction_realization_snapshots" VALUES('prediction.9bcf1ecbcbd67a64','business','2026-01-04','30d',NULL,0.2,0.0,1,0.2,0.0,'no_signal','1970-01-01 00:00:00');
INSERT INTO "prediction_realization_snapshots" VALUES('prediction.9bcf1ecbcbd67a64','business','2026-01-04','90d',NULL,0.2,0.0,1,0.2,0.0,'no_signal','1970-01-01 00:00:00');
INSERT INTO "prediction_realization_snapshots" VALUES('prediction.a56031469a9a7ed3','business','2026-01-04','7d',NULL,0.6,0.0,3,0.6,0.0,'weakly_supported','1970-01-01 00:00:00');
INSERT INTO "prediction_realization_snapshots" VALUES('prediction.a56031469a9a7ed3','business','2026-01-04','30d',NULL,0.6,0.0,3,0.6,0.0,'weakly_supported','1970-01-01 00:00:00');
INSERT INTO "prediction_realization_snapshots" VALUES('prediction.a56031469a9a7ed3','business','2026-01-04','90d',NULL,0.6,0.0,3,0.6,0.0,'weakly_supported','1970-01-01 00:00:00');
INSERT INTO "prediction_realization_snapshots" VALUES('prediction.5ef4de1cc1f71cd0','business','2026-01-04','7d',NULL,0.6,0.0,3,0.6,0.0,'weakly_supported','1970-01-01 00:00:00');
INSERT INTO "prediction_realization_snapshots" VALUES('prediction.5ef4de1cc1f71cd0','business','2026-01-04','30d',NULL,0.6,0.0,3,0.6,0.0,'weakly_supported','1970-01-01 00:00:00');
INSERT INTO "prediction_realization_snapshots" VALUES('prediction.5ef4de1cc1f71cd0','business','2026-01-04','90d',NULL,0.6,0.0,3,0.6,0.0,'weakly_supported','1970-01-01 00:00:00');
CREATE TABLE prediction_relations (
  relation_id TEXT PRIMARY KEY,
  prediction_a TEXT NOT NULL,
  prediction_b TEXT NOT NULL,
  -- Five canonical relation types. The writer must pick exactly one
  -- per (a, b) pair; combining types on the same pair is forbidden.
  --
  --   parallel:           A and B are independent facets — both
  --                       can be true at the same time. The default
  --                       when no other relation applies.
  --   exclusive_variant:  A, B, ... are competing scenarios in the
  --                       same outcome space. Bound together by a
  --                       shared `family_id`. Only one will land.
  --   negation:           Strict complement. A = X, B = not-X.
  --                       At most one is true.
  --   entails:            A's claim implies B's claim **by
  --                       definition** (no evidence needed). The
  --                       narrower entails the broader. Strictly
  --                       stronger than `prediction_chain`; if
  --                       entails(A, B) exists, do NOT also write
  --                       chain(A, B) — per the extract-chain-effects
  --                       contract (retired spec; git history).
  --   equivalent:         Same prediction in different words.
  --                       Merge candidate. Reserved for true
  --                       paraphrases — if A is the narrower /
  --                       more specific / time-bounded version of
  --                       B, prefer `entails` over `equivalent`.
  --
  -- Canonical decision tree:
  --   1. Are A and B *the same* claim worded differently? → equivalent
  --   2. Does A's truth force B's truth (or vice-versa) by definition?
  --      → entails
  --   3. Is A = NOT(B)? → negation
  --   4. Are A and B competing scenarios in one outcome space?
  --      → exclusive_variant (group with family_id)
  --   5. Otherwise → parallel
  relation_type TEXT NOT NULL CHECK (relation_type IN (
    'parallel', 'exclusive_variant', 'negation', 'entails', 'equivalent'
  )),
  -- Shared identifier for exclusive_variant rows belonging to the
  -- same outcome space. NULL for non-exclusive relations.
  family_id TEXT,
  -- Optional probability mass for exclusive_variant rows; the
  -- frontend normalizes the family to 100% when rendering.
  prob_mass REAL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT,

  FOREIGN KEY (prediction_a) REFERENCES predictions(prediction_id),
  FOREIGN KEY (prediction_b) REFERENCES predictions(prediction_id)
);
CREATE TABLE prediction_scope_assignments (
  prediction_id TEXT NOT NULL,
  scope_id TEXT NOT NULL,

  category_id TEXT,
  theme_id TEXT,

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
  FOREIGN KEY (theme_id) REFERENCES themes(theme_id)
);
INSERT INTO "prediction_scope_assignments" VALUES('prediction.ea9dc188119c4848','tech','tech.infrastructure','tech.physical_ai_robotics','anchor',1.0,NULL,3,0.6,0.0,'weakly_supported',NULL,NULL,NULL,'1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "prediction_scope_assignments" VALUES('prediction.ea9dc188119c4848','business','business.capital-supply-chain','business.ai_revenue_disclosure','anchor',1.0,NULL,3,0.6,0.0,'weakly_supported',NULL,NULL,NULL,'1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "prediction_scope_assignments" VALUES('prediction.653d833667c2e642','tech','tech.infrastructure','tech.physical_ai_robotics','anchor',1.0,NULL,3,0.6,0.0,'weakly_supported',NULL,NULL,NULL,'1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "prediction_scope_assignments" VALUES('prediction.653d833667c2e642','business','business.capital-supply-chain','business.ai_revenue_disclosure','anchor',1.0,NULL,3,0.6,0.0,'weakly_supported',NULL,NULL,NULL,'1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "prediction_scope_assignments" VALUES('prediction.fffecc9edf856be3','tech','tech.infrastructure','tech.physical_ai_robotics','anchor',1.0,NULL,1,0.2,0.0,'no_signal',NULL,NULL,NULL,'1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "prediction_scope_assignments" VALUES('prediction.fffecc9edf856be3','business','business.capital-supply-chain','business.ai_revenue_disclosure','anchor',1.0,NULL,1,0.2,0.0,'no_signal',NULL,NULL,NULL,'1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "prediction_scope_assignments" VALUES('prediction.394e027e97187004','business','business.capital-supply-chain','business.ai_revenue_disclosure','anchor',1.0,NULL,3,0.6,0.0,'weakly_supported',NULL,NULL,NULL,'1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "prediction_scope_assignments" VALUES('prediction.bcfbfe1298ff4ec1','business','business.capital-supply-chain','business.ai_revenue_disclosure','anchor',1.0,NULL,1,0.2,0.0,'no_signal',NULL,NULL,NULL,'1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "prediction_scope_assignments" VALUES('prediction.55acc78b25e9754a','business','business.capital-supply-chain','business.ai_revenue_disclosure','anchor',1.0,NULL,2,0.4,0.0,'weakly_supported',NULL,NULL,NULL,'1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "prediction_scope_assignments" VALUES('prediction.9bcf1ecbcbd67a64','business','business.capital-supply-chain','business.ai_revenue_disclosure','anchor',1.0,NULL,1,0.2,0.0,'no_signal',NULL,NULL,NULL,'1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "prediction_scope_assignments" VALUES('prediction.a56031469a9a7ed3','business','business.capital-supply-chain','business.ai_revenue_disclosure','anchor',1.0,NULL,3,0.6,0.0,'weakly_supported',NULL,NULL,NULL,'1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "prediction_scope_assignments" VALUES('prediction.5ef4de1cc1f71cd0','business','business.capital-supply-chain','business.ai_revenue_disclosure','anchor',1.0,NULL,3,0.6,0.0,'weakly_supported',NULL,NULL,NULL,'1970-01-01 00:00:00','1970-01-01T00:00:00Z');
CREATE TABLE predictions (
  prediction_id TEXT PRIMARY KEY,

  prediction_summary TEXT NOT NULL,
  prediction_short_label TEXT,
  prediction_date TEXT,

  -- title field: dedicated short title (≤ 80 chars). The writer in
  -- 1_daily_update emits this alongside the full prediction body so
  -- the dashboard can render a clean caption rather than truncating
  -- the markdown-heavy summary. Title rules: no markdown asterisks,
  -- no scope prefix `(Tech)` / `(Business)`, no trailing period;
  -- subject + verb structure. NULL during the migration window for
  -- predictions ingested before title field landed; the frontend
  -- falls back to a cleaned-up first sentence in that case.
  title TEXT,

  -- reasoning fields: structured reasoning trace. Each Future prediction
  -- in news-YYYYMMDD.md emits these alongside the prose body so the
  -- dashboard's Reasoning tab can show *why* the writer made the
  -- call without re-parsing the markdown body. NULL on legacy
  -- predictions; the Phase 2 backfill skill fills them retroactively.
  --   reasoning_because  : observed precondition (e.g. "Apr 29 CSAI MITRE-CNA authorization")
  --   reasoning_given    : structural force (e.g. "enterprise risk transfer once a CNA exists")
  --   reasoning_so_that  : consequence (e.g. "skill marketplaces lose enterprise sales unless signed")
  --   reasoning_landing  : when + actor placement (e.g. "Q3 2026, MITRE + CSAI joint advisory")
  --   plain_language     : 1-sentence plain-language version, ≤ 25 words
  reasoning_because TEXT,
  reasoning_given TEXT,
  reasoning_so_that TEXT,
  reasoning_landing TEXT,
  plain_language TEXT,

  -- Phase 4a: locale fan-out for title field title + reasoning fields + plain_language.
  -- NULL = fall back to canonical EN. Filled by ingest from sibling locale
  -- markdown files (news-YYYYMMDD.md in data/daily-news/{ja,es,fil}/).
  title_ja TEXT,
  title_es TEXT,
  title_fil TEXT,
  reasoning_because_ja TEXT,
  reasoning_because_es TEXT,
  reasoning_because_fil TEXT,
  reasoning_given_ja TEXT,
  reasoning_given_es TEXT,
  reasoning_given_fil TEXT,
  reasoning_so_that_ja TEXT,
  reasoning_so_that_es TEXT,
  reasoning_so_that_fil TEXT,
  reasoning_landing_ja TEXT,
  reasoning_landing_es TEXT,
  reasoning_landing_fil TEXT,
  plain_language_ja TEXT,
  plain_language_es TEXT,
  plain_language_fil TEXT,

  -- Phase 3: structured time bounds derived from `reasoning_landing`.
  -- The prediction's *destination* — when the prediction completes.
  -- Filled best-effort by the timewindow parser
  -- (`app/src/timewindow.py`); NULL when the writer's landing text
  -- can't be parsed. NOT the same as `needs_tasks.target_*` (that's
  -- the runway period during which the actor's work happens).
  target_start_date TEXT,
  target_end_date TEXT,

  -- mid-tier summary (Phase 2 forward, 2026-05-02): mid-tier summary. The
  -- dashboard right pane is now 3-tier:
  --   1. title              (≤ 80 chars, the dedicated `predictions.title`)
  --   2. summary            (≤ 300 chars, this column — *what* the
  --                          prediction is, in plain technical prose;
  --                          the default-visible body)
  --   3. prediction_summary (multi-paragraph long-form, default
  --                          collapsed in <details>; the original)
  -- Writer emits a `**Summary:**` marker block in `## Future` between
  -- the reasoning fields bullets and the long-form body. NULL on
  -- legacy items — the frontend falls back to title + collapsed full
  -- text only (no middle tier). Backfill skill fills them later.
  summary TEXT,
  -- Locale fan-out: NULL falls back to EN at export.
  summary_ja TEXT,
  summary_es TEXT,
  summary_fil TEXT,

  -- TTL-based "huge longshot hit" marker. NULL = no longshot revival yet.
  -- Set to ISO date when daily task 2 detects a [REVIVED] marker on a
  -- validation row referencing this prediction. Frontend highlights
  -- predictions whose timestamp is within 14 days of today.
  huge_longshot_hit_at TEXT,

  -- Locale columns. NULL = fall back to canonical English summary/label.
  prediction_summary_ja TEXT,
  prediction_summary_es TEXT,
  prediction_summary_fil TEXT,
  prediction_short_label_ja TEXT,
  prediction_short_label_es TEXT,
  prediction_short_label_fil TEXT,

  source_file_id TEXT,
  source_row_index INTEGER,

  raw_text TEXT,
  raw_json TEXT,

  -- Wall-clock at ingest insertion. NOT the time the prediction was
  -- authored — that's ``prediction_date``, derived from the source
  -- news file's header (or its filename ``news-YYYYMMDD.md``). The
  -- earlier name ``created_at`` was misleading because predictions
  -- conceptually pre-exist their first DB ingest, so we keep the
  -- semantics explicit.
  ingested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT,

  FOREIGN KEY (source_file_id) REFERENCES source_files(source_file_id)
);
INSERT INTO "predictions" VALUES('prediction.ea9dc188119c4848','Widgetly announced a synthetic milestone on 2026-01-02. This fixture prediction exists to exercise the pipeline shape: it claims the vendor lands milestone 0 within two quarters, citing the fixture announcement. No real product, vendor, or person is referenced.','Widgetly ships synthetic milestone 20260102-0 by Q3 2026','2026-01-02','Widgetly ships synthetic milestone 20260102-0 by Q3 2026','fixture announcement observed on 2026-01-02','the synthetic market always follows its announcements','Widgetly lands milestone 0 within two quarters','Q3 2026, fixture scope','Widgetly will finish milestone 0 soon.','[ja] Widgetly ships synthetic milestone 20260102-0 by Q3 2026','[es] Widgetly ships synthetic milestone 20260102-0 by Q3 2026','[fil] Widgetly ships synthetic milestone 20260102-0 by Q3 2026','[ja] fixture announcement observed on 2026-01-02','[es] fixture announcement observed on 2026-01-02','[fil] fixture announcement observed on 2026-01-02','[ja] the synthetic market always follows its announcements','[es] the synthetic market always follows its announcements','[fil] the synthetic market always follows its announcements','[ja] Widgetly lands milestone 0 within two quarters','[es] Widgetly lands milestone 0 within two quarters','[fil] Widgetly lands milestone 0 within two quarters','[ja] Q3 2026, fixture scope','[es] Q3 2026, fixture scope','[fil] Q3 2026, fixture scope','[ja] Widgetly will finish milestone 0 soon.','[es] Widgetly will finish milestone 0 soon.','[fil] Widgetly will finish milestone 0 soon.','2026-07-01','2026-09-30','Widgetly is expected to land synthetic milestone 0. This is fixture prose used only by the test suite.','[ja] Widgetly is expected to land synthetic milestone 0. This is fixture prose used only by the test suite.','[es] Widgetly is expected to land synthetic milestone 0. This is fixture prose used only by the test suite.','[fil] Widgetly is expected to land synthetic milestone 0. This is fixture prose used only by the test suite.',NULL,'[ja] Widgetly announced a synthetic milestone on 2026-01-02. This fixture prediction exists to exercise the pipeline shape: it claims the vendor lands milestone 0 within two quarters, citing the fixture announcement. No real product, vendor, or person is referenced.','[es] Widgetly announced a synthetic milestone on 2026-01-02. This fixture prediction exists to exercise the pipeline shape: it claims the vendor lands milestone 0 within two quarters, citing the fixture announcement. No real product, vendor, or person is referenced.','[fil] Widgetly announced a synthetic milestone on 2026-01-02. This fixture prediction exists to exercise the pipeline shape: it claims the vendor lands milestone 0 within two quarters, citing the fixture announcement. No real product, vendor, or person is referenced.','[ja] Widgetly ships synthetic milestone 20260102-0 by Q3 2026','[es] Widgetly ships synthetic milestone 20260102-0 by Q3 2026','[fil] Widgetly ships synthetic milestone 20260102-0 by Q3 2026','source.1fe799910eb1cd09',0,'Widgetly announced a synthetic milestone on 2026-01-02. This fixture prediction exists to exercise the pipeline shape: it claims the vendor lands milestone 0 within two quarters, citing the fixture announcement. No real product, vendor, or person is referenced.',NULL,'1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "predictions" VALUES('prediction.653d833667c2e642','Acme Metrics announced a synthetic milestone on 2026-01-02. This fixture prediction exists to exercise the pipeline shape: it claims the vendor lands milestone 1 within two quarters, citing the fixture announcement. No real product, vendor, or person is referenced.','Acme Metrics ships synthetic milestone 20260102-1 by Q3 2026','2026-01-02','Acme Metrics ships synthetic milestone 20260102-1 by Q3 2026','fixture announcement observed on 2026-01-02','the synthetic market always follows its announcements','Acme Metrics lands milestone 1 within two quarters','Q3 2026, fixture scope','Acme Metrics will finish milestone 1 soon.','[ja] Acme Metrics ships synthetic milestone 20260102-1 by Q3 2026','[es] Acme Metrics ships synthetic milestone 20260102-1 by Q3 2026','[fil] Acme Metrics ships synthetic milestone 20260102-1 by Q3 2026','[ja] fixture announcement observed on 2026-01-02','[es] fixture announcement observed on 2026-01-02','[fil] fixture announcement observed on 2026-01-02','[ja] the synthetic market always follows its announcements','[es] the synthetic market always follows its announcements','[fil] the synthetic market always follows its announcements','[ja] Acme Metrics lands milestone 1 within two quarters','[es] Acme Metrics lands milestone 1 within two quarters','[fil] Acme Metrics lands milestone 1 within two quarters','[ja] Q3 2026, fixture scope','[es] Q3 2026, fixture scope','[fil] Q3 2026, fixture scope','[ja] Acme Metrics will finish milestone 1 soon.','[es] Acme Metrics will finish milestone 1 soon.','[fil] Acme Metrics will finish milestone 1 soon.','2026-07-01','2026-09-30','Acme Metrics is expected to land synthetic milestone 1. This is fixture prose used only by the test suite.','[ja] Acme Metrics is expected to land synthetic milestone 1. This is fixture prose used only by the test suite.','[es] Acme Metrics is expected to land synthetic milestone 1. This is fixture prose used only by the test suite.','[fil] Acme Metrics is expected to land synthetic milestone 1. This is fixture prose used only by the test suite.',NULL,'[ja] Acme Metrics announced a synthetic milestone on 2026-01-02. This fixture prediction exists to exercise the pipeline shape: it claims the vendor lands milestone 1 within two quarters, citing the fixture announcement. No real product, vendor, or person is referenced.','[es] Acme Metrics announced a synthetic milestone on 2026-01-02. This fixture prediction exists to exercise the pipeline shape: it claims the vendor lands milestone 1 within two quarters, citing the fixture announcement. No real product, vendor, or person is referenced.','[fil] Acme Metrics announced a synthetic milestone on 2026-01-02. This fixture prediction exists to exercise the pipeline shape: it claims the vendor lands milestone 1 within two quarters, citing the fixture announcement. No real product, vendor, or person is referenced.','[ja] Acme Metrics ships synthetic milestone 20260102-1 by Q3 2026','[es] Acme Metrics ships synthetic milestone 20260102-1 by Q3 2026','[fil] Acme Metrics ships synthetic milestone 20260102-1 by Q3 2026','source.1fe799910eb1cd09',1,'Acme Metrics announced a synthetic milestone on 2026-01-02. This fixture prediction exists to exercise the pipeline shape: it claims the vendor lands milestone 1 within two quarters, citing the fixture announcement. No real product, vendor, or person is referenced.',NULL,'1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "predictions" VALUES('prediction.fffecc9edf856be3','Exampletron announced a synthetic milestone on 2026-01-02. This fixture prediction exists to exercise the pipeline shape: it claims the vendor lands milestone 2 within two quarters, citing the fixture announcement. No real product, vendor, or person is referenced.','Exampletron ships synthetic milestone 20260102-2 by Q3 2026','2026-01-02','Exampletron ships synthetic milestone 20260102-2 by Q3 2026','fixture announcement observed on 2026-01-02','the synthetic market always follows its announcements','Exampletron lands milestone 2 within two quarters','Q3 2026, fixture scope','Exampletron will finish milestone 2 soon.','[ja] Exampletron ships synthetic milestone 20260102-2 by Q3 2026','[es] Exampletron ships synthetic milestone 20260102-2 by Q3 2026','[fil] Exampletron ships synthetic milestone 20260102-2 by Q3 2026','[ja] fixture announcement observed on 2026-01-02','[es] fixture announcement observed on 2026-01-02','[fil] fixture announcement observed on 2026-01-02','[ja] the synthetic market always follows its announcements','[es] the synthetic market always follows its announcements','[fil] the synthetic market always follows its announcements','[ja] Exampletron lands milestone 2 within two quarters','[es] Exampletron lands milestone 2 within two quarters','[fil] Exampletron lands milestone 2 within two quarters','[ja] Q3 2026, fixture scope','[es] Q3 2026, fixture scope','[fil] Q3 2026, fixture scope','[ja] Exampletron will finish milestone 2 soon.','[es] Exampletron will finish milestone 2 soon.','[fil] Exampletron will finish milestone 2 soon.','2026-07-01','2026-09-30','Exampletron is expected to land synthetic milestone 2. This is fixture prose used only by the test suite.','[ja] Exampletron is expected to land synthetic milestone 2. This is fixture prose used only by the test suite.','[es] Exampletron is expected to land synthetic milestone 2. This is fixture prose used only by the test suite.','[fil] Exampletron is expected to land synthetic milestone 2. This is fixture prose used only by the test suite.',NULL,'[ja] Exampletron announced a synthetic milestone on 2026-01-02. This fixture prediction exists to exercise the pipeline shape: it claims the vendor lands milestone 2 within two quarters, citing the fixture announcement. No real product, vendor, or person is referenced.','[es] Exampletron announced a synthetic milestone on 2026-01-02. This fixture prediction exists to exercise the pipeline shape: it claims the vendor lands milestone 2 within two quarters, citing the fixture announcement. No real product, vendor, or person is referenced.','[fil] Exampletron announced a synthetic milestone on 2026-01-02. This fixture prediction exists to exercise the pipeline shape: it claims the vendor lands milestone 2 within two quarters, citing the fixture announcement. No real product, vendor, or person is referenced.','[ja] Exampletron ships synthetic milestone 20260102-2 by Q3 2026','[es] Exampletron ships synthetic milestone 20260102-2 by Q3 2026','[fil] Exampletron ships synthetic milestone 20260102-2 by Q3 2026','source.1fe799910eb1cd09',2,'Exampletron announced a synthetic milestone on 2026-01-02. This fixture prediction exists to exercise the pipeline shape: it claims the vendor lands milestone 2 within two quarters, citing the fixture announcement. No real product, vendor, or person is referenced.',NULL,'1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "predictions" VALUES('prediction.394e027e97187004','Widgetly announced a synthetic milestone on 2026-01-03. This fixture prediction exists to exercise the pipeline shape: it claims the vendor lands milestone 0 within two quarters, citing the fixture announcement. No real product, vendor, or person is referenced.','Widgetly ships synthetic milestone 20260103-0 by Q3 2026','2026-01-03','Widgetly ships synthetic milestone 20260103-0 by Q3 2026','fixture announcement observed on 2026-01-03','the synthetic market always follows its announcements','Widgetly lands milestone 0 within two quarters','Q3 2026, fixture scope','Widgetly will finish milestone 0 soon.','[ja] Widgetly ships synthetic milestone 20260103-0 by Q3 2026','[es] Widgetly ships synthetic milestone 20260103-0 by Q3 2026','[fil] Widgetly ships synthetic milestone 20260103-0 by Q3 2026','[ja] fixture announcement observed on 2026-01-03','[es] fixture announcement observed on 2026-01-03','[fil] fixture announcement observed on 2026-01-03','[ja] the synthetic market always follows its announcements','[es] the synthetic market always follows its announcements','[fil] the synthetic market always follows its announcements','[ja] Widgetly lands milestone 0 within two quarters','[es] Widgetly lands milestone 0 within two quarters','[fil] Widgetly lands milestone 0 within two quarters','[ja] Q3 2026, fixture scope','[es] Q3 2026, fixture scope','[fil] Q3 2026, fixture scope','[ja] Widgetly will finish milestone 0 soon.','[es] Widgetly will finish milestone 0 soon.','[fil] Widgetly will finish milestone 0 soon.','2026-07-01','2026-09-30','Widgetly is expected to land synthetic milestone 0. This is fixture prose used only by the test suite.','[ja] Widgetly is expected to land synthetic milestone 0. This is fixture prose used only by the test suite.','[es] Widgetly is expected to land synthetic milestone 0. This is fixture prose used only by the test suite.','[fil] Widgetly is expected to land synthetic milestone 0. This is fixture prose used only by the test suite.',NULL,'[ja] Widgetly announced a synthetic milestone on 2026-01-03. This fixture prediction exists to exercise the pipeline shape: it claims the vendor lands milestone 0 within two quarters, citing the fixture announcement. No real product, vendor, or person is referenced.','[es] Widgetly announced a synthetic milestone on 2026-01-03. This fixture prediction exists to exercise the pipeline shape: it claims the vendor lands milestone 0 within two quarters, citing the fixture announcement. No real product, vendor, or person is referenced.','[fil] Widgetly announced a synthetic milestone on 2026-01-03. This fixture prediction exists to exercise the pipeline shape: it claims the vendor lands milestone 0 within two quarters, citing the fixture announcement. No real product, vendor, or person is referenced.','[ja] Widgetly ships synthetic milestone 20260103-0 by Q3 2026','[es] Widgetly ships synthetic milestone 20260103-0 by Q3 2026','[fil] Widgetly ships synthetic milestone 20260103-0 by Q3 2026','source.56afd1ba8a45f48d',0,'Widgetly announced a synthetic milestone on 2026-01-03. This fixture prediction exists to exercise the pipeline shape: it claims the vendor lands milestone 0 within two quarters, citing the fixture announcement. No real product, vendor, or person is referenced.',NULL,'1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "predictions" VALUES('prediction.bcfbfe1298ff4ec1','Acme Metrics announced a synthetic milestone on 2026-01-03. This fixture prediction exists to exercise the pipeline shape: it claims the vendor lands milestone 1 within two quarters, citing the fixture announcement. No real product, vendor, or person is referenced.','Acme Metrics ships synthetic milestone 20260103-1 by Q3 2026','2026-01-03','Acme Metrics ships synthetic milestone 20260103-1 by Q3 2026','fixture announcement observed on 2026-01-03','the synthetic market always follows its announcements','Acme Metrics lands milestone 1 within two quarters','Q3 2026, fixture scope','Acme Metrics will finish milestone 1 soon.','[ja] Acme Metrics ships synthetic milestone 20260103-1 by Q3 2026','[es] Acme Metrics ships synthetic milestone 20260103-1 by Q3 2026','[fil] Acme Metrics ships synthetic milestone 20260103-1 by Q3 2026','[ja] fixture announcement observed on 2026-01-03','[es] fixture announcement observed on 2026-01-03','[fil] fixture announcement observed on 2026-01-03','[ja] the synthetic market always follows its announcements','[es] the synthetic market always follows its announcements','[fil] the synthetic market always follows its announcements','[ja] Acme Metrics lands milestone 1 within two quarters','[es] Acme Metrics lands milestone 1 within two quarters','[fil] Acme Metrics lands milestone 1 within two quarters','[ja] Q3 2026, fixture scope','[es] Q3 2026, fixture scope','[fil] Q3 2026, fixture scope','[ja] Acme Metrics will finish milestone 1 soon.','[es] Acme Metrics will finish milestone 1 soon.','[fil] Acme Metrics will finish milestone 1 soon.','2026-07-01','2026-09-30','Acme Metrics is expected to land synthetic milestone 1. This is fixture prose used only by the test suite.','[ja] Acme Metrics is expected to land synthetic milestone 1. This is fixture prose used only by the test suite.','[es] Acme Metrics is expected to land synthetic milestone 1. This is fixture prose used only by the test suite.','[fil] Acme Metrics is expected to land synthetic milestone 1. This is fixture prose used only by the test suite.',NULL,'[ja] Acme Metrics announced a synthetic milestone on 2026-01-03. This fixture prediction exists to exercise the pipeline shape: it claims the vendor lands milestone 1 within two quarters, citing the fixture announcement. No real product, vendor, or person is referenced.','[es] Acme Metrics announced a synthetic milestone on 2026-01-03. This fixture prediction exists to exercise the pipeline shape: it claims the vendor lands milestone 1 within two quarters, citing the fixture announcement. No real product, vendor, or person is referenced.','[fil] Acme Metrics announced a synthetic milestone on 2026-01-03. This fixture prediction exists to exercise the pipeline shape: it claims the vendor lands milestone 1 within two quarters, citing the fixture announcement. No real product, vendor, or person is referenced.','[ja] Acme Metrics ships synthetic milestone 20260103-1 by Q3 2026','[es] Acme Metrics ships synthetic milestone 20260103-1 by Q3 2026','[fil] Acme Metrics ships synthetic milestone 20260103-1 by Q3 2026','source.56afd1ba8a45f48d',1,'Acme Metrics announced a synthetic milestone on 2026-01-03. This fixture prediction exists to exercise the pipeline shape: it claims the vendor lands milestone 1 within two quarters, citing the fixture announcement. No real product, vendor, or person is referenced.',NULL,'1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "predictions" VALUES('prediction.55acc78b25e9754a','Exampletron announced a synthetic milestone on 2026-01-03. This fixture prediction exists to exercise the pipeline shape: it claims the vendor lands milestone 2 within two quarters, citing the fixture announcement. No real product, vendor, or person is referenced.','Exampletron ships synthetic milestone 20260103-2 by Q3 2026','2026-01-03','Exampletron ships synthetic milestone 20260103-2 by Q3 2026','fixture announcement observed on 2026-01-03','the synthetic market always follows its announcements','Exampletron lands milestone 2 within two quarters','Q3 2026, fixture scope','Exampletron will finish milestone 2 soon.','[ja] Exampletron ships synthetic milestone 20260103-2 by Q3 2026','[es] Exampletron ships synthetic milestone 20260103-2 by Q3 2026','[fil] Exampletron ships synthetic milestone 20260103-2 by Q3 2026','[ja] fixture announcement observed on 2026-01-03','[es] fixture announcement observed on 2026-01-03','[fil] fixture announcement observed on 2026-01-03','[ja] the synthetic market always follows its announcements','[es] the synthetic market always follows its announcements','[fil] the synthetic market always follows its announcements','[ja] Exampletron lands milestone 2 within two quarters','[es] Exampletron lands milestone 2 within two quarters','[fil] Exampletron lands milestone 2 within two quarters','[ja] Q3 2026, fixture scope','[es] Q3 2026, fixture scope','[fil] Q3 2026, fixture scope','[ja] Exampletron will finish milestone 2 soon.','[es] Exampletron will finish milestone 2 soon.','[fil] Exampletron will finish milestone 2 soon.','2026-07-01','2026-09-30','Exampletron is expected to land synthetic milestone 2. This is fixture prose used only by the test suite.','[ja] Exampletron is expected to land synthetic milestone 2. This is fixture prose used only by the test suite.','[es] Exampletron is expected to land synthetic milestone 2. This is fixture prose used only by the test suite.','[fil] Exampletron is expected to land synthetic milestone 2. This is fixture prose used only by the test suite.',NULL,'[ja] Exampletron announced a synthetic milestone on 2026-01-03. This fixture prediction exists to exercise the pipeline shape: it claims the vendor lands milestone 2 within two quarters, citing the fixture announcement. No real product, vendor, or person is referenced.','[es] Exampletron announced a synthetic milestone on 2026-01-03. This fixture prediction exists to exercise the pipeline shape: it claims the vendor lands milestone 2 within two quarters, citing the fixture announcement. No real product, vendor, or person is referenced.','[fil] Exampletron announced a synthetic milestone on 2026-01-03. This fixture prediction exists to exercise the pipeline shape: it claims the vendor lands milestone 2 within two quarters, citing the fixture announcement. No real product, vendor, or person is referenced.','[ja] Exampletron ships synthetic milestone 20260103-2 by Q3 2026','[es] Exampletron ships synthetic milestone 20260103-2 by Q3 2026','[fil] Exampletron ships synthetic milestone 20260103-2 by Q3 2026','source.56afd1ba8a45f48d',2,'Exampletron announced a synthetic milestone on 2026-01-03. This fixture prediction exists to exercise the pipeline shape: it claims the vendor lands milestone 2 within two quarters, citing the fixture announcement. No real product, vendor, or person is referenced.',NULL,'1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "predictions" VALUES('prediction.9bcf1ecbcbd67a64','Widgetly announced a synthetic milestone on 2026-01-04. This fixture prediction exists to exercise the pipeline shape: it claims the vendor lands milestone 0 within two quarters, citing the fixture announcement. No real product, vendor, or person is referenced.','Widgetly ships synthetic milestone 20260104-0 by Q3 2026','2026-01-04','Widgetly ships synthetic milestone 20260104-0 by Q3 2026','fixture announcement observed on 2026-01-04','the synthetic market always follows its announcements','Widgetly lands milestone 0 within two quarters','Q3 2026, fixture scope','Widgetly will finish milestone 0 soon.','[ja] Widgetly ships synthetic milestone 20260104-0 by Q3 2026','[es] Widgetly ships synthetic milestone 20260104-0 by Q3 2026','[fil] Widgetly ships synthetic milestone 20260104-0 by Q3 2026','[ja] fixture announcement observed on 2026-01-04','[es] fixture announcement observed on 2026-01-04','[fil] fixture announcement observed on 2026-01-04','[ja] the synthetic market always follows its announcements','[es] the synthetic market always follows its announcements','[fil] the synthetic market always follows its announcements','[ja] Widgetly lands milestone 0 within two quarters','[es] Widgetly lands milestone 0 within two quarters','[fil] Widgetly lands milestone 0 within two quarters','[ja] Q3 2026, fixture scope','[es] Q3 2026, fixture scope','[fil] Q3 2026, fixture scope','[ja] Widgetly will finish milestone 0 soon.','[es] Widgetly will finish milestone 0 soon.','[fil] Widgetly will finish milestone 0 soon.','2026-07-01','2026-09-30','Widgetly is expected to land synthetic milestone 0. This is fixture prose used only by the test suite.','[ja] Widgetly is expected to land synthetic milestone 0. This is fixture prose used only by the test suite.','[es] Widgetly is expected to land synthetic milestone 0. This is fixture prose used only by the test suite.','[fil] Widgetly is expected to land synthetic milestone 0. This is fixture prose used only by the test suite.',NULL,'[ja] Widgetly announced a synthetic milestone on 2026-01-04. This fixture prediction exists to exercise the pipeline shape: it claims the vendor lands milestone 0 within two quarters, citing the fixture announcement. No real product, vendor, or person is referenced.','[es] Widgetly announced a synthetic milestone on 2026-01-04. This fixture prediction exists to exercise the pipeline shape: it claims the vendor lands milestone 0 within two quarters, citing the fixture announcement. No real product, vendor, or person is referenced.','[fil] Widgetly announced a synthetic milestone on 2026-01-04. This fixture prediction exists to exercise the pipeline shape: it claims the vendor lands milestone 0 within two quarters, citing the fixture announcement. No real product, vendor, or person is referenced.','[ja] Widgetly ships synthetic milestone 20260104-0 by Q3 2026','[es] Widgetly ships synthetic milestone 20260104-0 by Q3 2026','[fil] Widgetly ships synthetic milestone 20260104-0 by Q3 2026','source.3ff634492af20a34',0,'Widgetly announced a synthetic milestone on 2026-01-04. This fixture prediction exists to exercise the pipeline shape: it claims the vendor lands milestone 0 within two quarters, citing the fixture announcement. No real product, vendor, or person is referenced.',NULL,'1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "predictions" VALUES('prediction.a56031469a9a7ed3','Acme Metrics announced a synthetic milestone on 2026-01-04. This fixture prediction exists to exercise the pipeline shape: it claims the vendor lands milestone 1 within two quarters, citing the fixture announcement. No real product, vendor, or person is referenced.','Acme Metrics ships synthetic milestone 20260104-1 by Q3 2026','2026-01-04','Acme Metrics ships synthetic milestone 20260104-1 by Q3 2026','fixture announcement observed on 2026-01-04','the synthetic market always follows its announcements','Acme Metrics lands milestone 1 within two quarters','Q3 2026, fixture scope','Acme Metrics will finish milestone 1 soon.','[ja] Acme Metrics ships synthetic milestone 20260104-1 by Q3 2026','[es] Acme Metrics ships synthetic milestone 20260104-1 by Q3 2026','[fil] Acme Metrics ships synthetic milestone 20260104-1 by Q3 2026','[ja] fixture announcement observed on 2026-01-04','[es] fixture announcement observed on 2026-01-04','[fil] fixture announcement observed on 2026-01-04','[ja] the synthetic market always follows its announcements','[es] the synthetic market always follows its announcements','[fil] the synthetic market always follows its announcements','[ja] Acme Metrics lands milestone 1 within two quarters','[es] Acme Metrics lands milestone 1 within two quarters','[fil] Acme Metrics lands milestone 1 within two quarters','[ja] Q3 2026, fixture scope','[es] Q3 2026, fixture scope','[fil] Q3 2026, fixture scope','[ja] Acme Metrics will finish milestone 1 soon.','[es] Acme Metrics will finish milestone 1 soon.','[fil] Acme Metrics will finish milestone 1 soon.','2026-07-01','2026-09-30','Acme Metrics is expected to land synthetic milestone 1. This is fixture prose used only by the test suite.','[ja] Acme Metrics is expected to land synthetic milestone 1. This is fixture prose used only by the test suite.','[es] Acme Metrics is expected to land synthetic milestone 1. This is fixture prose used only by the test suite.','[fil] Acme Metrics is expected to land synthetic milestone 1. This is fixture prose used only by the test suite.',NULL,'[ja] Acme Metrics announced a synthetic milestone on 2026-01-04. This fixture prediction exists to exercise the pipeline shape: it claims the vendor lands milestone 1 within two quarters, citing the fixture announcement. No real product, vendor, or person is referenced.','[es] Acme Metrics announced a synthetic milestone on 2026-01-04. This fixture prediction exists to exercise the pipeline shape: it claims the vendor lands milestone 1 within two quarters, citing the fixture announcement. No real product, vendor, or person is referenced.','[fil] Acme Metrics announced a synthetic milestone on 2026-01-04. This fixture prediction exists to exercise the pipeline shape: it claims the vendor lands milestone 1 within two quarters, citing the fixture announcement. No real product, vendor, or person is referenced.','[ja] Acme Metrics ships synthetic milestone 20260104-1 by Q3 2026','[es] Acme Metrics ships synthetic milestone 20260104-1 by Q3 2026','[fil] Acme Metrics ships synthetic milestone 20260104-1 by Q3 2026','source.3ff634492af20a34',1,'Acme Metrics announced a synthetic milestone on 2026-01-04. This fixture prediction exists to exercise the pipeline shape: it claims the vendor lands milestone 1 within two quarters, citing the fixture announcement. No real product, vendor, or person is referenced.',NULL,'1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "predictions" VALUES('prediction.5ef4de1cc1f71cd0','Exampletron announced a synthetic milestone on 2026-01-04. This fixture prediction exists to exercise the pipeline shape: it claims the vendor lands milestone 2 within two quarters, citing the fixture announcement. No real product, vendor, or person is referenced.','Exampletron ships synthetic milestone 20260104-2 by Q3 2026','2026-01-04','Exampletron ships synthetic milestone 20260104-2 by Q3 2026','fixture announcement observed on 2026-01-04','the synthetic market always follows its announcements','Exampletron lands milestone 2 within two quarters','Q3 2026, fixture scope','Exampletron will finish milestone 2 soon.','[ja] Exampletron ships synthetic milestone 20260104-2 by Q3 2026','[es] Exampletron ships synthetic milestone 20260104-2 by Q3 2026','[fil] Exampletron ships synthetic milestone 20260104-2 by Q3 2026','[ja] fixture announcement observed on 2026-01-04','[es] fixture announcement observed on 2026-01-04','[fil] fixture announcement observed on 2026-01-04','[ja] the synthetic market always follows its announcements','[es] the synthetic market always follows its announcements','[fil] the synthetic market always follows its announcements','[ja] Exampletron lands milestone 2 within two quarters','[es] Exampletron lands milestone 2 within two quarters','[fil] Exampletron lands milestone 2 within two quarters','[ja] Q3 2026, fixture scope','[es] Q3 2026, fixture scope','[fil] Q3 2026, fixture scope','[ja] Exampletron will finish milestone 2 soon.','[es] Exampletron will finish milestone 2 soon.','[fil] Exampletron will finish milestone 2 soon.','2026-07-01','2026-09-30','Exampletron is expected to land synthetic milestone 2. This is fixture prose used only by the test suite.','[ja] Exampletron is expected to land synthetic milestone 2. This is fixture prose used only by the test suite.','[es] Exampletron is expected to land synthetic milestone 2. This is fixture prose used only by the test suite.','[fil] Exampletron is expected to land synthetic milestone 2. This is fixture prose used only by the test suite.',NULL,'[ja] Exampletron announced a synthetic milestone on 2026-01-04. This fixture prediction exists to exercise the pipeline shape: it claims the vendor lands milestone 2 within two quarters, citing the fixture announcement. No real product, vendor, or person is referenced.','[es] Exampletron announced a synthetic milestone on 2026-01-04. This fixture prediction exists to exercise the pipeline shape: it claims the vendor lands milestone 2 within two quarters, citing the fixture announcement. No real product, vendor, or person is referenced.','[fil] Exampletron announced a synthetic milestone on 2026-01-04. This fixture prediction exists to exercise the pipeline shape: it claims the vendor lands milestone 2 within two quarters, citing the fixture announcement. No real product, vendor, or person is referenced.','[ja] Exampletron ships synthetic milestone 20260104-2 by Q3 2026','[es] Exampletron ships synthetic milestone 20260104-2 by Q3 2026','[fil] Exampletron ships synthetic milestone 20260104-2 by Q3 2026','source.3ff634492af20a34',2,'Exampletron announced a synthetic milestone on 2026-01-04. This fixture prediction exists to exercise the pipeline shape: it claims the vendor lands milestone 2 within two quarters, citing the fixture announcement. No real product, vendor, or person is referenced.',NULL,'1970-01-01 00:00:00','1970-01-01T00:00:00Z');
CREATE TABLE scopes (
  scope_id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT
);
INSERT INTO "scopes" VALUES('tech','Technology','Technical mechanisms, architecture, models, security, infrastructure, and standards.',1,'1970-01-01 00:00:00',NULL);
INSERT INTO "scopes" VALUES('business','Business','Market structure, competition, distribution, adoption, regulation, and capital strategy.',1,'1970-01-01 00:00:00',NULL);
CREATE TABLE source_files (
  source_file_id TEXT PRIMARY KEY,
  path TEXT NOT NULL UNIQUE,
  file_type TEXT NOT NULL CHECK (file_type IN ('daily_report', 'future_prediction_report', 'other')),
  report_date TEXT,
  content_sha TEXT,
  parsed_at TEXT,
  locale TEXT NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'ja', 'es', 'fil')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "source_files" VALUES('source.1fe799910eb1cd09','data/sourcedata/2026-01-02/predictions.json','daily_report','2026-01-02','78e217c67213d15e0a04a2c20163360dcd179615','1970-01-01T00:00:00Z','en','1970-01-01 00:00:00');
INSERT INTO "source_files" VALUES('source.b762ae83fa1a88db','data/sourcedata/2026-01-02/bridges.json','future_prediction_report','2026-01-02','b3e30747e4639a51d9012690b13073234bb0266d','1970-01-01T00:00:00Z','en','1970-01-01 00:00:00');
INSERT INTO "source_files" VALUES('source.5f83a80931b18e21','data/sourcedata/2026-01-02/readings.json','other','2026-01-02','d68f27953183c0483771f1ee32cd6757b17b66a0','1970-01-01T00:00:00Z','en','1970-01-01 00:00:00');
INSERT INTO "source_files" VALUES('source.9e1bc5d34febf7a4','data/sourcedata/2026-01-02/headlines.json','other','2026-01-02','8fdbd493340c8528b8c56ae8b4e96e661757933c','1970-01-01T00:00:00Z','en','1970-01-01 00:00:00');
INSERT INTO "source_files" VALUES('source.cbe51a9848b4ac3b','data/sourcedata/2026-01-02/change_log.json','other','2026-01-02','00cc37c40ffa81e8f5e699359d40c5ae87a118f4','1970-01-01T00:00:00Z','en','1970-01-01 00:00:00');
INSERT INTO "source_files" VALUES('source.4a3c60415c8218db','data/sourcedata/2026-01-02/news_section.json','other','2026-01-02','ebb8df0eae016e09dbb1330ae5d3ff3a14b1401e','1970-01-01T00:00:00Z','en','1970-01-01 00:00:00');
INSERT INTO "source_files" VALUES('source.56afd1ba8a45f48d','data/sourcedata/2026-01-03/predictions.json','daily_report','2026-01-03','141e15d4f1f036f95d4d8c3001692d7b0da4252c','1970-01-01T00:00:00Z','en','1970-01-01 00:00:00');
INSERT INTO "source_files" VALUES('source.88a664cde7570cef','data/sourcedata/2026-01-03/bridges.json','future_prediction_report','2026-01-03','6d5c98cad7caa7fca4a1b05b4dcb328bb6f68771','1970-01-01T00:00:00Z','en','1970-01-01 00:00:00');
INSERT INTO "source_files" VALUES('source.85824dcd2c7933ae','data/sourcedata/2026-01-03/readings.json','other','2026-01-03','44a9529a82235f9f93e8e90e74b427750f66afcc','1970-01-01T00:00:00Z','en','1970-01-01 00:00:00');
INSERT INTO "source_files" VALUES('source.89d2ba7d92fdea3d','data/sourcedata/2026-01-03/headlines.json','other','2026-01-03','f3aa22b88de6e728039af36bbbde153b57079881','1970-01-01T00:00:00Z','en','1970-01-01 00:00:00');
INSERT INTO "source_files" VALUES('source.038720b8ebda813b','data/sourcedata/2026-01-03/change_log.json','other','2026-01-03','db75bc98daf6ec8ee9402dac618361fecbf9cb08','1970-01-01T00:00:00Z','en','1970-01-01 00:00:00');
INSERT INTO "source_files" VALUES('source.cd840d225743ce90','data/sourcedata/2026-01-03/news_section.json','other','2026-01-03','f07af9c1da093e37dbd3f42f9dca76a124fb27c7','1970-01-01T00:00:00Z','en','1970-01-01 00:00:00');
INSERT INTO "source_files" VALUES('source.3ff634492af20a34','data/sourcedata/2026-01-04/predictions.json','daily_report','2026-01-04','05df076f9981a97c9e03fcf74b63988c3664ba3f','1970-01-01T00:00:00Z','en','1970-01-01 00:00:00');
INSERT INTO "source_files" VALUES('source.908ca8b3de629dc1','data/sourcedata/2026-01-04/bridges.json','future_prediction_report','2026-01-04','bafd333704b0fd4ad16498e7cf5bbd14c0ec73bd','1970-01-01T00:00:00Z','en','1970-01-01 00:00:00');
INSERT INTO "source_files" VALUES('source.670543f03c2d8ed8','data/sourcedata/2026-01-04/readings.json','other','2026-01-04','2b46e069f4977d7b8b184f0a31ba420fce3d3d28','1970-01-01T00:00:00Z','en','1970-01-01 00:00:00');
INSERT INTO "source_files" VALUES('source.b2ed9770e32d185c','data/sourcedata/2026-01-04/headlines.json','other','2026-01-04','5625ec0db793854736758764c581fb3e3551d98e','1970-01-01T00:00:00Z','en','1970-01-01 00:00:00');
INSERT INTO "source_files" VALUES('source.f5cccae8a2937a7e','data/sourcedata/2026-01-04/change_log.json','other','2026-01-04','69145a385b30ecaef904913f32be4fcaeb12c39d','1970-01-01T00:00:00Z','en','1970-01-01 00:00:00');
INSERT INTO "source_files" VALUES('source.b1dce7db1dd911a3','data/sourcedata/2026-01-04/news_section.json','other','2026-01-04','5f543bdbf22a510de8623389056cd0166d05d780','1970-01-01T00:00:00Z','en','1970-01-01 00:00:00');
DELETE FROM "sqlite_sequence";
CREATE TABLE theme_candidates (
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
INSERT INTO "theme_candidates" VALUES('candidate.819988f7441888e8','tech',NULL,'Widgetly ships synthetic milestone 20260103-0 by Q3 2026','Widgetly ships synthetic milestone 20260103-0 by Q3 2026','Widgetly announced a synthetic milestone on 2026-01-03. This fixture prediction exists to exercise the pipeline shape: it claims the vendor lands milestone 0 within two quarters, citing the fixture announcement. No real product, vendor, or person is referenced.',NULL,'prediction.394e027e97187004','no_keyword_match',NULL,NULL,NULL,'pending',NULL,'1970-01-01 00:00:00',NULL);
INSERT INTO "theme_candidates" VALUES('candidate.03a72d7d0e1c3595','tech',NULL,'Acme Metrics ships synthetic milestone 20260103-1 by Q3 2026','Acme Metrics ships synthetic milestone 20260103-1 by Q3 2026','Acme Metrics announced a synthetic milestone on 2026-01-03. This fixture prediction exists to exercise the pipeline shape: it claims the vendor lands milestone 1 within two quarters, citing the fixture announcement. No real product, vendor, or person is referenced.',NULL,'prediction.bcfbfe1298ff4ec1','no_keyword_match',NULL,NULL,NULL,'pending',NULL,'1970-01-01 00:00:00',NULL);
INSERT INTO "theme_candidates" VALUES('candidate.4ff5b5bae551d665','tech',NULL,'Exampletron ships synthetic milestone 20260103-2 by Q3 2026','Exampletron ships synthetic milestone 20260103-2 by Q3 2026','Exampletron announced a synthetic milestone on 2026-01-03. This fixture prediction exists to exercise the pipeline shape: it claims the vendor lands milestone 2 within two quarters, citing the fixture announcement. No real product, vendor, or person is referenced.',NULL,'prediction.55acc78b25e9754a','no_keyword_match',NULL,NULL,NULL,'pending',NULL,'1970-01-01 00:00:00',NULL);
INSERT INTO "theme_candidates" VALUES('candidate.47c0557d5ea9f06c','tech',NULL,'Widgetly ships synthetic milestone 20260104-0 by Q3 2026','Widgetly ships synthetic milestone 20260104-0 by Q3 2026','Widgetly announced a synthetic milestone on 2026-01-04. This fixture prediction exists to exercise the pipeline shape: it claims the vendor lands milestone 0 within two quarters, citing the fixture announcement. No real product, vendor, or person is referenced.',NULL,'prediction.9bcf1ecbcbd67a64','no_keyword_match',NULL,NULL,NULL,'pending',NULL,'1970-01-01 00:00:00',NULL);
INSERT INTO "theme_candidates" VALUES('candidate.0f8830307c41626f','tech',NULL,'Acme Metrics ships synthetic milestone 20260104-1 by Q3 2026','Acme Metrics ships synthetic milestone 20260104-1 by Q3 2026','Acme Metrics announced a synthetic milestone on 2026-01-04. This fixture prediction exists to exercise the pipeline shape: it claims the vendor lands milestone 1 within two quarters, citing the fixture announcement. No real product, vendor, or person is referenced.',NULL,'prediction.a56031469a9a7ed3','no_keyword_match',NULL,NULL,NULL,'pending',NULL,'1970-01-01 00:00:00',NULL);
INSERT INTO "theme_candidates" VALUES('candidate.8f039c1782c2899d','tech',NULL,'Exampletron ships synthetic milestone 20260104-2 by Q3 2026','Exampletron ships synthetic milestone 20260104-2 by Q3 2026','Exampletron announced a synthetic milestone on 2026-01-04. This fixture prediction exists to exercise the pipeline shape: it claims the vendor lands milestone 2 within two quarters, citing the fixture announcement. No real product, vendor, or person is referenced.',NULL,'prediction.5ef4de1cc1f71cd0','no_keyword_match',NULL,NULL,NULL,'pending',NULL,'1970-01-01 00:00:00',NULL);
CREATE TABLE theme_history (
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
CREATE TABLE theme_mappings (
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
CREATE TABLE themes (
  theme_id TEXT PRIMARY KEY,
  scope_id TEXT NOT NULL,
  category_id TEXT NOT NULL,

  canonical_label TEXT NOT NULL,
  short_label TEXT,
  generated_label TEXT,
  description TEXT,

  -- Locale columns. NULL = fall back to the canonical English value.
  label_ja TEXT,
  label_es TEXT,
  label_fil TEXT,
  short_label_ja TEXT,
  short_label_es TEXT,
  short_label_fil TEXT,
  description_ja TEXT,
  description_es TEXT,
  description_fil TEXT,

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
INSERT INTO "themes" VALUES('tech.one_bit_edge_llm','tech','tech.models','1-bit / Edge LLM','1-bit Edge LLM','1-bit / Edge LLM','1-bit native training, BitNet, Bonsai-8B, ternary-weight quantization, sub-4-bit compression, Qwen3 / Qwen3.6 derivatives, DeepSeek V4 hybrid attention, open-weight frontier models, compact 27B Dense local models, MLX / GGUF on-device deployment.','1ビット／エッジLLM','LLM de 1 bit / Edge','1-bit / Edge LLM','1ビット エッジLLM','LLM 1-bit Edge','1-bit Edge LLM',NULL,NULL,NULL,NULL,'active',NULL,NULL,NULL,NULL,NULL,NULL,'1970-01-01 00:00:00',NULL);
INSERT INTO "themes" VALUES('tech.agent_control_plane','tech','tech.agents','Agent Control Plane','Control Plane','Agent Control Plane','Agent identity, OAuth cross-trust between AI services, MCP-based authentication, agent gateways, coding-agent harness platforms (Claude Code, Codex, Cursor, Kiro), Entra Agent ID, Okta for AI Agents, Keycard, AWS Bedrock AgentCore, Headless agent orchestration, agent tool-permission management, control plane SaaS, Cisco Duo IAM for agents, Microsoft Zero Trust for AI agents.','エージェント制御プレーン','Plano de control de agentes','Agent Control Plane','制御プレーン','Plano de control','Control Plane',NULL,NULL,NULL,NULL,'active',NULL,NULL,NULL,NULL,NULL,NULL,'1970-01-01 00:00:00',NULL);
INSERT INTO "themes" VALUES('tech.agent_runtime_security','tech','tech.security','Agent Runtime Security','Agent Runtime','Agent Runtime Security','Indirect prompt injection vulnerabilities, sandbox escape, tool-misuse exploits, RCE in agent runtimes, CVE / CVSS / OWASP Agentic Top 10 categories, MCP attack surface, comment-and-control attacks, inference-server CVEs, vendor-boundary security standards.','エージェントランタイムセキュリティ','Seguridad del runtime de agentes','Seguridad ng Agent Runtime','エージェントランタイム','Runtime de agentes','Agent Runtime',NULL,NULL,NULL,NULL,'active',NULL,NULL,NULL,NULL,NULL,NULL,'1970-01-01 00:00:00',NULL);
INSERT INTO "themes" VALUES('tech.model_supply_chain','tech','tech.security','Model Supply Chain','Model Supply','Model Supply Chain','Model signing, provenance attestation, SLSA-for-models, sigstore, safetensors integrity, GGUF supply-chain risk, malicious model files, tokenizer templates, gated distribution programs, Anthropic Project Glasswing, Mythos Preview, partner-list distribution, usage-credit tier gates, AWS Bedrock Gated Research Preview, Bonsai / Qwen / Llama / DeepSeek / Kimi / GLM-5.1 distribution channels, Hugging Face / Ollama / ModelScope marketplace governance, model artifact attestation, loader-verification chain, training-to-tenant signed default loader, unified loader-verification model, framework-default loader shipment, five-framework signed-loader default, mid-2026 loader-reference-set anchor, GGUF signed-card upload gate, SSTI scan on model upload.','モデルサプライチェーン','Cadena de suministro de modelos','Model Supply Chain','モデル供給','Suministro de modelos','Model Supply','モデル署名、出所証明、SLSA-for-models、sigstore、safetensors 完全性、GGUF サプライチェーン・リスク、悪意あるモデルファイル、tokenizer テンプレート、ゲート付き配布プログラム、Anthropic Project Glasswing、Mythos Preview、パートナーリスト配布、利用クレジット階層ゲート、AWS Bedrock Gated Research Preview、Bonsai / Qwen / Llama / DeepSeek / Kimi / GLM-5.1 配布チャネル、Hugging Face / Ollama / ModelScope マーケットプレイス統治、モデル成果物アテステーション、ローダー検証チェーン、training-to-tenant 署名済みデフォルトローダー、統一ローダー検証モデル、フレームワークデフォルトのローダー出荷、5フレームワーク横断の署名済みローダーデフォルト、2026 年中盤のローダー参照セットアンカー、GGUF 署名済みカードによるアップロードゲート、モデルアップロード時の SSTI スキャン。','Firma de modelos, atestación de procedencia, SLSA-for-models, sigstore, integridad de safetensors, riesgo de cadena de suministro GGUF, archivos de modelo maliciosos, plantillas de tokenizer, programas de distribución gated, Anthropic Project Glasswing, Mythos Preview, distribución por lista de socios, gates de tier de créditos de uso, AWS Bedrock Gated Research Preview, canales de distribución Bonsai / Qwen / Llama / DeepSeek / Kimi / GLM-5.1, gobernanza de marketplace Hugging Face / Ollama / ModelScope, atestación de artefactos de modelo, cadena de loader-verification, loader firmado por defecto training-to-tenant, modelo unificado de loader-verification, envío de loader por defecto de framework, default firmado de loader a través de cinco frameworks, anclaje del conjunto de referencia de loader a mediados de 2026, gate de subida con tarjeta firmada GGUF, escaneo SSTI en subida de modelo.','Model signing, provenance attestation, SLSA-for-models, sigstore, safetensors integrity, GGUF supply-chain risk, mga maling model file, tokenizer templates, gated distribution programs, Anthropic Project Glasswing, Mythos Preview, partner-list distribution, usage-credit tier gates, AWS Bedrock Gated Research Preview, mga channel ng distribution ng Bonsai / Qwen / Llama / DeepSeek / Kimi / GLM-5.1, governance ng Hugging Face / Ollama / ModelScope marketplace, model artifact attestation, loader-verification chain, training-to-tenant signed default loader, unified loader-verification model, framework-default loader shipment, five-framework signed-loader default, mid-2026 loader-reference-set anchor, GGUF signed-card upload gate, SSTI scan sa pag-upload ng modelo.',NULL,'active',NULL,NULL,NULL,NULL,NULL,NULL,'1970-01-01 00:00:00',NULL);
INSERT INTO "themes" VALUES('tech.agent_registry_architecture','tech','tech.standards','Agent Registry Architecture','Agent Registry','Agent Registry Architecture','Registries for AI agent skills, tool-permission scopes, audit-log trails, MCP server inventory + metadata, cross-cloud agent identity sync, agent identity registration, Entra ID for agents, Defender per-agent relationship-map, Microsoft Agent 365 Registry Sync, AWS Bedrock + Google Gemini Enterprise registry, Anthropic Project Glasswing partner registry, Mythos partner list, agent artifact distribution, skill provenance attestation, registry hygiene controls, Skills marketplace governance.','エージェントレジストリアーキテクチャ','Arquitectura de registro de agentes','Arkitektura ng Agent Registry','エージェントレジストリ','Registro de agentes','Agent Registry','AI エージェントスキルのレジストリ、ツール権限スコープ、監査ログ、MCP サーバー在庫 + メタデータ、クロスクラウド・エージェント識別同期、エージェント識別登録、Entra ID for agents、Defender エージェント単位関係マップ、Microsoft Agent 365 Registry Sync、AWS Bedrock + Google Gemini Enterprise レジストリ、Anthropic Project Glasswing パートナーレジストリ、Mythos パートナーリスト、エージェント成果物配布、スキル出所証明、レジストリ衛生統制、Skills マーケットプレイス統治。','Registros para skills de agente AI, scopes de permisos de herramientas, audit logs, inventario + metadata de servidores MCP, sincronización cross-cloud de identidad de agente, registro de identidad de agente, Entra ID for agents, mapa de relaciones por agente Defender, Microsoft Agent 365 Registry Sync, AWS Bedrock + Google Gemini Enterprise registry, Anthropic Project Glasswing partner registry, Mythos partner list, distribución de artefactos de agente, atestación de procedencia de skills, controles de higiene de registro, gobernanza del marketplace de Skills.','Mga registry para sa AI agent skills, tool-permission scopes, audit-log trails, MCP server inventory + metadata, cross-cloud agent identity sync, agent identity registration, Entra ID for agents, Defender per-agent relationship-map, Microsoft Agent 365 Registry Sync, AWS Bedrock + Google Gemini Enterprise registry, Anthropic Project Glasswing partner registry, Mythos partner list, agent artifact distribution, skill provenance attestation, registry hygiene controls, governance ng Skills marketplace.',NULL,'active',NULL,NULL,NULL,NULL,NULL,NULL,'1970-01-01 00:00:00',NULL);
INSERT INTO "themes" VALUES('tech.local_inference_runtime','tech','tech.inference-runtime','Local Inference Runtime','Local Runtime','Local Inference Runtime','Local inference stacks: llama.cpp, Ollama, MLX, WebGPU, OpenVINO, vLLM, SGLang, Foundry-Local. Consumer-GPU runtime (RTX 4090 / 5090, M4 Max). Qwen / DeepSeek / Bonsai loaders. GGUF / safetensors loading. Coding-agent local backends. On-device inference for privacy / cost / latency.','ローカル推論ランタイム','Tiempo de ejecución local','Lokal na Inference Runtime','ローカルランタイム','Runtime local','Local Runtime',NULL,NULL,NULL,NULL,'active',NULL,NULL,NULL,NULL,NULL,NULL,'1970-01-01 00:00:00',NULL);
INSERT INTO "themes" VALUES('tech.ai_chip_architecture','tech','tech.infrastructure','AI Chip Architecture','AI Chips','AI Chip Architecture','TPU, Trainium, MAIA, MI300X, Cerebras IPO, WSE-3, AMD MI355X, AMD AI-accelerator revenue, training-vs-inference SKU split, accelerator-revenue 10-Q segment footnote, GB300 vs Trainium positioning, per-accelerator margin disclosure, hyperscaler custom silicon, accelerator-specific model behavior.','AIチップアーキテクチャ','Arquitectura de chips de IA','Arkitektura ng AI Chip','AIチップ','Chips de IA','AI Chips','TPU、Trainium、MAIA、MI300X、Cerebras IPO、WSE-3、AMD MI355X、AMDのAIアクセラレータ売上、トレーニング/インファレンスSKU分離、10-Qセグメント脚注でのアクセラレータ売上開示、GB300対Trainiumのポジショニング、アクセラレータ単位の利益開示、ハイパースケーラのカスタムシリコン、アクセラレータ固有のモデル挙動。','TPU, Trainium, MAIA, MI300X, Cerebras IPO, WSE-3, AMD MI355X, ingresos AMD por aceleradores AI, separación de SKU entrenamiento/inferencia, divulgación 10-Q de ingresos por aceleradores, posicionamiento GB300 vs Trainium, divulgación de margen por acelerador, silicio personalizado de hyperscaler, comportamiento de modelo específico por acelerador.','TPU, Trainium, MAIA, MI300X, Cerebras IPO, WSE-3, AMD MI355X, AMD AI-accelerator revenue, paghahati ng training-vs-inference SKU, accelerator-revenue 10-Q segment footnote, positioning ng GB300 kumpara sa Trainium, per-accelerator margin disclosure, custom silicon ng hyperscaler, accelerator-specific na ugali ng modelo.',NULL,'active',NULL,NULL,NULL,NULL,NULL,NULL,'1970-01-01 00:00:00',NULL);
INSERT INTO "themes" VALUES('tech.physical_ai_robotics','tech','tech.infrastructure','Physical AI / Robotics','Physical AI','Physical AI / Robotics','Humanoid robots, Robot-as-a-Service (RaaS), production-line robotics, Siemens HMND 01, NVIDIA Isaac GR00T, NVIDIA Cosmos, Neura × AWS, DEEPX × Hyundai, IROS robotics benchmarks, GTC robotics league tables, Foxconn, FANUC, Universal Robots, Agility Digit, Figure 02, Apptronik Apollo, Tesla Optimus, AEON, Mega Omniverse, Hannover Messe Physical AI, 8-hour autonomous production runs.','フィジカルAI／ロボティクス','IA Física / Robótica','Physical AI / Robotics','フィジカルAI','IA Física','Physical AI',NULL,NULL,NULL,NULL,'active',NULL,NULL,NULL,NULL,NULL,NULL,'1970-01-01 00:00:00',NULL);
INSERT INTO "themes" VALUES('business.cloud_vs_local_distribution','business','business.distribution','Cloud vs Local AI Distribution','Cloud vs Local','Cloud vs Local AI Distribution','Local on-device inference vs hosted cloud frontier AI, edge deployment, cloud-overflow inversion, SMB local-first adoption, distribution model shifts (hosted API vs open-weight download), privacy-driven local choices.','クラウド対ローカルAI配信','Distribución de IA: nube vs local','Cloud vs Lokal na AI','クラウド対ローカル','Nube vs Local','Cloud vs Lokal',NULL,NULL,NULL,NULL,'active',NULL,NULL,NULL,NULL,NULL,NULL,'1970-01-01 00:00:00',NULL);
INSERT INTO "themes" VALUES('business.hyperscaler_frontier_lab_alliance','business','business.market-structure','Hyperscaler × Frontier Lab Alliance','Hyperscaler Alliance','Hyperscaler × Frontier Lab Alliance','Exclusive alliance contracts between hyperscalers and frontier AI labs (AWS × Anthropic, Google × Thinking Machines Lab, Microsoft × OpenAI), Tier-1 compute capacity capture, multi-billion compute commitments, capital coupling between cloud providers and labs, GB300 / Trainium exclusivity, platform lock-in via training and serving infrastructure.','ハイパースケーラ × フロンティアラボ提携','Alianza hyperscaler × laboratorio frontier','Hyperscaler x Frontier Lab Alliance','ハイパースケーラ提携','Alianza hyperscaler','Hyperscaler Alliance',NULL,NULL,NULL,NULL,'active',NULL,NULL,NULL,NULL,NULL,NULL,'1970-01-01 00:00:00',NULL);
INSERT INTO "themes" VALUES('business.open_weight_vs_proprietary','business','business.competition','Open Weight vs Proprietary AI','Open vs Proprietary','Open Weight vs Proprietary AI','Open-weight versus hosted-only model dynamics, geopolitical fragmentation, proprietary frontier model gating, MIT license / Apache-2.0 / open-source-license model releases, BenchLM Chinese leaderboard, Hugging Face open-weight downloads, gpt-oss series, DeepSeek / Qwen / Kimi / GLM / Mistral / Llama open-weight cohort, per-token pricing floor competition, Google Gemini Flash-Lite tier, frontier-vendor small-model tier vs Chinese open-weight stack.','オープン重み対プロプライエタリAI','IA de pesos abiertos vs propietaria','Open-Weight vs Proprietary AI','オープン対プロプライエタリ','Abierto vs Propietario','Open vs Proprietary','オープン重み対ホスト型モデルのダイナミクス、地政学的分断、プロプライエタリ・フロンティアモデルのゲート、MIT ライセンス / Apache-2.0 / オープンソース・ライセンスでのモデルリリース、BenchLM 中国リーダーボード、Hugging Face オープン・ウェイト・ダウンロード、gpt-oss シリーズ、DeepSeek / Qwen / Kimi / GLM / Mistral / Llama オープン・ウェイト・コホート、トークン単価マージン圧縮競合、Google Gemini Flash-Lite 層、フロンティア・ベンダー小型モデル層 vs 中国オープン・ウェイト・スタック。','Dinámicas de modelo open-weight vs hosted-only, fragmentación geopolítica, gating de modelos frontera propietarios, lanzamientos de modelos con licencia MIT / Apache-2.0 / open-source, BenchLM Chinese leaderboard, descargas open-weight de Hugging Face, serie gpt-oss, cohort open-weight de DeepSeek / Qwen / Kimi / GLM / Mistral / Llama, competencia de piso de precio per-token, tier Google Gemini Flash-Lite, tier de modelo pequeño de frontier-vendor vs stack open-weight chino.','Open-weight versus hosted-only model dynamics, geopolitical fragmentation, proprietary frontier model gating, mga release ng modelo na may MIT license / Apache-2.0 / open-source license, BenchLM Chinese leaderboard, Hugging Face open-weight downloads, gpt-oss series, DeepSeek / Qwen / Kimi / GLM / Mistral / Llama open-weight cohort, kompetensya sa per-token pricing floor, Google Gemini Flash-Lite tier, frontier-vendor small-model tier vs Chinese open-weight stack.',NULL,'active',NULL,NULL,NULL,NULL,NULL,NULL,'1970-01-01 00:00:00',NULL);
INSERT INTO "themes" VALUES('business.ai_security_compliance_market','business','business.regulation-compliance','AI Security Compliance Market','AI Security Compliance','AI Security Compliance Market','AI vulnerability disclosures becoming compliance categories, CVE / CVSS scoring of AI bugs, OWASP LLM Top 10 / OWASP Agentic Top 10, enterprise risk-budget allocation for AI, security-tooling spend (Wiz AI-APP, CrowdStrike, Palo Alto, Zenity, Keycard), FedRAMP for AI, audit / disclosure obligations.','AIセキュリティ・コンプライアンス市場','Mercado de cumplimiento de seguridad de IA','Merkado ng AI Security Compliance','AIセキュリティ・コンプラ','Cumplimiento IA','AI Security Compliance',NULL,NULL,NULL,NULL,'active',NULL,NULL,NULL,NULL,NULL,NULL,'1970-01-01 00:00:00',NULL);
INSERT INTO "themes" VALUES('business.developer_platformization','business','business.enterprise-adoption','Developer Toolchain Platformization','Dev Platformization','Developer Toolchain Platformization','AI coding agent platforms (Claude Code, Codex, Cursor, Kiro), IDE integration, CI/CD agent runners, developer tool registries, enterprise developer-workflow consolidation, code-review automation, agent-driven repository operations, Skills marketplace adoption, Microsoft Build platform anchor, Microsoft Foundry Toolkit, AWS AgentCore CLI, GitHub Copilot CLI, Codex CLI 0.128.0 model-provider-owned discovery, dev-experience SLA, GitHub-as-platform consolidation.','開発者ツールチェーンのプラットフォーム化','Plataformización de herramientas de desarrollo','Platformization ng Developer Toolchain','開発プラットフォーム化','Plat. de Dev','Dev Platformization','AI コーディング・エージェント・プラットフォーム (Claude Code, Codex, Cursor, Kiro)、IDE 統合、CI/CD エージェント・ランナー、開発者ツール・レジストリ、エンタープライズ開発者ワークフロー統合、コードレビュー自動化、エージェント駆動リポジトリ操作、Skills マーケットプレイス採用、Microsoft Build プラットフォーム・アンカー、Microsoft Foundry Toolkit、AWS AgentCore CLI、GitHub Copilot CLI、Codex CLI 0.128.0 model-provider-owned discovery、開発者体験 SLA、GitHub-as-platform 統合。','Plataformas de coding agent AI (Claude Code, Codex, Cursor, Kiro), integración IDE, runners de agente CI/CD, registries de herramientas dev, consolidación de workflow de developer empresarial, automatización de code review, operaciones de repositorio dirigidas por agente, adopción de marketplace de Skills, Microsoft Build platform anchor, Microsoft Foundry Toolkit, AWS AgentCore CLI, GitHub Copilot CLI, Codex CLI 0.128.0 model-provider-owned discovery, dev-experience SLA, consolidación GitHub-as-platform.','AI coding agent platforms (Claude Code, Codex, Cursor, Kiro), IDE integration, mga CI/CD agent runners, developer tool registries, enterprise developer-workflow consolidation, code-review automation, agent-driven repository operations, Skills marketplace adoption, Microsoft Build platform anchor, Microsoft Foundry Toolkit, AWS AgentCore CLI, GitHub Copilot CLI, Codex CLI 0.128.0 model-provider-owned discovery, dev-experience SLA, GitHub-as-platform consolidation.',NULL,'active',NULL,NULL,NULL,NULL,NULL,NULL,'1970-01-01 00:00:00',NULL);
INSERT INTO "themes" VALUES('business.compute_capex_strategy','business','business.capital-supply-chain','Compute Capex Strategy','Compute Capex','Compute Capex Strategy','Multi-year compute capex commitments and capacity strategy: 10-year hyperscaler compute deals, 5GW Trainium capacity commitments, GW-scale data-center power footprint, accelerator-vendor multi-quarter backlog allocation, hyperscaler buildout cadence, forward-supply 8-K commitments, hyperscaler capacity warrants, Vera Rubin / MAIA accelerator commitments, Tesla compute capex, capex-as-strategic-asset positioning, capacity-coupling between cloud providers and accelerator vendors. (Revenue disclosure of capex is covered by business.ai_revenue_disclosure, not here.)','コンピュート資本戦略','Estrategia de capex de cómputo','Estratehiya ng Compute Capex','コンピュート資本','Capex de cómputo','Compute Capex','複数年にわたる計算 capex コミットメントとキャパシティ戦略: ハイパースケーラの10年計算契約、5GW Trainium キャパシティ・コミットメント、GW 規模のデータセンター電力フットプリント、アクセラレータ・ベンダーの複数四半期バックログ配分、ハイパースケーラ建設ケイデンス、先渡し供給 8-K コミットメント、ハイパースケーラ・キャパシティ・ワラント、Vera Rubin / MAIA アクセラレータ・コミットメント、Tesla の計算 capex、戦略資産としての capex ポジショニング、クラウド事業者とアクセラレータ・ベンダー間のキャパシティ・カップリング。(capex の売上開示は business.ai_revenue_disclosure 側でカバー)','Compromisos de capex de cómputo plurianuales y estrategia de capacidad: contratos de cómputo de hyperscaler a 10 años, compromisos de capacidad Trainium de 5GW, huella de energía de centros de datos a escala GW, asignación de backlog plurimensual de proveedores de aceleradores, cadencia de buildout de hyperscaler, compromisos de oferta forward 8-K, warrants de capacidad de hyperscaler, compromisos de aceleradores Vera Rubin / MAIA, capex de cómputo de Tesla, posicionamiento de capex como activo estratégico, acoplamiento de capacidad entre proveedores de nube y proveedores de aceleradores. (La divulgación de ingresos asociada al capex la cubre business.ai_revenue_disclosure, no este tema.)','Multi-year na compute capex commitments at capacity strategy: 10-taong compute deals ng hyperscaler, 5GW Trainium capacity commitments, GW-scale data-center power footprint, multi-quarter backlog allocation ng mga accelerator vendor, cadence ng buildout ng hyperscaler, forward-supply 8-K commitments, mga hyperscaler capacity warrant, mga commitment para sa Vera Rubin / MAIA accelerators, Tesla compute capex, positioning ng capex bilang strategic asset, capacity-coupling sa pagitan ng mga cloud provider at accelerator vendor. (Ang revenue disclosure ng capex ay sakop ng business.ai_revenue_disclosure, hindi nito.)',NULL,'active',NULL,NULL,NULL,NULL,NULL,NULL,'1970-01-01 00:00:00',NULL);
INSERT INTO "themes" VALUES('tech.ai_macro_capital_markets','tech','tech.infrastructure','AI Macro & Capital Markets','AI Macro','AI Macro & Capital Markets','Macro and capital-markets dynamics shaping AI: Mag 7 super-week earnings, AI-capex ROI repricing, AI-revenue disclosure rewrite (SEC concept release, OpenAI audited revenue cadence, AMD AI-accelerator 10-Q segment, Microsoft audited monthly AI-business KPIs), Powell-Fed Board institutional-volatility regime, FOMC dissent norm, Cerebras IPO, Apple-buyback collision with $700B AI-capex print, AI-accelerator vendor forward-supply 8-K cadence.','AIマクロと資本市場','Macro de IA y mercados de capitales','AI Macro at Capital Markets','AIマクロ','Macro IA','AI Macro','AIを形作るマクロ・資本市場の力学: Mag 7 スーパーウィーク決算、AI capex ROI の再評価、AI 売上開示のリライト (SEC コンセプトリリース、OpenAI の監査済み月次売上、AMD AI アクセラレータ 10-Q セグメント、Microsoft 監査済み月次 AI 事業 KPI)、Powell-Fed Board 制度ボラティリティ・レジーム、FOMC 反対票の常態化、Cerebras IPO、Apple 自社株買いと $700B AI capex の衝突、AI アクセラレータ・ベンダーの先渡し供給 8-K 開示。','Dinámicas macroeconómicas y de mercados de capitales que dan forma a la IA: resultados de la super-semana de Mag 7, reprecio del ROI de AI-capex, reescritura de divulgación de ingresos de IA (concept release de la SEC, cadencia de ingresos auditados de OpenAI, segmento 10-Q de aceleradores AI de AMD, KPIs mensuales auditados del negocio de IA de Microsoft), régimen de volatilidad institucional Powell-Fed Board, norma de disidencia del FOMC, IPO de Cerebras, colisión de la recompra de Apple con la impresión de $700B AI capex, cadencia de divulgaciones 8-K de oferta forward de proveedores de aceleradores AI.','Macro at capital-markets dynamics na humuhubog sa AI: Mag 7 super-week earnings, repricing ng AI-capex ROI, rewrite ng AI-revenue disclosure (SEC concept release, OpenAI audited revenue cadence, AMD AI-accelerator 10-Q segment, Microsoft audited monthly AI-business KPIs), Powell-Fed Board institutional-volatility regime, norm ng dissent sa FOMC, Cerebras IPO, banggaan ng Apple buyback sa $700B AI-capex print, cadence ng forward-supply 8-K ng mga AI-accelerator vendor.',NULL,'active',NULL,NULL,NULL,NULL,NULL,NULL,'1970-01-01 00:00:00',NULL);
INSERT INTO "themes" VALUES('business.inference_server_supply_chain','business','business.regulation-compliance','Inference Server Supply Chain','Inference Supply','Inference Server Supply Chain','Inference-server supply-chain governance: AI-Infra CVE class as regulatory primitive, indirect prompt injection as top CVE category, GGUF supply-chain integrity gates (signed cards, SSTI scans), OAuth trust between AI SaaS, inference-server SSTI to OWASP LLM Top-10 v2026, agent-skills attack-surface threat sub-matrix, CISA AI-Infra KEV sub-catalog with inference-server SBOM, NIST non-human-identity control profile.','推論サーバ・サプライチェーン','Cadena de suministro de servidores de inferencia','Inference Server Supply Chain','推論サプライ','Suministro inferencia','Inference Supply','推論サーバのサプライチェーン・ガバナンス: 規制プリミティブとしての AI-Infra CVE クラス、トップ CVE カテゴリとしての間接プロンプトインジェクション、GGUF サプライチェーン整合性ゲート (署名済みカード、SSTI スキャン)、AI SaaS 間の OAuth 信頼、推論サーバ SSTI から OWASP LLM Top-10 v2026 へ、エージェント・スキル攻撃面の脅威サブマトリックス、推論サーバ SBOM 付き CISA AI-Infra KEV サブカタログ、NIST 非人間アイデンティティ・コントロール・プロファイル。','Gobernanza de la cadena de suministro de servidores de inferencia: la clase CVE de infraestructura de IA como primitiva regulatoria, inyección indirecta de prompt como categoría CVE principal, controles de integridad de la cadena de suministro GGUF (tarjetas firmadas, escaneos SSTI), confianza OAuth entre SaaS de IA, SSTI de servidor de inferencia integrado al OWASP LLM Top-10 v2026, sub-matriz de amenazas de superficie de ataque de agent-skills, sub-catálogo CISA AI-Infra KEV con SBOM de servidor de inferencia, perfil de control de identidad no-humana del NIST.','Gobernanza ng supply chain ng inference server: AI-Infra CVE class bilang regulatory primitive, indirect prompt injection bilang top CVE category, mga integrity gate ng GGUF supply chain (signed cards, SSTI scans), OAuth trust sa pagitan ng AI SaaS, inference-server SSTI tungo sa OWASP LLM Top-10 v2026, threat sub-matrix ng agent-skills attack surface, CISA AI-Infra KEV sub-catalog na may SBOM ng inference server, profile ng kontrol ng non-human identity ng NIST.',NULL,'active',NULL,NULL,NULL,NULL,NULL,NULL,'1970-01-01 00:00:00',NULL);
INSERT INTO "themes" VALUES('business.ai_revenue_disclosure','business','business.capital-supply-chain','AI-Revenue Disclosure Rewrite','AI-Revenue Disclosure','AI-Revenue Disclosure Rewrite','The 2026 rewrite of how AI revenue is reported to capital markets: SEC AI-revenue concept release and Corporation Finance staff guidance, audited monthly-revenue and WAU disclosure cadence from foundation labs (OpenAI, Anthropic, xAI), Big-3 hyperscaler AI-services 10-Q footnote breakouts (Microsoft Azure AI Services run-rate, Alphabet AI Services segment), AMD AI-accelerator revenue 10-Q segment footnote, AI-accelerator IPO and S-1 disclosure cohort (Cerebras, Tenstorrent, per-counterparty risk-factor tables, hyperscaler-anchor warrant-equity disclosure), per-token-margin reporting.','AI売上開示リライト','Reescritura de divulgación de ingresos de IA','AI-Revenue Disclosure Rewrite','AI売上開示','Divulgación ingresos IA','AI-Revenue Disclosure','AI売上が資本市場にどう報告されるかの2026年リライト: SECのAI売上コンセプトリリースとCorporation Financeスタッフガイダンス、ファウンデーションラボ (OpenAI、Anthropic、xAI) による監査済み月次売上・WAU開示の定期化、Big-3ハイパースケーラのAIサービス10-Q脚注開示 (Microsoft Azure AIサービス・ランレート、Alphabet AIサービス・セグメント)、AMDのAIアクセラレータ売上10-Qセグメント脚注、AIアクセラレータIPO・S-1開示コホート (Cerebras、Tenstorrent、相手先別リスクファクター表、ハイパースケーラ・アンカーのワラント持分開示)、トークン単位マージン報告。','La reescritura de 2026 sobre cómo se reportan los ingresos de IA a los mercados de capitales: concept release de ingresos de IA de la SEC y guía del personal de Corporation Finance, cadencia de divulgación de ingresos mensuales auditados y WAU de los laboratorios fundacionales (OpenAI, Anthropic, xAI), desgloses en notas 10-Q de servicios de IA de los Big-3 hyperscalers (run-rate de Azure AI Services de Microsoft, segmento AI Services de Alphabet), nota de segmento 10-Q de ingresos por aceleradores AI de AMD, cohorte de divulgación de IPO y S-1 de aceleradores AI (Cerebras, Tenstorrent, tablas de factores de riesgo por contraparte, divulgación de warrant-equity de anclas hyperscaler), reporte de margen por token.','Ang 2026 rewrite kung paano iniuulat ang kita ng AI sa capital markets: SEC AI-revenue concept release at staff guidance ng Corporation Finance, cadence ng audited monthly-revenue at WAU disclosure mula sa mga foundation lab (OpenAI, Anthropic, xAI), mga 10-Q footnote breakout ng AI-services ng Big-3 hyperscaler (run-rate ng Microsoft Azure AI Services, segment ng Alphabet AI Services), 10-Q segment footnote ng AI-accelerator revenue ng AMD, cohort ng IPO at S-1 disclosure ng AI-accelerator (Cerebras, Tenstorrent, per-counterparty risk-factor tables, warrant-equity disclosure ng hyperscaler-anchor), pag-uulat ng per-token margin.',NULL,'active',NULL,NULL,NULL,NULL,NULL,NULL,'1970-01-01 00:00:00',NULL);
INSERT INTO "themes" VALUES('tech.frontier_model_regulatory_board','tech','tech.standards','Frontier Model Regulatory Board','FMRB','Frontier Model Regulatory Board','Cross-jurisdictional regulatory architecture for frontier AI: Frontier Model Regulatory Board (FMRB) executive order, AISI cyber-eval reciprocity ladder, allied AI-safety-institute mutual recognition, allied procurement mirror clauses, cross-border cyber-evaluation reciprocity gates, allied procurement gating, frontier-model evaluation regime as procurement primitive, executive-order signing windows, mid-2026 regulatory-board buildout cadence.','フロンティアモデル規制ボード','Junta Reguladora de Modelos Frontier','Frontier Model Regulatory Board','FMRB','FMRB','FMRB','フロンティアAIの跨管轄規制アーキテクチャ: Frontier Model Regulatory Board (FMRB) 大統領令、AISI サイバー評価相互承認はしご、同盟国 AI 安全機関の相互認証、同盟国調達ミラー条項、国境横断サイバー評価相互承認ゲート、同盟国調達ゲーティング、調達プリミティブとしてのフロンティアモデル評価レジーム、大統領令署名ウィンドウ、2026 年中盤の規制ボード構築ケイデンス。','Arquitectura regulatoria transjurisdiccional para IA frontera: orden ejecutiva de la Frontier Model Regulatory Board (FMRB), escalera de reciprocidad de cyber-eval del AISI, reconocimiento mutuo entre AI safety institutes aliados, cláusulas espejo de aprovisionamiento aliado, gates de reciprocidad de cyber-evaluación transfronteriza, gating de aprovisionamiento aliado, régimen de evaluación de modelos frontera como primitiva de aprovisionamiento, ventanas de firma de orden ejecutiva, cadencia de construcción de la junta regulatoria a mediados de 2026.','Cross-jurisdictional regulatory architecture para sa frontier AI: executive order ng Frontier Model Regulatory Board (FMRB), AISI cyber-eval reciprocity ladder, mutual recognition ng mga kaalyadong AI safety institute, allied procurement mirror clauses, cross-border cyber-evaluation reciprocity gates, gating ng allied procurement, frontier-model evaluation regime bilang procurement primitive, mga executive-order signing window, cadence ng pagtatayo ng regulatory board sa kalagitnaan ng 2026.',NULL,'active',NULL,NULL,NULL,NULL,NULL,NULL,'1970-01-01 00:00:00',NULL);
CREATE TABLE topic_daily_activity (
  activity_id TEXT PRIMARY KEY,

  activity_date TEXT NOT NULL,
  window_id TEXT NOT NULL CHECK (window_id IN ('7d', '30d', '90d')),
  scope_id TEXT NOT NULL,

  category_id TEXT,
  theme_id TEXT NOT NULL,

  activity_level TEXT NOT NULL CHECK (activity_level IN ('theme')),

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
  FOREIGN KEY (theme_id) REFERENCES themes(theme_id)
);
INSERT INTO "topic_daily_activity" VALUES('activity.95d4c5cf65da2200','2026-01-04','7d','tech','tech.agents','tech.agent_control_plane','theme',0.0,0.0,0.0,0.0,0.0,0,0,0,0,NULL,NULL,'dormant',0,'2026-01-04','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "topic_daily_activity" VALUES('activity.d0ff94a7e872de63','2026-01-04','30d','tech','tech.agents','tech.agent_control_plane','theme',0.0,0.0,0.0,0.0,0.0,0,0,0,0,NULL,NULL,'dormant',0,'2026-01-04','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "topic_daily_activity" VALUES('activity.a1bf5d96a5b26065','2026-01-04','90d','tech','tech.agents','tech.agent_control_plane','theme',0.0,0.0,0.0,0.0,0.0,0,0,0,0,NULL,NULL,'dormant',0,'2026-01-04','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "topic_daily_activity" VALUES('activity.5e14e7e3808b5b4d','2026-01-04','7d','tech','tech.inference-runtime','tech.local_inference_runtime','theme',0.0,0.0,0.0,0.0,0.0,0,0,0,0,NULL,NULL,'dormant',0,'2026-01-04','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "topic_daily_activity" VALUES('activity.b6f233c7ffaaad2d','2026-01-04','30d','tech','tech.inference-runtime','tech.local_inference_runtime','theme',0.0,0.0,0.0,0.0,0.0,0,0,0,0,NULL,NULL,'dormant',0,'2026-01-04','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "topic_daily_activity" VALUES('activity.27ea07ee28846249','2026-01-04','90d','tech','tech.inference-runtime','tech.local_inference_runtime','theme',0.0,0.0,0.0,0.0,0.0,0,0,0,0,NULL,NULL,'dormant',0,'2026-01-04','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "topic_daily_activity" VALUES('activity.818e19040f277bbb','2026-01-04','7d','tech','tech.infrastructure','tech.ai_chip_architecture','theme',0.0,0.0,0.0,0.0,0.0,0,0,0,0,NULL,NULL,'dormant',0,'2026-01-04','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "topic_daily_activity" VALUES('activity.240ea1e4bc184249','2026-01-04','30d','tech','tech.infrastructure','tech.ai_chip_architecture','theme',0.0,0.0,0.0,0.0,0.0,0,0,0,0,NULL,NULL,'dormant',0,'2026-01-04','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "topic_daily_activity" VALUES('activity.0143442f9e58fae2','2026-01-04','90d','tech','tech.infrastructure','tech.ai_chip_architecture','theme',0.0,0.0,0.0,0.0,0.0,0,0,0,0,NULL,NULL,'dormant',0,'2026-01-04','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "topic_daily_activity" VALUES('activity.7bcb0b51af967960','2026-01-04','7d','tech','tech.infrastructure','tech.physical_ai_robotics','theme',1.0,0.0,0.0,1.0,0.29714285714285721,4,7,0,3,NULL,NULL,'continuing',3,'2026-01-04','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "topic_daily_activity" VALUES('activity.19d05f67434c146a','2026-01-04','30d','tech','tech.infrastructure','tech.physical_ai_robotics','theme',1.0,0.0,0.0,1.0,0.29714285714285721,4,7,0,3,NULL,NULL,'continuing',3,'2026-01-04','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "topic_daily_activity" VALUES('activity.ea313ba69391132d','2026-01-04','90d','tech','tech.infrastructure','tech.physical_ai_robotics','theme',1.0,0.0,0.0,1.0,0.29714285714285721,4,7,0,3,NULL,NULL,'continuing',3,'2026-01-04','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "topic_daily_activity" VALUES('activity.81373f66afb2acbb','2026-01-04','7d','tech','tech.infrastructure','tech.ai_macro_capital_markets','theme',0.0,0.0,0.0,0.0,0.0,0,0,0,0,NULL,NULL,'dormant',0,'2026-01-04','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "topic_daily_activity" VALUES('activity.9022922cd40fe5f9','2026-01-04','30d','tech','tech.infrastructure','tech.ai_macro_capital_markets','theme',0.0,0.0,0.0,0.0,0.0,0,0,0,0,NULL,NULL,'dormant',0,'2026-01-04','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "topic_daily_activity" VALUES('activity.9716806b992c59c0','2026-01-04','90d','tech','tech.infrastructure','tech.ai_macro_capital_markets','theme',0.0,0.0,0.0,0.0,0.0,0,0,0,0,NULL,NULL,'dormant',0,'2026-01-04','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "topic_daily_activity" VALUES('activity.6d8a687a1ad30043','2026-01-04','7d','tech','tech.models','tech.one_bit_edge_llm','theme',0.0,0.0,0.0,0.0,0.0,0,0,0,0,NULL,NULL,'dormant',0,'2026-01-04','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "topic_daily_activity" VALUES('activity.af200b4f71285089','2026-01-04','30d','tech','tech.models','tech.one_bit_edge_llm','theme',0.0,0.0,0.0,0.0,0.0,0,0,0,0,NULL,NULL,'dormant',0,'2026-01-04','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "topic_daily_activity" VALUES('activity.e672bdcbe3f12b24','2026-01-04','90d','tech','tech.models','tech.one_bit_edge_llm','theme',0.0,0.0,0.0,0.0,0.0,0,0,0,0,NULL,NULL,'dormant',0,'2026-01-04','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "topic_daily_activity" VALUES('activity.4f5faae7dd377aff','2026-01-04','7d','tech','tech.security','tech.agent_runtime_security','theme',0.0,0.0,0.0,0.0,0.0,0,0,0,0,NULL,NULL,'dormant',0,'2026-01-04','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "topic_daily_activity" VALUES('activity.86dda22d2f543fa9','2026-01-04','30d','tech','tech.security','tech.agent_runtime_security','theme',0.0,0.0,0.0,0.0,0.0,0,0,0,0,NULL,NULL,'dormant',0,'2026-01-04','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "topic_daily_activity" VALUES('activity.490518f2b931f063','2026-01-04','90d','tech','tech.security','tech.agent_runtime_security','theme',0.0,0.0,0.0,0.0,0.0,0,0,0,0,NULL,NULL,'dormant',0,'2026-01-04','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "topic_daily_activity" VALUES('activity.93bd2af2a9f05442','2026-01-04','7d','tech','tech.security','tech.model_supply_chain','theme',0.0,0.0,0.0,0.0,0.0,0,0,0,0,NULL,NULL,'dormant',0,'2026-01-04','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "topic_daily_activity" VALUES('activity.9d964431f7e28d1e','2026-01-04','30d','tech','tech.security','tech.model_supply_chain','theme',0.0,0.0,0.0,0.0,0.0,0,0,0,0,NULL,NULL,'dormant',0,'2026-01-04','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "topic_daily_activity" VALUES('activity.c77a73e70018c3ce','2026-01-04','90d','tech','tech.security','tech.model_supply_chain','theme',0.0,0.0,0.0,0.0,0.0,0,0,0,0,NULL,NULL,'dormant',0,'2026-01-04','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "topic_daily_activity" VALUES('activity.6a688d2770088ecf','2026-01-04','7d','tech','tech.standards','tech.agent_registry_architecture','theme',0.0,0.0,0.0,0.0,0.0,0,0,0,0,NULL,NULL,'dormant',0,'2026-01-04','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "topic_daily_activity" VALUES('activity.423d4f2d7b8fc648','2026-01-04','30d','tech','tech.standards','tech.agent_registry_architecture','theme',0.0,0.0,0.0,0.0,0.0,0,0,0,0,NULL,NULL,'dormant',0,'2026-01-04','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "topic_daily_activity" VALUES('activity.e2489dc2684f9c91','2026-01-04','90d','tech','tech.standards','tech.agent_registry_architecture','theme',0.0,0.0,0.0,0.0,0.0,0,0,0,0,NULL,NULL,'dormant',0,'2026-01-04','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "topic_daily_activity" VALUES('activity.8aacf8d7ce499656','2026-01-04','7d','tech','tech.standards','tech.frontier_model_regulatory_board','theme',0.0,0.0,0.0,0.0,0.0,0,0,0,0,NULL,NULL,'dormant',0,'2026-01-04','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "topic_daily_activity" VALUES('activity.13c22078470aa34a','2026-01-04','30d','tech','tech.standards','tech.frontier_model_regulatory_board','theme',0.0,0.0,0.0,0.0,0.0,0,0,0,0,NULL,NULL,'dormant',0,'2026-01-04','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "topic_daily_activity" VALUES('activity.2b55ff1115c6069d','2026-01-04','90d','tech','tech.standards','tech.frontier_model_regulatory_board','theme',0.0,0.0,0.0,0.0,0.0,0,0,0,0,NULL,NULL,'dormant',0,'2026-01-04','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "topic_daily_activity" VALUES('activity.961f4639e08adbe2','2026-01-04','7d','business','business.capital-supply-chain','business.compute_capex_strategy','theme',0.0,0.0,0.0,0.0,0.0,0,0,0,0,NULL,NULL,'dormant',0,'2026-01-04','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "topic_daily_activity" VALUES('activity.ccf9a34f1c502eaa','2026-01-04','30d','business','business.capital-supply-chain','business.compute_capex_strategy','theme',0.0,0.0,0.0,0.0,0.0,0,0,0,0,NULL,NULL,'dormant',0,'2026-01-04','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "topic_daily_activity" VALUES('activity.fd2880362ce805fb','2026-01-04','90d','business','business.capital-supply-chain','business.compute_capex_strategy','theme',0.0,0.0,0.0,0.0,0.0,0,0,0,0,NULL,NULL,'dormant',0,'2026-01-04','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "topic_daily_activity" VALUES('activity.f001d0a81764446d','2026-01-04','7d','business','business.capital-supply-chain','business.ai_revenue_disclosure','theme',1.0,0.0,0.0,1.0,0.30333333333333334,4,15,0,9,NULL,NULL,'continuing',3,'2026-01-04','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "topic_daily_activity" VALUES('activity.a44c2e8a76955c93','2026-01-04','30d','business','business.capital-supply-chain','business.ai_revenue_disclosure','theme',1.0,0.0,0.0,1.0,0.30333333333333334,4,15,0,9,NULL,NULL,'continuing',3,'2026-01-04','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "topic_daily_activity" VALUES('activity.91af635afb7d415f','2026-01-04','90d','business','business.capital-supply-chain','business.ai_revenue_disclosure','theme',1.0,0.0,0.0,1.0,0.30333333333333334,4,15,0,9,NULL,NULL,'continuing',3,'2026-01-04','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "topic_daily_activity" VALUES('activity.cbc90d36aab2c9df','2026-01-04','7d','business','business.competition','business.open_weight_vs_proprietary','theme',0.0,0.0,0.0,0.0,0.0,0,0,0,0,NULL,NULL,'dormant',0,'2026-01-04','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "topic_daily_activity" VALUES('activity.0c8a507501fa6c14','2026-01-04','30d','business','business.competition','business.open_weight_vs_proprietary','theme',0.0,0.0,0.0,0.0,0.0,0,0,0,0,NULL,NULL,'dormant',0,'2026-01-04','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "topic_daily_activity" VALUES('activity.4dd1aad45dd60ed4','2026-01-04','90d','business','business.competition','business.open_weight_vs_proprietary','theme',0.0,0.0,0.0,0.0,0.0,0,0,0,0,NULL,NULL,'dormant',0,'2026-01-04','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "topic_daily_activity" VALUES('activity.01b6bfdc5fba112f','2026-01-04','7d','business','business.distribution','business.cloud_vs_local_distribution','theme',0.0,0.0,0.0,0.0,0.0,0,0,0,0,NULL,NULL,'dormant',0,'2026-01-04','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "topic_daily_activity" VALUES('activity.59a32691af214a69','2026-01-04','30d','business','business.distribution','business.cloud_vs_local_distribution','theme',0.0,0.0,0.0,0.0,0.0,0,0,0,0,NULL,NULL,'dormant',0,'2026-01-04','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "topic_daily_activity" VALUES('activity.b0528e229afc42ca','2026-01-04','90d','business','business.distribution','business.cloud_vs_local_distribution','theme',0.0,0.0,0.0,0.0,0.0,0,0,0,0,NULL,NULL,'dormant',0,'2026-01-04','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "topic_daily_activity" VALUES('activity.c159a5d3fc26f59a','2026-01-04','7d','business','business.enterprise-adoption','business.developer_platformization','theme',0.0,0.0,0.0,0.0,0.0,0,0,0,0,NULL,NULL,'dormant',0,'2026-01-04','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "topic_daily_activity" VALUES('activity.14520c89d5254b52','2026-01-04','30d','business','business.enterprise-adoption','business.developer_platformization','theme',0.0,0.0,0.0,0.0,0.0,0,0,0,0,NULL,NULL,'dormant',0,'2026-01-04','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "topic_daily_activity" VALUES('activity.04c326d7bec8d979','2026-01-04','90d','business','business.enterprise-adoption','business.developer_platformization','theme',0.0,0.0,0.0,0.0,0.0,0,0,0,0,NULL,NULL,'dormant',0,'2026-01-04','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "topic_daily_activity" VALUES('activity.3deec313f00cea33','2026-01-04','7d','business','business.market-structure','business.hyperscaler_frontier_lab_alliance','theme',0.0,0.0,0.0,0.0,0.0,0,0,0,0,NULL,NULL,'dormant',0,'2026-01-04','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "topic_daily_activity" VALUES('activity.ed20e72d630b51c0','2026-01-04','30d','business','business.market-structure','business.hyperscaler_frontier_lab_alliance','theme',0.0,0.0,0.0,0.0,0.0,0,0,0,0,NULL,NULL,'dormant',0,'2026-01-04','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "topic_daily_activity" VALUES('activity.34ac3a6ffa286390','2026-01-04','90d','business','business.market-structure','business.hyperscaler_frontier_lab_alliance','theme',0.0,0.0,0.0,0.0,0.0,0,0,0,0,NULL,NULL,'dormant',0,'2026-01-04','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "topic_daily_activity" VALUES('activity.7587ab089644ef66','2026-01-04','7d','business','business.regulation-compliance','business.ai_security_compliance_market','theme',0.0,0.0,0.0,0.0,0.0,0,0,0,0,NULL,NULL,'dormant',0,'2026-01-04','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "topic_daily_activity" VALUES('activity.0f5a7098cb4ec32a','2026-01-04','30d','business','business.regulation-compliance','business.ai_security_compliance_market','theme',0.0,0.0,0.0,0.0,0.0,0,0,0,0,NULL,NULL,'dormant',0,'2026-01-04','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "topic_daily_activity" VALUES('activity.1804f1a0ea527380','2026-01-04','90d','business','business.regulation-compliance','business.ai_security_compliance_market','theme',0.0,0.0,0.0,0.0,0.0,0,0,0,0,NULL,NULL,'dormant',0,'2026-01-04','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "topic_daily_activity" VALUES('activity.77faccc8542c2558','2026-01-04','7d','business','business.regulation-compliance','business.inference_server_supply_chain','theme',0.0,0.0,0.0,0.0,0.0,0,0,0,0,NULL,NULL,'dormant',0,'2026-01-04','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "topic_daily_activity" VALUES('activity.e4e4a9610284941c','2026-01-04','30d','business','business.regulation-compliance','business.inference_server_supply_chain','theme',0.0,0.0,0.0,0.0,0.0,0,0,0,0,NULL,NULL,'dormant',0,'2026-01-04','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
INSERT INTO "topic_daily_activity" VALUES('activity.85eb07c672b902d8','2026-01-04','90d','business','business.regulation-compliance','business.inference_server_supply_chain','theme',0.0,0.0,0.0,0.0,0.0,0,0,0,0,NULL,NULL,'dormant',0,'2026-01-04','1970-01-01 00:00:00','1970-01-01T00:00:00Z');
CREATE TABLE validation_rows (
  validation_row_id TEXT PRIMARY KEY,

  source_file_id TEXT NOT NULL,
  validation_date TEXT NOT NULL,

  prediction_id TEXT,
  prediction_summary TEXT NOT NULL,
  -- Re-cited prediction summary in non-EN locales (NULL = fall back to EN).
  prediction_summary_ja TEXT,
  prediction_summary_es TEXT,
  prediction_summary_fil TEXT,
  prediction_date TEXT,

  related_items_text TEXT,
  reference_links_json TEXT,

  observed_relevance INTEGER CHECK (observed_relevance BETWEEN 1 AND 5),

  -- bridge: narrative bridge between today's SUPPORT and the
  -- referenced PREDICTION. One paragraph per validation row, written
  -- by the writer in 2_future_prediction. Format (writer-enforced):
  --   "Bridge (Pred ID #N): today's news X supports the predictions
  --    Y component. Reason: Z. Coherence N/5. Remaining gap: W."
  -- NULL on legacy rows (Phase 2 backfill skill fills them).
  bridge_text TEXT,
  -- Phase 4a: locale fan-out for the bridge paragraph. NULL = fall back to EN.
  -- Filled by ingest from sibling locale FP files (future-prediction-*.md in
  -- data/future-prediction/{ja,es,fil}/).
  bridge_text_ja TEXT,
  bridge_text_es TEXT,
  bridge_text_fil TEXT,
  -- bridge: which predictions.reasoning_* dimension this row supports.
  -- 'because'   — supports the observed precondition
  -- 'given'     — supports the structural force
  -- 'so_that'   — supports the consequence
  -- 'landing'   — supports the timing/actor placement
  -- 'none'      — neutral / no specific dimension
  support_dimension TEXT
    CHECK (support_dimension IN ('because', 'given', 'so_that', 'landing', 'none')),
  -- needs stream: which Needs task this validation row contributes to.
  -- NULL on rows that are SUPPORT-without-task-mapping (e.g. dormant
  -- pool revivals where the writer didn't yet attribute the support
  -- to a specific 5W1H cell). The dashboard's Needs tab uses this
  -- to highlight the cells that today's SUPPORT touches.
  contributes_to_task_id TEXT
    REFERENCES needs_tasks(task_id),

  -- Phase 3: structured time bounds for the bridge — extracted from
  -- bridge_text's "Remaining gap: <date or window>" or similar
  -- explicit time mentions. NULL when the bridge has no explicit
  -- time horizon beyond inheriting the parent prediction's window.
  bridge_target_start_date TEXT,
  bridge_target_end_date TEXT,

  raw_row_markdown TEXT,
  raw_json TEXT,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (source_file_id) REFERENCES source_files(source_file_id),
  FOREIGN KEY (prediction_id) REFERENCES predictions(prediction_id)
);
INSERT INTO "validation_rows" VALUES('validation.7ffcb1f5a1ba3868','source.b762ae83fa1a88db','2026-01-02','prediction.ea9dc188119c4848','Widgetly ships synthetic milestone 20260102-0 by Q3 2026','Widgetly ships synthetic milestone 20260102-0 by Q3 2026','Widgetly ships synthetic milestone 20260102-0 by Q3 2026','Widgetly ships synthetic milestone 20260102-0 by Q3 2026','2026-01-02','Today''s fixture update 20260102-0 touches the same synthetic storyline.','[{"url": "https://example.com/20260102/0", "title": "Example 0 (2026-01-02)"}]',3,'Today''s fixture update supports the synthetic milestone from 2026-01-02. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','[ja] Today''s fixture update supports the synthetic milestone from 2026-01-02. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','[es] Today''s fixture update supports the synthetic milestone from 2026-01-02. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','[fil] Today''s fixture update supports the synthetic milestone from 2026-01-02. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','because',NULL,NULL,NULL,'Today''s fixture update supports the synthetic milestone from 2026-01-02. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.',NULL,'1970-01-01 00:00:00');
INSERT INTO "validation_rows" VALUES('validation.759776da47f2d603','source.b762ae83fa1a88db','2026-01-02','prediction.653d833667c2e642','Acme Metrics ships synthetic milestone 20260102-1 by Q3 2026','Acme Metrics ships synthetic milestone 20260102-1 by Q3 2026','Acme Metrics ships synthetic milestone 20260102-1 by Q3 2026','Acme Metrics ships synthetic milestone 20260102-1 by Q3 2026','2026-01-02','Today''s fixture update 20260102-1 touches the same synthetic storyline.','[{"url": "https://example.com/20260102/1", "title": "Example 1 (2026-01-02)"}]',3,'Today''s fixture update supports the synthetic milestone from 2026-01-02. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','[ja] Today''s fixture update supports the synthetic milestone from 2026-01-02. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','[es] Today''s fixture update supports the synthetic milestone from 2026-01-02. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','[fil] Today''s fixture update supports the synthetic milestone from 2026-01-02. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','given',NULL,NULL,NULL,'Today''s fixture update supports the synthetic milestone from 2026-01-02. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.',NULL,'1970-01-01 00:00:00');
INSERT INTO "validation_rows" VALUES('validation.b43a9e50192cb582','source.b762ae83fa1a88db','2026-01-02','prediction.fffecc9edf856be3','Exampletron ships synthetic milestone 20260102-2 by Q3 2026','Exampletron ships synthetic milestone 20260102-2 by Q3 2026','Exampletron ships synthetic milestone 20260102-2 by Q3 2026','Exampletron ships synthetic milestone 20260102-2 by Q3 2026','2026-01-02','Today''s fixture update 20260102-0 touches the same synthetic storyline.','[{"url": "https://example.com/20260102/0", "title": "Example 0 (2026-01-02)"}]',1,'Today''s fixture update supports the synthetic milestone from 2026-01-02. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','[ja] Today''s fixture update supports the synthetic milestone from 2026-01-02. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','[es] Today''s fixture update supports the synthetic milestone from 2026-01-02. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','[fil] Today''s fixture update supports the synthetic milestone from 2026-01-02. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','so_that',NULL,NULL,NULL,'Today''s fixture update supports the synthetic milestone from 2026-01-02. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.',NULL,'1970-01-01 00:00:00');
INSERT INTO "validation_rows" VALUES('validation.5a13acd7e35b796d','source.88a664cde7570cef','2026-01-03','prediction.ea9dc188119c4848','Widgetly ships synthetic milestone 20260102-0 by Q3 2026','Widgetly ships synthetic milestone 20260102-0 by Q3 2026','Widgetly ships synthetic milestone 20260102-0 by Q3 2026','Widgetly ships synthetic milestone 20260102-0 by Q3 2026','2026-01-02','Today''s fixture update 20260103-0 touches the same synthetic storyline.','[{"url": "https://example.com/20260103/0", "title": "Example 0 (2026-01-03)"}]',3,'Today''s fixture update supports the synthetic milestone from 2026-01-02. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','[ja] Today''s fixture update supports the synthetic milestone from 2026-01-02. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','[es] Today''s fixture update supports the synthetic milestone from 2026-01-02. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','[fil] Today''s fixture update supports the synthetic milestone from 2026-01-02. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','because',NULL,NULL,NULL,'Today''s fixture update supports the synthetic milestone from 2026-01-02. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.',NULL,'1970-01-01 00:00:00');
INSERT INTO "validation_rows" VALUES('validation.687b51901c660bc1','source.88a664cde7570cef','2026-01-03','prediction.ea9dc188119c4848','Acme Metrics ships synthetic milestone 20260102-1 by Q3 2026','Acme Metrics ships synthetic milestone 20260102-1 by Q3 2026','Acme Metrics ships synthetic milestone 20260102-1 by Q3 2026','Acme Metrics ships synthetic milestone 20260102-1 by Q3 2026','2026-01-02','Today''s fixture update 20260103-1 touches the same synthetic storyline.','[{"url": "https://example.com/20260103/1", "title": "Example 1 (2026-01-03)"}]',1,'Today''s fixture update supports the synthetic milestone from 2026-01-02. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','[ja] Today''s fixture update supports the synthetic milestone from 2026-01-02. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','[es] Today''s fixture update supports the synthetic milestone from 2026-01-02. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','[fil] Today''s fixture update supports the synthetic milestone from 2026-01-02. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','given',NULL,NULL,NULL,'Today''s fixture update supports the synthetic milestone from 2026-01-02. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.',NULL,'1970-01-01 00:00:00');
INSERT INTO "validation_rows" VALUES('validation.12eef1d1ca35d22d','source.88a664cde7570cef','2026-01-03','prediction.ea9dc188119c4848','Exampletron ships synthetic milestone 20260102-2 by Q3 2026','Exampletron ships synthetic milestone 20260102-2 by Q3 2026','Exampletron ships synthetic milestone 20260102-2 by Q3 2026','Exampletron ships synthetic milestone 20260102-2 by Q3 2026','2026-01-02','Today''s fixture update 20260103-0 touches the same synthetic storyline.','[{"url": "https://example.com/20260103/0", "title": "Example 0 (2026-01-03)"}]',2,'Today''s fixture update supports the synthetic milestone from 2026-01-02. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','[ja] Today''s fixture update supports the synthetic milestone from 2026-01-02. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','[es] Today''s fixture update supports the synthetic milestone from 2026-01-02. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','[fil] Today''s fixture update supports the synthetic milestone from 2026-01-02. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','so_that',NULL,NULL,NULL,'Today''s fixture update supports the synthetic milestone from 2026-01-02. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.',NULL,'1970-01-01 00:00:00');
INSERT INTO "validation_rows" VALUES('validation.bc4e2b2edf794773','source.88a664cde7570cef','2026-01-03','prediction.394e027e97187004','Widgetly ships synthetic milestone 20260103-0 by Q3 2026','Widgetly ships synthetic milestone 20260103-0 by Q3 2026','Widgetly ships synthetic milestone 20260103-0 by Q3 2026','Widgetly ships synthetic milestone 20260103-0 by Q3 2026','2026-01-03','Today''s fixture update 20260103-0 touches the same synthetic storyline.','[{"url": "https://example.com/20260103/0", "title": "Example 0 (2026-01-03)"}]',3,'Today''s fixture update supports the synthetic milestone from 2026-01-03. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','[ja] Today''s fixture update supports the synthetic milestone from 2026-01-03. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','[es] Today''s fixture update supports the synthetic milestone from 2026-01-03. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','[fil] Today''s fixture update supports the synthetic milestone from 2026-01-03. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','because',NULL,NULL,NULL,'Today''s fixture update supports the synthetic milestone from 2026-01-03. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.',NULL,'1970-01-01 00:00:00');
INSERT INTO "validation_rows" VALUES('validation.90946487447eec29','source.88a664cde7570cef','2026-01-03','prediction.bcfbfe1298ff4ec1','Acme Metrics ships synthetic milestone 20260103-1 by Q3 2026','Acme Metrics ships synthetic milestone 20260103-1 by Q3 2026','Acme Metrics ships synthetic milestone 20260103-1 by Q3 2026','Acme Metrics ships synthetic milestone 20260103-1 by Q3 2026','2026-01-03','Today''s fixture update 20260103-1 touches the same synthetic storyline.','[{"url": "https://example.com/20260103/1", "title": "Example 1 (2026-01-03)"}]',1,'Today''s fixture update supports the synthetic milestone from 2026-01-03. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','[ja] Today''s fixture update supports the synthetic milestone from 2026-01-03. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','[es] Today''s fixture update supports the synthetic milestone from 2026-01-03. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','[fil] Today''s fixture update supports the synthetic milestone from 2026-01-03. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','given',NULL,NULL,NULL,'Today''s fixture update supports the synthetic milestone from 2026-01-03. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.',NULL,'1970-01-01 00:00:00');
INSERT INTO "validation_rows" VALUES('validation.cb7f87def66c720d','source.88a664cde7570cef','2026-01-03','prediction.55acc78b25e9754a','Exampletron ships synthetic milestone 20260103-2 by Q3 2026','Exampletron ships synthetic milestone 20260103-2 by Q3 2026','Exampletron ships synthetic milestone 20260103-2 by Q3 2026','Exampletron ships synthetic milestone 20260103-2 by Q3 2026','2026-01-03','Today''s fixture update 20260103-0 touches the same synthetic storyline.','[{"url": "https://example.com/20260103/0", "title": "Example 0 (2026-01-03)"}]',2,'Today''s fixture update supports the synthetic milestone from 2026-01-03. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','[ja] Today''s fixture update supports the synthetic milestone from 2026-01-03. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','[es] Today''s fixture update supports the synthetic milestone from 2026-01-03. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','[fil] Today''s fixture update supports the synthetic milestone from 2026-01-03. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','so_that',NULL,NULL,NULL,'Today''s fixture update supports the synthetic milestone from 2026-01-03. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.',NULL,'1970-01-01 00:00:00');
INSERT INTO "validation_rows" VALUES('validation.328eae5e54bf2b44','source.908ca8b3de629dc1','2026-01-04','prediction.ea9dc188119c4848','Widgetly ships synthetic milestone 20260102-0 by Q3 2026','Widgetly ships synthetic milestone 20260102-0 by Q3 2026','Widgetly ships synthetic milestone 20260102-0 by Q3 2026','Widgetly ships synthetic milestone 20260102-0 by Q3 2026','2026-01-02','Today''s fixture update 20260104-0 touches the same synthetic storyline.','[{"url": "https://example.com/20260104/0", "title": "Example 0 (2026-01-04)"}]',1,'Today''s fixture update supports the synthetic milestone from 2026-01-02. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','[ja] Today''s fixture update supports the synthetic milestone from 2026-01-02. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','[es] Today''s fixture update supports the synthetic milestone from 2026-01-02. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','[fil] Today''s fixture update supports the synthetic milestone from 2026-01-02. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','because',NULL,NULL,NULL,'Today''s fixture update supports the synthetic milestone from 2026-01-02. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.',NULL,'1970-01-01 00:00:00');
INSERT INTO "validation_rows" VALUES('validation.c477b08997015ff9','source.908ca8b3de629dc1','2026-01-04','prediction.ea9dc188119c4848','Acme Metrics ships synthetic milestone 20260102-1 by Q3 2026','Acme Metrics ships synthetic milestone 20260102-1 by Q3 2026','Acme Metrics ships synthetic milestone 20260102-1 by Q3 2026','Acme Metrics ships synthetic milestone 20260102-1 by Q3 2026','2026-01-02','Today''s fixture update 20260104-1 touches the same synthetic storyline.','[{"url": "https://example.com/20260104/1", "title": "Example 1 (2026-01-04)"}]',3,'Today''s fixture update supports the synthetic milestone from 2026-01-02. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','[ja] Today''s fixture update supports the synthetic milestone from 2026-01-02. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','[es] Today''s fixture update supports the synthetic milestone from 2026-01-02. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','[fil] Today''s fixture update supports the synthetic milestone from 2026-01-02. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','given',NULL,NULL,NULL,'Today''s fixture update supports the synthetic milestone from 2026-01-02. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.',NULL,'1970-01-01 00:00:00');
INSERT INTO "validation_rows" VALUES('validation.59f372cfabf67476','source.908ca8b3de629dc1','2026-01-04','prediction.ea9dc188119c4848','Exampletron ships synthetic milestone 20260102-2 by Q3 2026','Exampletron ships synthetic milestone 20260102-2 by Q3 2026','Exampletron ships synthetic milestone 20260102-2 by Q3 2026','Exampletron ships synthetic milestone 20260102-2 by Q3 2026','2026-01-02','Today''s fixture update 20260104-0 touches the same synthetic storyline.','[{"url": "https://example.com/20260104/0", "title": "Example 0 (2026-01-04)"}]',3,'Today''s fixture update supports the synthetic milestone from 2026-01-02. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','[ja] Today''s fixture update supports the synthetic milestone from 2026-01-02. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','[es] Today''s fixture update supports the synthetic milestone from 2026-01-02. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','[fil] Today''s fixture update supports the synthetic milestone from 2026-01-02. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','so_that',NULL,NULL,NULL,'Today''s fixture update supports the synthetic milestone from 2026-01-02. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.',NULL,'1970-01-01 00:00:00');
INSERT INTO "validation_rows" VALUES('validation.e39c7a14ad1ed5f4','source.908ca8b3de629dc1','2026-01-04','prediction.394e027e97187004','Widgetly ships synthetic milestone 20260103-0 by Q3 2026','Widgetly ships synthetic milestone 20260103-0 by Q3 2026','Widgetly ships synthetic milestone 20260103-0 by Q3 2026','Widgetly ships synthetic milestone 20260103-0 by Q3 2026','2026-01-03','Today''s fixture update 20260104-0 touches the same synthetic storyline.','[{"url": "https://example.com/20260104/0", "title": "Example 0 (2026-01-04)"}]',1,'Today''s fixture update supports the synthetic milestone from 2026-01-03. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','[ja] Today''s fixture update supports the synthetic milestone from 2026-01-03. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','[es] Today''s fixture update supports the synthetic milestone from 2026-01-03. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','[fil] Today''s fixture update supports the synthetic milestone from 2026-01-03. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','because',NULL,NULL,NULL,'Today''s fixture update supports the synthetic milestone from 2026-01-03. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.',NULL,'1970-01-01 00:00:00');
INSERT INTO "validation_rows" VALUES('validation.c547050a3106e9e7','source.908ca8b3de629dc1','2026-01-04','prediction.394e027e97187004','Acme Metrics ships synthetic milestone 20260103-1 by Q3 2026','Acme Metrics ships synthetic milestone 20260103-1 by Q3 2026','Acme Metrics ships synthetic milestone 20260103-1 by Q3 2026','Acme Metrics ships synthetic milestone 20260103-1 by Q3 2026','2026-01-03','Today''s fixture update 20260104-1 touches the same synthetic storyline.','[{"url": "https://example.com/20260104/1", "title": "Example 1 (2026-01-04)"}]',3,'Today''s fixture update supports the synthetic milestone from 2026-01-03. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','[ja] Today''s fixture update supports the synthetic milestone from 2026-01-03. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','[es] Today''s fixture update supports the synthetic milestone from 2026-01-03. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','[fil] Today''s fixture update supports the synthetic milestone from 2026-01-03. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','given',NULL,NULL,NULL,'Today''s fixture update supports the synthetic milestone from 2026-01-03. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.',NULL,'1970-01-01 00:00:00');
INSERT INTO "validation_rows" VALUES('validation.5ca065acee5e1ae1','source.908ca8b3de629dc1','2026-01-04','prediction.394e027e97187004','Exampletron ships synthetic milestone 20260103-2 by Q3 2026','Exampletron ships synthetic milestone 20260103-2 by Q3 2026','Exampletron ships synthetic milestone 20260103-2 by Q3 2026','Exampletron ships synthetic milestone 20260103-2 by Q3 2026','2026-01-03','Today''s fixture update 20260104-0 touches the same synthetic storyline.','[{"url": "https://example.com/20260104/0", "title": "Example 0 (2026-01-04)"}]',3,'Today''s fixture update supports the synthetic milestone from 2026-01-03. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','[ja] Today''s fixture update supports the synthetic milestone from 2026-01-03. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','[es] Today''s fixture update supports the synthetic milestone from 2026-01-03. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','[fil] Today''s fixture update supports the synthetic milestone from 2026-01-03. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','so_that',NULL,NULL,NULL,'Today''s fixture update supports the synthetic milestone from 2026-01-03. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.',NULL,'1970-01-01 00:00:00');
INSERT INTO "validation_rows" VALUES('validation.ab62281d4f3bab45','source.908ca8b3de629dc1','2026-01-04','prediction.9bcf1ecbcbd67a64','Widgetly ships synthetic milestone 20260104-0 by Q3 2026','Widgetly ships synthetic milestone 20260104-0 by Q3 2026','Widgetly ships synthetic milestone 20260104-0 by Q3 2026','Widgetly ships synthetic milestone 20260104-0 by Q3 2026','2026-01-04','Today''s fixture update 20260104-0 touches the same synthetic storyline.','[{"url": "https://example.com/20260104/0", "title": "Example 0 (2026-01-04)"}]',1,'Today''s fixture update supports the synthetic milestone from 2026-01-04. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','[ja] Today''s fixture update supports the synthetic milestone from 2026-01-04. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','[es] Today''s fixture update supports the synthetic milestone from 2026-01-04. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','[fil] Today''s fixture update supports the synthetic milestone from 2026-01-04. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','because',NULL,NULL,NULL,'Today''s fixture update supports the synthetic milestone from 2026-01-04. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.',NULL,'1970-01-01 00:00:00');
INSERT INTO "validation_rows" VALUES('validation.051debcf908a0a9d','source.908ca8b3de629dc1','2026-01-04','prediction.a56031469a9a7ed3','Acme Metrics ships synthetic milestone 20260104-1 by Q3 2026','Acme Metrics ships synthetic milestone 20260104-1 by Q3 2026','Acme Metrics ships synthetic milestone 20260104-1 by Q3 2026','Acme Metrics ships synthetic milestone 20260104-1 by Q3 2026','2026-01-04','Today''s fixture update 20260104-1 touches the same synthetic storyline.','[{"url": "https://example.com/20260104/1", "title": "Example 1 (2026-01-04)"}]',3,'Today''s fixture update supports the synthetic milestone from 2026-01-04. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','[ja] Today''s fixture update supports the synthetic milestone from 2026-01-04. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','[es] Today''s fixture update supports the synthetic milestone from 2026-01-04. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','[fil] Today''s fixture update supports the synthetic milestone from 2026-01-04. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','given',NULL,NULL,NULL,'Today''s fixture update supports the synthetic milestone from 2026-01-04. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.',NULL,'1970-01-01 00:00:00');
INSERT INTO "validation_rows" VALUES('validation.f78233418ed906f4','source.908ca8b3de629dc1','2026-01-04','prediction.5ef4de1cc1f71cd0','Exampletron ships synthetic milestone 20260104-2 by Q3 2026','Exampletron ships synthetic milestone 20260104-2 by Q3 2026','Exampletron ships synthetic milestone 20260104-2 by Q3 2026','Exampletron ships synthetic milestone 20260104-2 by Q3 2026','2026-01-04','Today''s fixture update 20260104-0 touches the same synthetic storyline.','[{"url": "https://example.com/20260104/0", "title": "Example 0 (2026-01-04)"}]',3,'Today''s fixture update supports the synthetic milestone from 2026-01-04. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','[ja] Today''s fixture update supports the synthetic milestone from 2026-01-04. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','[es] Today''s fixture update supports the synthetic milestone from 2026-01-04. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','[fil] Today''s fixture update supports the synthetic milestone from 2026-01-04. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.','so_that',NULL,NULL,NULL,'Today''s fixture update supports the synthetic milestone from 2026-01-04. The vendor has not shipped yet, so the remaining gap is the milestone artifact itself.',NULL,'1970-01-01 00:00:00');
CREATE INDEX idx_source_files_report_date
ON source_files(report_date);
CREATE UNIQUE INDEX idx_categories_scope_label
ON categories(scope_id, label);
CREATE UNIQUE INDEX idx_evidence_canonical_url_unique
ON evidence_items(canonical_url)
WHERE canonical_url IS NOT NULL;
CREATE INDEX idx_evidence_first_seen
ON evidence_items(first_seen_date);
CREATE INDEX idx_evidence_memory_status
ON evidence_items(memory_status, active_until);
CREATE INDEX idx_themes_scope_category
ON themes(scope_id, category_id);
CREATE INDEX idx_themes_status
ON themes(status);
CREATE INDEX idx_theme_history_theme_date
ON theme_history(theme_id, effective_date);
CREATE INDEX idx_theme_mappings_old
ON theme_mappings(old_theme_id, effective_date);
CREATE INDEX idx_theme_mappings_new
ON theme_mappings(new_theme_id, effective_date);
CREATE INDEX idx_predictions_date
ON predictions(prediction_date);
CREATE INDEX idx_prediction_scope_theme
ON prediction_scope_assignments(scope_id, theme_id);
CREATE INDEX idx_prediction_scope_category
ON prediction_scope_assignments(scope_id, category_id);
CREATE INDEX idx_evidence_scope_theme
ON evidence_scope_assignments(scope_id, theme_id);
CREATE INDEX idx_prediction_evidence_validation
ON prediction_evidence_links(validation_date, scope_id);
CREATE INDEX idx_prediction_evidence_prediction
ON prediction_evidence_links(prediction_id, scope_id);
CREATE INDEX idx_validation_rows_date
ON validation_rows(validation_date);
CREATE INDEX idx_validation_rows_prediction
ON validation_rows(prediction_id);
CREATE INDEX idx_prediction_realization_window
ON prediction_realization_snapshots(scope_id, validation_date, window_id);
CREATE UNIQUE INDEX idx_topic_daily_theme_activity
ON topic_daily_activity(activity_date, window_id, scope_id, theme_id)
WHERE activity_level = 'theme';
CREATE INDEX idx_topic_daily_scope_date_window
ON topic_daily_activity(scope_id, activity_date, window_id);
CREATE INDEX idx_topic_daily_theme_date_window
ON topic_daily_activity(theme_id, activity_date, window_id);
CREATE UNIQUE INDEX idx_category_daily_unique
ON category_daily_activity(activity_date, window_id, scope_id, category_id);
CREATE INDEX idx_theme_candidates_status
ON theme_candidates(status, scope_id);
CREATE INDEX idx_graph_exports_scope_window
ON graph_exports(scope_id, window_id, generated_at);
CREATE INDEX idx_prediction_needs_prediction
ON prediction_needs(prediction_id);
CREATE INDEX idx_needs_tasks_need
ON needs_tasks(need_id);
CREATE INDEX idx_prediction_chain_source
ON prediction_chain(source_prediction_id);
CREATE INDEX idx_prediction_chain_downstream
ON prediction_chain(downstream_prediction_id);
CREATE INDEX idx_prediction_relations_a
ON prediction_relations(prediction_a);
CREATE INDEX idx_prediction_relations_b
ON prediction_relations(prediction_b);
CREATE INDEX idx_prediction_relations_family
ON prediction_relations(family_id)
WHERE family_id IS NOT NULL;
CREATE INDEX idx_glossary_status
ON glossary_terms(status);
CREATE INDEX idx_glossary_occurrences_date
ON glossary_occurrences(occurrence_date);
CREATE INDEX idx_glossary_audit_term
ON glossary_audit(term, checked_at);
CREATE VIEW v_prediction_assignments AS
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
LEFT JOIN themes t ON psa.theme_id = t.theme_id;
CREATE VIEW v_latest_topic_activity AS
SELECT tda.*
FROM topic_daily_activity tda
JOIN (
  SELECT
    scope_id,
    window_id,
    theme_id,
    activity_level,
    MAX(activity_date) AS max_activity_date
  FROM topic_daily_activity
  GROUP BY scope_id, window_id, theme_id, activity_level
) latest
ON tda.scope_id = latest.scope_id
AND tda.window_id = latest.window_id
AND tda.theme_id = latest.theme_id
AND tda.activity_level = latest.activity_level
AND tda.activity_date = latest.max_activity_date;
CREATE VIEW v_latest_category_activity AS
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
COMMIT;
