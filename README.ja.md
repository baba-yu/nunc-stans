# news

*Available in: [English](README.md) | [Español](README.es.md) | [Filipino](README.fil.md)*

- [News Explorer (GitHub Pages)](https://baba-yu.github.io/news/) — 未来予測ダッシュボード
- `report/` — 日次ニュースレポート
- `future-prediction/` — 今日のニュースと昨日までの日次ニュースFuture欄の答え合わせ

---

## 2026-04-26

### News

- **Google が Anthropic に最大 $40B コミット（Apr 24、Bloomberg）— 初期 $10B キャッシュを $350B バリュエーションで、加えて $30B マイルストーン連動 + 5 年で 5GW Google Cloud 容量** — Amazon の $25B + 5GW Trainium2/3 コミットの数日後。**フロンティアラボ 3 社（Anthropic / OpenAI / Thinking Machines Lab）すべてがハイパースケーラの引受人をキャップテーブルに持つ構造**へ — 一部はキャッシュではなく計算容量で支払い
- **DeepSeek V4 が 9.5x-13.7x 低メモリ + Huawei Ascend 共チューニングで投入、Apr 26 Bloomberg-CCTV 記事が国産チップへの軸足移行を確認** — V4-Pro（1.6T MoE / 49B active）と V4-Flash が **Hybrid Attention** で **V3.2 比 9.5x-13.7x のメモリ削減**、ネイティブ 1M トークンコンテキスト。Apr 26 Bloomberg が CCTV 系ソーシャルアカウントを引いて V4 タイムラインのシフトが **Huawei Ascend ハードウェア固有の最適化**に駆動されたと確認。V4-Pro 価格 $1.74 / $3.48 per M tokens — **Claude Opus 4.7 比 約 7x 安価** で GPT-5.4 / Opus 4.6 級品質
- **SGLang CVE-2026-5760（CVSS 9.8）— 悪意ある GGUF chat_template（Jinja2 SSTI）経由の RCE、公開 PoC + CERT/CC VU#915947** — `tokenizer.chat_template` に Jinja2 SSTI ペイロードを仕込んだ GGUF ファイル + Qwen3 reranker トリガーフレーズで `entrypoints/openai/serving_rerank.py` の脆弱パスが発火、SGLang が `jinja2.Environment()` でテンプレートをレンダ → 任意コード実行。**公開 PoC が `github.com/Stuub/SGLang-0.5.9-RCE`**、CERT/CC VU#915947 発行、推奨 fix は `ImmutableSandboxedEnvironment`。AI 推論サーバが **LMDeploy SSRF に続く 2 つ目の武器化された AI-infra プリミティブ**として確定
- **Qwen3.6-27B（Apr 22、トラクション Apr 23-26）— Apache 2.0 dense 27B が 397B-A17B MoE をコーディングで上回る** — SWE-bench Verified **77.2% vs 76.2%**、Terminal-Bench 2.0 59.3 で Claude Opus 4.5 と肩を並べる、**RTX 3090 Q4_K_M ~16.8 GB VRAM で 40 tok/s**、262K context（1M まで拡張可能）、新しい **Thinking Preservation** メカニズム。「シングル GPU コーディングエージェント」の新しいベースラインを設定
- **Microsoft ASP.NET Core CVE-2026-40372（CVSS 9.1）— DataProtection 10.0.0-10.0.6 の SYSTEM 権限 cookie 偽造欠陥に out-of-band 緊急パッチ** — `ManagedAuthenticatedEncryptor` が HMAC 検証タグを誤ったオフセットで計算、全ゼロ HMAC タグの ciphertext が誤って valid と受理される。**認証 cookie 偽造、antiforgery トークン操作、保護ペイロード復号** — SYSTEM までのなりすましが可能。`Microsoft.AspNetCore.DataProtection 10.0.7` で修正。**DataProtection キーリングの回転 + 脆弱期間中に発行された長寿命トークンの監査**が必要
- **OpenClaw v2026.4.25-beta トレイン（Apr 26、beta.3-7+）— voice reply / TTS アップグレード、6 つの新 TTS プロバイダ** — Azure Speech / Xiaomi / Local CLI / Inworld / Volcengine / ElevenLabs v3。**beta.3（Apr 26 13:00）→ beta.4（Apr 26 13:24）→ beta.7+ が単一の午後にリリース** — 連続的な voice-stack 強化下でリリーステンポは sub-24h。Voice reply が「利用可能」から「production 形」へ
- **Pillar Security: Antigravity の `find_by_name -X` exec-batch フラグ経由のプロンプトインジェクション sandbox エスケープ（Google パッチ済み、bug bounty 支払い済み）** — `find_by_name` の Pattern パラメータが `fd` に `-X` を挿入、Antigravity の Secure Mode 下でも RCE を達成。**3 つ目の agentic-IDE ベンダがコメントスタイルプロンプトインジェクションクラスに脆弱と確認**
- **Apr 23 Claude Code リグレッションについての Anthropic エンジニアリングポストモーテム — March 4 reasoning カット + April 16 verbosity-prompt 問題、Apr 20 v2.1.116 で修正** — Anthropic 公式ポストモーテムが anthropic.com/engineering/april-23-postmortem に掲載、Claude Code + Agent SDK + Cowork 全体で **2 つの異なる週単位品質リグレッション**を整理 — ユーザを「自分のせいか」と思わせていた
- **Claude Code v2.1.119 / v2.1.120 24 時間リグレッションクラスタ（Apr 24-25）** — **24 時間で 8 リグレッション**: 撤回級の自動更新破壊、サイレントモデルスワップ、resume 時クラッシュ x2、UI 重複バグ、WSL2 限定 `/mcp` フリーズ、CLAUDE.md 無視リグレッション、`sandbox.excludedCommands` 約束破壊、macOS worktree ハング。サバイバルチェックリストは v2.1.117 ロールバックを推奨
- **野生のインダイレクトプロンプトインジェクション — Google Online Security Blog + Help Net Security Apr 24、Nov 2025-Feb 2026 で 32% YoY 上昇** — Google 一次調査がオープンウェブをクロールして **悪意あるプロンプトインジェクションコンテンツの 32% 増加** を定量化、**確認済み 10 件の野生 IPI 攻撃** を文書化 — 脅威が「GitHub コメント」から **「オープンウェブ」** へ一般化
- **Ollama MLX バックエンド Apr 23 ディープダイブ（gingter.org）— Foundry Local は Metal 限定のまま、MLX ギャップ拡大** — Ollama on M5 Max で **Qwen3.5-35B-A3B + NVFP4 にて prefill 1.57x / decode 1.93x**；Foundry Local の MLX サポートは未解決の issue（`microsoft/Foundry-Local#329`）のまま
- **llama.cpp ビルド b8936 + b8937 が Apr 26 の 1 時間以内（08:54 + 09:28 UTC）に着地** — 日曜日の 1 時間以内に 2 ビルド — 「ノーウィンドウリリース」パターンが破られた
- **NVIDIA $5T 時価総額再奪取 + AMD +13.9% + Nasdaq / S&P 500 史上最高値（Apr 24、carry-forward）** — Intel Q1 2026 ビート（EPS $0.29 vs $0.01、売上 $13.6B +7% YoY、Apr 24 引け +24% — 1987 年以降最大の単日上昇）が触媒として確定、iShares Semiconductor ETF が Apr 24 までに MTD +40.4%

[news-20260426.md](report/ja/news-20260426.md)

### Predictions check

- **直近 1 週間（4/19-4/25）で 17 予測検証。Relevance 5 が 8 件、Relevance 4 が 4 件、Relevance 1-2 が 5 件**
- **インダイレクトプロンプトインジェクションが CVE 主カテゴリ化（4/19）** Relevance 5：**SGLang CVE-2026-5760 + Pillar Antigravity + Google IPI 32% YoY** で三重確認
- **ローカル優先のクラウドオーバーフロー逆転（4/20）** Relevance 5：本日の Future #3 で明示的に **「Q3 2026 までにコンシューマ GPU コーディングエージェントが cloud-only コーディング API を 30% 以上の dev ワークロードで置き換え」** と成文化。Qwen3.6-27B + Ollama MLX + DeepSeek V4-Pro の 3 角絞り
- **GGUF サプライチェーン予測（4/21）** Relevance 5：**SGLang chat_template SSTI に対する PoC + CERT/CC VU#915947** で決定的に着地 — llama-cpp-python の CVE-2024-34359（"Llama Drama"）と同じ脆弱性クラス
- **ハイパースケーラ × フロンティアラボ 5 極体制（4/21）** Relevance 5：**Google × Anthropic $40B / 5GW ディール** がトリオを完成（Amazon $25B + Microsoft $13B+ + Google $40B）で Big-3 確認。本日 Future #1 が Q3 2026 までに **エンタープライズマルチクラウド LLM 戦略が「マルチランタイム」から「マルチフロンティアベンダ」へシフト**と予測
- **プロプライエタリ vs オープン重み分断（4/21）** Relevance 5：**GPT-5.5 API +2x** vs **DeepSeek V4-Pro 約 7x 安価** が同一窓で着地して鋭利化、Apr 26 Bloomberg-via-CCTV 記事が DeepSeek V4 と Huawei Ascend を公式整合
- **Agent Registry / OAuth 横断信任 / Agent Control Plane（4/19, 4/22, 4/23）** Relevance 5：すべてが **Okta の Showcase 2026 ブループリント（中央 MCP コントロールプレーンとしての Agent Gateway）**、Cross App Access プロトコル、TrueFoundry の MCP Security / Zero Trust ガイドに収束
- **27B Dense + 1M context 標準化（4/23）** Relevance 5：**Qwen3.6-27B が 397B-A17B MoE を SWE-bench Verified でコンシューマ GPU 価格帯で上回る**（RTX 3090 Q4_K_M ~16.8 GB で 40 tok/s）で決定的に着地
- **3 クラウドオリゴポリ説（4/25）** Relevance 5 — 本日のキーストーン検証。Anthropic 年率換算売上が **$30B 超**（2025 年末 ~$9B から）
- **Relevance 4**：CI / エージェント経由のシークレット流出（4/20、Pillar の 3 つ目の agentic-IDE RCE）；Physical-AI-as-RaaS（4/22、BMW Leipzig + Tesla Earth Day + Hannover Messe）；1M context 既定オープン重み（4/24、DeepSeek V4 + Qwen3.6-27B）；MCP プロトコル攻撃面（4/25、同窓で脅威 + 防御）
- **Relevance 1-2**：1-bit ネイティブ訓練（4/19）、Headless Everything（4/20）、訓練 vs 推論 SKU 分離（4/22）に本日直接進展なし。サードパーティベンダ境界（4/23）と SaaS 置換バリュエーションリセット（4/24）は弱信号のみ — 本日の市場アクションは予測されていた Workday / Atlassian / Box / Smartsheet 15%+ 連鎖落ではなくハードウェアラリー駆動（NVIDIA $5T 再奪取 / AMD +13.9% / Intel +24%）
- ユーザー予測1（悪性ローカル LLM のマルウェア化）：**強い裏付け**。SGLang CVE-2026-5760 がまさに失敗モード — モデルファイル（GGUF）が実行可能コード（`tokenizer.chat_template` の Jinja2 SSTI）を運び、推論サーバ内で発火、公開 PoC + CERT/CC VU#915947 で武器化。Okta の中央 MCP コントロールプレーンとしての Agent Gateway + TrueFoundry の "MCP Security: Guide to Zero Trust for Agentic AI" が **「AI 単独でアクセス不可なシステムパスを意図的に設計する」** アーキテクチャを実商品カテゴリとして定式化
- ユーザー予測2（クラウド vs ローカル分化、SaaS 値上げ）：**直接成文化された確認**。本日の Future #3 が明示的に **「Q3 2026 までにコンシューマ GPU コーディングエージェントが cloud-only コーディング API を 30% 以上の dev ワークロードで置き換え」**。GPT-5.5 API $5 / $30（2x 値上げ、Codex で出力トークン 約 40% 削減で「per-token 値上げを per-task コストで相殺」）が DeepSeek V4-Pro 約 7x 安価と同一週に着地
- ユーザー予測3（RL/LLM による予測改善）：本日直接事例なし。最も近い隣接は Anthropic エンジニアリングポストモーテム（品質リグレッション分析、予測改善ピースではない）。Carry-only

[future-prediction-20260426.md](future-prediction/ja/future-prediction-20260426.md)

---

## 2026-04-25

### News

- **NVIDIA、Apr 24 終値で時価総額 $5.12 兆を再達成** — Intel の Apr 23 引け後決算大幅ビートを起点にチップセクタ全面高、NVIDIA は $208.27（+4.3%）で過去最高値引け、Alphabet との時価総額差は $1 兆超に拡大。AMD は同日 **+13.90%（$347.77）** で続伸（決算 5/5）、Nasdaq Composite **+1.63% / 24,836.60**、S&P 500 **+0.80% / 7,165.08** の最高値引け
- **Tesla、Apr 25 を Earth Day マーケティングデーに、Optimus V3「Plant Cube」を限定配布** — 米国直営店で FSD (Supervised) デモドライブ参加者に Optimus が植えた Plant Cube 配布。Apr 23 決算で **V3 mid-2026 デビュー / 7-8 月量産** 再確認、2026 capex $25B 超ガイダンス、Fremont 年産 100 万体 / Giga Texas 第 2 工場 1,000 万体規模
- **Google Cloud × Thinking Machines Lab、複数億ドル規模 GB300 契約（Apr 22 発表）** — Mira Murati の TML が NVIDIA **GB300** 搭載 Google Cloud **A4X Max** VM を採用、訓練 / サービング速度前世代比 **2x**。Anthropic / Meta に続く Google Cloud 3 件目のフロンティアラボ契約
- **BMW Group、Apr 2026 から Leipzig 工場で AEON ヒューマノイド本格テスト + Physical AI Center of Competence 設立** — Spartanburg の **Figure 02 が 10 ヶ月で 30,000 台 / 9 万部品 / 1.2M ステップ / 1,250 時間稼働**、欧州初の Physical AI 拠点を Leipzig に開設。Hexagon Robotics 製 **AEON**（22 センサ / 自己交換バッテリ / 4 層 Physical AI / 20 デモで自律動作習得）を Apr 2026 から導入し夏のパイロット本番へ
- **Hannover Messe 2026（Apr 20-24）閉幕、Physical AI が初の中心テーマ** — 130,000 来場者 / 4,000 出展者 / 1,600 講演者、AEON / HMND 01 / Apptronik Apollo / Agility Digit 並列展示
- **OpenAI GPT-5.5 / GPT-5.5 Pro、Apr 24 に API 公開** — input $5.00 / output $30.00 per M tokens（GPT-5.4 比 **2x 値上げ**）、Pro は $30 / $180。Codex で出力トークン約 40% 削減で per-task コストオフセット設計
- **DeepSeek V4 Pro 詳細ベンチマーク** — IMOAnswerBench **89.8**（Claude Opus 4.7 75.3 / Gemini 3.1-Pro 81.0 を上回り、GPT-5.4 91.4 に肉薄）、agentic で Sonnet 4.5 を上回り Opus 4.5 級。価格 **$1.74 入力 / $3.48 出力 per M tokens（Opus 4.7 比 7 分の 1）**、Apache 2.0、Huawei Ascend 密結合
- **Claude Code v2.1.117（Apr 25）** — `/resume` がスタール / 大型セッションを再読込前に自動要約してコンテキスト溢れ防止、プロジェクト pin と異なるモデル選択を再起動越し永続化、起動ヘッダにモデル出所表示、`CLAUDE_CODE_FORK_SUBAGENT=1` でフォーク subagent 外部ビルド有効化、`--agent` で mcpServers 自動ロード
- **OpenClaw v2026.4.23（Apr 24）** — Providers/OpenAI に Codex OAuth 経由の画像生成 + 参照画像編集（OPENAI_API_KEY 不要で `openai/gpt-image-2`）、Providers/OpenRouter にも `image_generate` 経由の画像生成 + 参照画像編集追加
- **AWS Bedrock AgentCore Browser に OS-level interaction 追加（Apr 22）** — ファイルアップロード / OS ダイアログ操作 / 複数ウィンドウ切替、エージェントが「ブラウザ内」を超えてホスト OS と対話可能
- **Salesforce Q4：Agentforce ARR $800M / 29,000 ディール（前 Q 比 +50%）** — FY2026 売上 $41.5B、Q4 EPS $3.81 / 売上 $11.20B（+12.1% YoY）、ServiceNow との「decline vs accelerate」二極化が鮮明化
- **Nginx UI CVE-2026-33032（MCPwn、CVSS 9.8）が実環境で活発悪用** — `/mcp_message` エンドポイントが空デフォルト IP 許可リストで認証ミドルウェア欠落、未認証で 12 個の MCP ツール呼出 → 2 HTTP リクエストで完全乗っ取り。Recorded Future の March 2026 Top 31 アクティブ悪用 CVE、**Shodan 2,600+ インスタンス露出**、v2.3.4 で修正
- **CISA、Apr 24 に 4 件を KEV カタログ追加** — CVE-2024-7399（Samsung MagicINFO 9 Server Path Traversal）/ CVE-2024-57726（SimpleHelp Missing Authorization）/ CVE-2024-57728（SimpleHelp Path Traversal）/ CVE-2025-29635（D-Link DIR-823X Command Injection）の 4 件、いずれも実環境悪用中
- **Saltcorn CVE-2026-41478（CVSS 9.9）公開（Apr 24）** — Mobile-Sync の SQL Injection で認証付き低権限ユーザが任意 SQL 注入可能、admin パスワードハッシュ / 設定 secrets を含む完全 DB 漏洩。1.4.6 / 1.5.6 / 1.6.0-beta.5 で修正
- **Amazon × Anthropic 追加 $25B 投資 + 5GW Trainium2/3 容量（Apr 20 詳細確定）** — $5B 即時 + $20B マイルストン連動、Anthropic は AWS に 10 年 $100B コミット、2026 末までに 1GW Trainium2/3 同時稼働
- **AI Tinkerers SF + AI Dev 26 x SF + Sage Future の連続開催（Apr 28-30）** — Apr 29 AI Tinkerers SF VIP Dinner（Building Software Factories with Kiro & B-Capital）、Apr 28-29 AI Dev 26 x SF @ Pier 48（3,000+ 開発者）、Apr 28-30 Sage Future @ Moscone Center

[news-20260425.md](report/ja/news-20260425.md)

### Predictions check

- 直近 1 週間 17 予測検証。**Agent Control Plane / OAuth 横断信任 / Physical AI SaaS 化 / 1M context オープン重み標準 / ハイパースケーラ × フロンティアラボ排他同盟 / プロプライエタリ × オープン分断** の 6 軸で **Relevance 5** の連続裏付け
- **プロプライエタリ × オープン分断（4/21-3）** Relevance 5：GPT-5.5 API 2x 値上げ × DeepSeek V4 Pro 7x 価格破壊が**同日リリース**で完全顕在化。Apache 2.0 オープン重みで Opus 4.5 級が手元で動く構造
- **ハイパースケーラ × フロンティアラボ排他同盟（4/21-2）** Relevance 5：Google × Thinking Machines Lab GB300 契約で 3 社目確定、Amazon × Anthropic $25B + 5GW Trainium 容量 + 10 年 $100B コミット詳細確定、Vera Rubin 7 チップ量産入りと合わせ「訓練 = 3 社寡占 / 推論 = 多層化」二層構造へ固定
- **Physical AI SaaS / RaaS 化（4/22-2）** Relevance 5：BMW Leipzig AEON Apr 2026 テスト + Spartanburg Figure 02 の 10 ヶ月 / 30,000 台実績 + Hannover Messe 2026 で Physical AI 初の中心テーマ + Tesla Optimus Earth Day Plant Cube 配布が同期、RaaS / フリート管理 SaaS への構造移行が可視化
- **Physical AI 8 時間本番稼働 = 調達条件（4/24-2）** Relevance 5：BMW Spartanburg Figure 02 が 1,250 時間稼働を確定、IROS 10 月 / GTC Fall 2026 で「OEM 採用社数 × 連続稼働時間 × MTBF」リーグテーブル化が見通し
- **Agent Control Plane（4/23-1）** Relevance 5：Okta for AI Agents Apr 30 GA カウントダウン + AWS Bedrock AgentCore Browser OS-level + Managed Harness CLI / Skills + Salesforce Agentforce ARR $800M / 29,000 ディール（+50% QoQ）で課金エンジン本格立ち上がり
- **OAuth 横断信任（4/22-3）** Relevance 5：Okta for AI Agents が「同社最重要プロダクト」として GA 直前段階、Microsoft Copilot Studio CVE-2026-21520 で「パッチだけでは indirect prompt injection は閉じない」と Capsule Security 断言、エンタープライズの MCP / agent 接続点監査必須化
- **1M context が既定（4/24-1）** Relevance 5：DeepSeek V4 Pro が Hybrid Attention で長文脈推論コスト V3.2 比 27% / KV キャッシュ 10% 圧縮、Apache 2.0 で「1M token race」再点火
- **Agent Registry（4/19-2）** Relevance 5：Okta for AI Agents の Agent Gateway / MCP virtual server / Okta MCP registry + AWS Bedrock AgentCore Managed Harness + CLI + Skills（Kiro Power 即時 / Claude Code・Codex・Cursor 来週）で配布層整備
- **Relevance 1-2**：Headless Everything（4/20-3、Relevance 1）は AgentCore Browser OS-level 拡張で逆向き、1-bit ネイティブ学習（4/19-1、Relevance 1）は Qwen / Llama 派生新出なし、SKU 分離（4/22-1、Relevance 2）と CI Secret 流出 OWASP 昇格（4/20-2、Relevance 2）は本日直接進展なし
- ユーザー予測1（悪性ローカル LLM のマルウェア化）：**Nginx UI CVE-2026-33032 (MCPwn)** で MCP プロトコル統合層自体の構造的欠陥が malware 経路化、本日 Future の 3 番目予測で「OWASP MCP Top 10 公式公開 / MCP-over-mTLS 業界標準化 / Keycard・Okta・Wiz・Levo.ai・Pillar Security の MCP Gateway / Firewall 投入」が予測、強く裏付け
- ユーザー予測2（クラウド vs ローカル分化、SaaS 値上げ）：**GPT-5.5 API 2x 値上げ × DeepSeek V4 Pro 7x 価格破壊**の同日対比で本週最も精度の高い予測。「料金体系変化が先行」が決定的に確認、「役割分化」も Apache 2.0 で Opus 4.5 級が手元で動く形に進行
- ユーザー予測3（RL/LLM による予測改善の普及）：本日も直接事例なし。Claude Code v2.1.117 `/resume` 自動要約 + DeepSeek V4 Hybrid Attention + GPT-5.5 Codex 40% 出力削減が隣接兆候

[future-prediction-20260425.md](future-prediction/ja/future-prediction-20260425.md)

---

## 2026-04-24

### News

- **DeepSeek V4 Preview 公開** — V4-Pro（1.6T MoE / 49B active）+ V4-Flash（284B / 13B active）同時公開、ネイティブ 1M token context、Hybrid Attention で 1M context 時 FLOPs 27% / KV キャッシュ 10% に削減。Hugging Face オープンウェイト、API は Pro $0.145/$3.48 per M tokens。Simon Willison「フロンティア手前の価格破壊」
- **OpenAI GPT-5.5 / GPT-5.5 Pro 公開（Apr 23）** — ChatGPT Plus/Pro/Business/Enterprise + Codex に展開、SWE-bench **88.7%**、MMLU 92.4%、幻覚 **-60%** vs GPT-5.4。NVIDIA GB200 NVL72 ラック運用、API 価格 2x
- **Intel Q1 2026 決算：EPS $0.29 / 売上 $13.58B で大幅ビート、株価 +20%** — データセンタ +22% YoY、AI 関連事業が全売上の **60%**、+40% YoY。Intel 18A プロセス立ち上がり寄与、6 四半期連続ガイダンス超過
- **Anthropic Claude Code 品質低下ポストモーテム公開、使用制限リセット** — 3/4 reasoning effort「high→medium」変更 + 3/26 idle 時 thinking クリアバグ + 4/16 verbosity 削減 prompt の 3 件が複合し Sonnet 4.6 / Opus 4.6 の知性低下を誘発と結論。v2.1.116 で全 revert、4/23 全サブスクの使用制限リセット
- **Siemens × Humanoid の HMND 01 Alpha、Erlangen 工場で 8 時間連続ロジスティクス自律稼働** — NVIDIA Physical AI + KinetIQ + Siemens Xcelerator 統合、60 tote/h × 8h × pick-and-place 成功率 **90%+**。本番ライン組込み（PoC → 本番の質的跳躍）
- **Agentic AI Security ソリューションプロバイダ軸が一気に成立** — Zero-trust access control 側で **Okta for AI Agents（2026-04-30 GA）** が AI エージェントを第一級 identity として中央ディレクトリ登録、**Keycard**（$38M 調達、Anchor.dev / Runebook 買収 + Smallstep 提携）が Control Plane で workload attestation（SPIFFE/mTLS）+ dynamic / task-scoped / revocable トークン提供、**Cisco Zero Trust Access**（Duo IAM + MCP 強制 + intent-aware monitoring）、**Microsoft Zero Trust for AI**（Entra Agent ID + Purview + Defender for AI）、**CSA Agentic Trust Framework**（ベンダ中立 Zero Trust 仕様）、**Wiz AI-APP**（Google Cloud 傘下、code-to-runtime）、**CrowdStrike / Palo Alto** が Project Glasswing ローンチパートナー。Behavior analytics 側は **Exabeam Agent Behavior Analytics** が「AI Insider 脅威」新設 + OWASP Agentic Top 10 全対応 + Google Cloud Partner of the Year 2026、**Zenity**（Gartner Hype Cycle 2 カテゴリ掲載 + Fortune Cyber 60 + FedRAMP In Process）、**Arize / Braintrust / Galileo / Fiddler / Levo.ai / LangSmith** 参入
- **Tencent Hunyuan Hy3 Preview オープンソース化**、**0G × Alibaba Qwen オンチェーン提携**、**Qwen3.6-27B** 拡散継続 — 中国 AI ラボ 3 社がオープン重みフロンティアに同週投入
- **ServiceNow、決算後 -18%（2026 YTD -45%）**、Salesforce / Workday / Oracle / IBM も連鎖下落で「AI disruption on legacy SaaS」独立テーマ化
- **Tesla Optimus V3 量産タイムライン確定** — Fremont Model S/X ライン転用で 7 月末〜8 月量産、第 1 世代年産 100 万、Giga Texas 第 2 工場 10M 規模、2026 capex $25B 超
- **AWS Bedrock AgentCore Managed Harness 詳細仕様** — 3 API で稼働、filesystem persistence、AgentCore CLI、pre-built coding skills、US/EU/APAC preview
- **Google Cloud Next '26 Day 3** — Agentic Data Cloud + Agentic Defense、Workspace Skills / Meet「Take Notes For Me」、TPU 8i（inference 最適化 / SRAM 3x）
- **Anthropic Project Glasswing 40+ 組織参加** — AWS / Apple / Google / MS / NVIDIA / JPMorgan / Linux Foundation など。$100M Mythos クレジット + $4M オープンソース寄付
- **重大 CVE 公開**：ToToLink A3300R 9.8 / Ntfy parseActions 9.8 / Kofax Capture 9.8 / hackage-server 9.9 / Pipecat 9.8。CISA KEV に **Marimo Pre-Auth RCE (CVE-2026-39987)** 追加、連邦機関修正期限 May 7
- **Mercor データ流出の集団訴訟化** — 4TB / 顔生体情報 / API キーが TeamPCP により LiteLLM CI/CD 経由で流出、7+ クラスアクション提訴、Anthropic Mythos Preview 侵入との連鎖（Proofpoint）
- **RSAC 2026 で CrowdStrike / Cisco / Palo Alto が agentic SOC ツール一斉出荷**、ただし agent telemetry 標準化欠如が共通ギャップと VentureBeat 分析

[news-20260424.md](report/ja/news-20260424.md)

### Predictions check

- 直近 1 週間 15 予測の検証（更新版）。Relevance 5 が **8 件** / 4 が 2 件 / 3 が 3 件 / 2 が 1 件 / 1 が 1 件。更新版は **Agent Control Plane / OAuth 横断信任 / 第三者ベンダ境界 / Agent Registry** の 4 予測を決定的に裏付ける新セクション（Zero-trust Access Control + Agent Behavior Analytics）を含む
- **Agent Registry（4/19-2）** Relevance **3→5 昇格**：Okta for AI Agents（Apr 30 GA）+ Keycard Control Plane で成果物・権限・監査の配布標準が具体プロダクトとして現出
- **Secret 流出 OWASP 昇格（4/20-2）** Relevance 5 維持・具体化：Exabeam が「AI Insider 脅威」新設 + **OWASP Agentic Top 10 全 10 カテゴリ対応** で予測したフレームワーク昇格が実商用化
- **OAuth 横断信任（4/22-3）** Relevance **4→5 昇格**：Okta for AI Agents + Cisco Duo IAM + MCP ポリシー + Microsoft Entra Agent ID + CSA Agentic Trust Framework が同時展開、「SSO が AI 拡張スコープを分離」予測が正面突破
- **第三者ベンダ境界（4/23-3）** Relevance 5 維持・拡張：Zenity FedRAMP In Process + Microsoft Zero Trust for AI（データ取込〜挙動全体）+ CSA ATF の ベンダ中立 governance 化
- **Agent Control Plane（4/23-1）** Relevance 5 維持・市場成熟段階：AWS / Google / Okta / Keycard / Cisco / Microsoft 同期公表、RSAC 2026 で CrowdStrike / Cisco / Palo Alto agentic SOC 一斉出荷、ただし agent telemetry 標準化欠如が共通ギャップ
- **Relevance 5 その他**：間接プロンプトインジェクション CVE 化（4/19-3、10 件 in-the-wild + Antigravity RCE + CVE-2026-21520）、プロプライエタリ再膨張 × オープン地政学分断（4/21-3、DeepSeek V4 + Tencent Hy3 + GPT-5.5 2x）、Physical AI SaaS/RaaS 化（4/22-2、Siemens × Humanoid 本番 8h）
- **Relevance 1-2**：Headless Everything（4/20-3、今日も進展なし）、GGUF 署名検証標準化（4/21-1、SGLang / Pipecat CVE のみで標準化なし）
- ユーザー予測1（悪性ローカルLLMのマルウェア化）：SGLang / Pipecat CVE の RCE 経路 + 10 件 Indirect PI + Exabeam「AI Insider 脅威」+ Levo.ai eBPF runtime 検知で、ローカル LLM 実行層の malware ホスト化に検知側 / 規制側が同時進行で対応中
- ユーザー予測2（RL/LLM による予測改善）：本日も直接事例なし。Anthropic 品質ポストモーテム + GPT-5.5 の planning/tool/self-check + Galileo Luna-2 evaluators（agent drift 自動特定）が隣接兆候
- ユーザー予測3（電力/計算資源逼迫で AI SaaS 値上げ）：**最強相関** — GPT-5.5 API 価格 2x、Alphabet 2026 capex $175-185B（2025 の 2x）、Te