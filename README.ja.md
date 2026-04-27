# news

*Available in: [English](README.md) | [Español](README.es.md) | [Filipino](README.fil.md)*

- [News Explorer (GitHub Pages)](https://baba-yu.github.io/news/) — 未来予測ダッシュボード
- `report/` — 日次ニュースレポート
- `future-prediction/` — 今日のニュースと昨日までの日次ニュースFuture欄の答え合わせ

---

## 2026-04-27

### News

- **Mag 7 決算ウィーク 4/27 開幕、Iran/Hormuz 緊張で地合い軟化 — Alphabet/Amazon/Meta/Microsoft が 4/29、Apple は 4/30、いずれも MTD で 10% 超上昇のなか発表へ** — 4/27 先物がホルムズ海峡の新たな緊張で軟化:Dow 先物 -0.17%(49,306)、S&P -0.09%、Nasdaq -0.03%。**Mag 7 のうち 5 社が今週決算**、Alphabet ($175B-$185B) + Amazon (~$200B AWS-AI) + Meta ($115B-$135B) + Microsoft (Azure ラガード再評価リスク) の 2026 capex 合計 **~$650B-$700B** がウォール街の「AI ROI リコニング」と対峙 — ナラティブは「信仰でキャペックスを報いる」から「有形な利益を要求する」へ。FRB は今週金利据え置き(確率 100%)。
- **Hermes Agent v0.11.0「Interface」(4/23、トラクション 4/25-27)— React/Ink TUI フルリライト、ネイティブ AWS Bedrock、Codex OAuth 経由 GPT-5.5、コミット 1,556 件 / PR 761 件 / 挿入 22 万 4 千行 / 貢献者 29 名** — Hermes Agent 史上最大のリリース:全プロバイダの基盤にプラガブル トランスポート アーキテクチャ、**新規推論パス 5 種**、17 番目のメッセージング プラットフォーム(QQBot)、シェルフック(pre/post tool call、on_session_start)、ゼロ LLM Webhook 直接配信モード、`max_spawn_depth` 設定可能なサブエージェント オーケストレーター、並行兄弟プロセス用ファイル協調レイヤ。**7 週間で GitHub スター 95,600 超**。
- **推論ランタイム + CI/CD CVE 大波が継続:CVE-2026-7037 Totolink RCE(CVSS 9.8、公開 PoC) + CVE-2026-6951 simple-git RCE(CVSS 9.8、CI/CD 基盤 Node.js 依存) + SGLang CVE-2026-5760 が v0.5.10 でも未パッチ** — 4/26 デイリーロール:**高優先 31 件 + 活発に悪用中 19 件**;4/27 に **CVE-2026-33277(LogonTracer、CVSS 8.8)** + **CVE-2026-42363(GeoVision GV-IP 認証情報漏洩、CVSS 9.3)** が追加。SGLang の Jinja2 SSTI は **公開期間後も依然未修正**。CSO Online が Meta / Nvidia / Microsoft の AI 推論フレームワーク横断で GGUF テンプレートレンダリング・プリミティブを一般化。
- **Sam Altman 対 Anthropic Claude Mythos「恐怖ベースのマーケティング」論争 — IPO シーズンを前に世論が冷え込む** — 4/21 Altman:「核爆弾を落とすと脅しながら核シェルターを売る」;議論は **Altman 自宅への物理的攻撃(4/16)**、**Discord/コントラクター URL 推測経由の Mythos 流出**、4/15 CNBC AI/データセンター反発の世論データを背景に 4/26 まで激化。**Project Glasswing ロスター 12 ローンチ パートナーで確定**(AWS、Apple、Broadcom、Cisco、CrowdStrike、Google、JPMorganChase、Linux Foundation、Microsoft、NVIDIA、Palo Alto Networks、Anthropic) + 重要インフラ 40 組織。ProMarket が反トラスト リスクを警告。
- **SF AI カンファレンス シーズン 4/28-29 開幕 — Pier 48 で AI Dev 26(デベロッパー 3,000 名超、Andrew Ng ホスト) + Kiro & B-Capital と組む AI Tinkerers「Building Software Factories」VIP ディナー(4/29)** — DeepLearning.AI のフラッグシップ SF イベントが Pier 48 Mission Bay で Agentic AI / Context Engineering / Multimodal Apps / AI Governance / Coding-with-AI を網羅、AI Startup Track 含む。スタンフォード続編:Causal Science Frontiers in AI Evaluation(4/29) + CORES Symposium(5/5) + SaaStr Annual(5/12-14) + AI DevSummit(5/27-28)。
- **Okta for AI Agents が 4/30 GA — 3 日カウントダウン** — Agent Discovery & Governance(承認 + シャドウ エージェント);中央 MCP コントロール プレーンとしての Agent Gateway(Okta MCP レジストリを集約する仮想 MCP サーバー);認証情報のボールティング + 自動ローテーション;ユニバーサル ログアウトによるランタイム強制。**Salt Security 1H 2026 レポート**:組織の 48.9% が AI エージェントの machine-to-machine トラフィックをモニターできない。
- **DeepSeek V4-Pro / V4-Flash トラクション 4/25-27 継続 — Hugging Face V4-Pro ページ公開、Simon Willison「ほぼフロンティア、価格はわずか」がプラクティショナー読みをアンカー** — V4-Pro 1.6T MoE / 49B active;V4-Flash 284B / 13B active。Hybrid Attention で 1M コンテキストの計算量を V3.2 比 27%(Pro) / 10%(Flash) に削減。V4-Pro 価格 $1.74 / $3.48 per M tokens。Qwen3.6-27B が継続的にプラクティショナー・コンセンサスをアンカー(Q4_K_M ~16.8 GB VRAM、RTX 3090 で 40 tok/s);PrismML Bonsai-8B 1-bit が iPhone 17 Pro Max で 44 tok/s。
- **OpenClaw v2026.4.25-beta トレインが 4/27 まで継続 — voice-stack 強化、ブラウザ オートメーションのセーフタブ URL、CDP ネイティブ ロール スナップショット フォールバック、CLI イメージ生成 --background、Discord 音声モデル オーバーライド** — 24 時間以内のベータ サイクルが継続。Voice reply は chat スコープ自動 TTS コントロール + 6 つの TTS プロバイダ(Azure Speech / Xiaomi / Local CLI / Inworld / Volcengine / ElevenLabs v3)で「production 形」へ。

[news-20260427.md](report/ja/news-20260427.md)

### Predictions check

- **直近 1 週間(4/20-4/26)で 17 予測検証。Relevance 5 が 8 件、Relevance 3-4 が 5 件、Relevance 1-2 が 3 件。** 本日の 3 つの Future 予測(Mag 7 AI ROI リコニング + AI インフラ CVE クラスの規制プリミティブへの昇格 + 世論反発 → 自律エージェントの州法定アイデンティティ)は過去 1 週間予測の次ステップ拡張で、すべてが 4/28-30 ウィンドウに集約。
- **CI / エージェント経由のシークレット流出(4/20)** Relevance 5:**CVE-2026-6951 simple-git RCE** が基盤的 Node.js CI/CD 依存を直撃 — まさに「agent-in-the-loop シークレット流出」攻撃面カテゴリ。本日 Future #2 が「CISA / NIST が KEV から独立した推論サーバ + agentic-CI ランタイム向けサブカタログを Q4 2026 までに公開」+ OWASP LLM Top 10 v2026 が「Inference Server Template / Loader RCE」を Top-3 に昇格と成文化。
- **GGUF サプライチェーン(4/21)** Relevance 5:**SGLang CVE-2026-5760 が v0.5.10 でも未パッチ** — `ImmutableSandboxedEnvironment` 緩和策なし。CSO Online「コピペ脆弱性が Meta、Nvidia、Microsoft の AI 推論フレームワークを直撃」がベンダー横断的プリミティブを一般化。
- **OAuth トラスト + SSO AI 拡張スコープ(4/22)** Relevance 5:Okta GA まで T-3 日 + Operant ゼロトラスト MCP Gateway が Okta Integration Network 参加 + Salt Security 48.9% モニター不可能データ。Future #3 が Q3 2026 までに米国州の「自律エージェント法定アイデンティティ」法へと直接拡張。
- **Agent Control Plane(4/23)** Relevance 5:同日 Big-3 確認 — Okta Agent Gateway + Google Cloud agentic-defense(3 つの新エージェント + リモート MCP サーバ GA + Wiz 連携) + AWS Bedrock AgentCore(4 リージョン プレビュー / 14 リージョン CLI GA) + Hermes Agent v0.11.0 ネイティブ AWS Bedrock。
- **3 クラウド寡占キャパシティ・キャプチャ(4/25)** Relevance 5:Mag 7 ~$650B-$700B capex フレーミングと Future #1 のアンカー ディール明示的命名(Google $40B / Anthropic、Amazon $25B / Anthropic、OpenAI $20B / Cerebras + Microsoft)が「目に見える圧力リリーフ バルブ」としてアンカー。
- **MCP プロトコル攻撃面(4/25)** Relevance 5:同じニュースサイクルで脅威(SGLang/simple-git/Antigravity/Google IPI 32% YoY) + 防御(Okta Agent Gateway / Operant / Google リモート MCP)が急上昇。Future #2 が必須 SBOM タギング付きの CISA / NIST 推論サーバ + agentic-CI サブカタログを Q4 2026 までに成文化。
- **ハイパースケーラー対 AI ラボ資本連結スタック・ロックイン(4/26)** Relevance 5:Project Glasswing 12 ローンチ パートナー ロースターが Anthropic を AWS / Apple / Google / Microsoft / NVIDIA とアンカー;Mag 7 capex;Hermes-on-Bedrock がプラクティショナー証拠。
- **推論サーバ プリミティブ サプライチェーン LLM-INFRA-CWE(4/26)** Relevance 5:本日の Future #2 が 5 つの CVE バックドロップ(Totolink + simple-git + SGLang + LogonTracer + GeoVision)に対しより鋭い特異性で直接再記述 + CSO Online ベンダー横断フレーミング。
- **Relevance 4**:5 極ハイパースケーラー対フロンティア ラボ体制(4/21、Glasswing + Mag 7 フレーミング);27B Dense + 1M コンテキスト(4/23、Qwen3.6 公式 + Apidog ラウンドアップ);1M コンテキスト デフォルト オープン ウェイト(4/24、DeepSeek V4 + Qwen3.6 デュアルトラック)。
- **Relevance 3**:local-first cloud-overflow 反転(4/20);プロプライエタリ対オープン ウェイト分裂(4/21);Physical-AI-as-RaaS(4/22);Physical-AI-8h 生産(4/24);IROS / GTC での Physical-AI リーグ テーブル(4/25);サードパーティ ベンダー境界 + URL 命名エントロピー(4/23、Mythos コントラクター URL 推測サーガ復活);コンシューマー GPU コーディング エージェント ≥30%(4/26)。
- **Relevance 1-2**:Headless Everything(4/20)は 1 — Hermes Agent v0.11.0 の目玉 Ink TUI 書き換えが headless-metadata に対して OS レベル方向を強化;Training-vs-inference SKU 分裂(4/22)は 1 — MAIA / MTIA デュアルトラックなし(Cerebras IPO は隣接、テーゼ上ではない);AI エージェント置換 SaaS 資本市場リセット(4/24)は 2 — 本日の Mag 7 フレーミングは「AI ROI リコニング」であり予測した Workday / Atlassian / Box / Smartsheet 連鎖 15%+ 落下ではない;Motley Fool「Great Rotation Is Reversing」は逆ベクトルを論じる。
- ユーザー予測 1(悪性ローカル LLM → マルウェア):**強力な継続的補強**。SGLang CVE-2026-5760 が依然カノニカル例 — GGUF が `tokenizer.chat_template` の Jinja2 SSTI を運び推論サーバ内で発火、v0.5.10 は `ImmutableSandboxedEnvironment` なしで出荷。本日 Future #3 が規制レイヤーへ拡張:Okta の Agent Discovery + Agent Gateway パターンを反映した米国州の自律エージェント法定アイデンティティ法を Q3 2026 までに。
- ユーザー予測 2(クラウド対ローカル分化、SaaS 値上げ):**直接補強継続**。「AI ROI リコニング」としての Mag 7 capex フレーミングが予測したコスト プレッシャー ダイナミクスそのもの;ローカル側代替が深化(DeepSeek V4-Pro $1.74/$3.48、Qwen3.6-27B が RTX 3090、Bonsai-8B が iPhone 17 Pro Max)。Hermes Agent v0.11.0 がハイブリッド パターンのプラクティショナー結晶化:ネイティブ AWS Bedrock + Codex OAuth 経由 GPT-5.5 がローカル ランタイム セルフホストと並行。
- ユーザー予測 3(RL/LLM ベース予測):**本日直接ヒットなし**。最も近い近期イベントはスタンフォードの Causal Science Conference: Frontiers in AI Evaluation(4/29、12-6 PM PT、Simonyi Conference Center)、ただしプレビュー コンテンツなし。Carry-only。

[future-prediction-20260427.md](future-prediction/ja/future-prediction-20260427.md)

---

## 2026-04-26

### News

- **Google が Anthropic に最大 $40B コミット(Apr 24、Bloomberg)— 初期 $10B キャッシュを $350B バリュエーションで、加えて $30B マイルストーン連動 + 5 年で 5GW Google Cloud 容量** — Amazon の $25B + 5GW Trainium2/3 コミットの数日後。**フロンティアラボ 3 社(Anthropic / OpenAI / Thinking Machines Lab)すべてがハイパースケーラの引受人をキャップテーブルに持つ構造**へ — 一部はキャッシュではなく計算容量で支払い
- **DeepSeek V4 が 9.5x-13.7x 低メモリ + Huawei Ascend 共チューニングで投入、Apr 26 Bloomberg-CCTV 記事が国産チップへの軸足移行を確認** — V4-Pro(1.6T MoE / 49B active)と V4-Flash が **Hybrid Attention** で **V3.2 比 9.5x-13.7x のメモリ削減**、ネイティブ 1M トークンコンテキスト。Apr 26 Bloomberg が CCTV 系ソーシャルアカウントを引いて V4 タイムラインのシフトが **Huawei Ascend ハードウェア固有の最適化**に駆動されたと確認。V4-Pro 価格 $1.74 / $3.48 per M tokens — **Claude Opus 4.7 比 約 7x 安価** で GPT-5.4 / Opus 4.6 級品質
- **SGLang CVE-2026-5760(CVSS 9.8)— 悪意ある GGUF chat_template(Jinja2 SSTI)経由の RCE、公開 PoC + CERT/CC VU#915947** — `tokenizer.chat_template` に Jinja2 SSTI ペイロードを仕込んだ GGUF ファイル + Qwen3 reranker トリガーフレーズで `entrypoints/openai/serving_rerank.py` の脆弱パスが発火、SGLang が `jinja2.Environment()` でテンプレートをレンダ → 任意コード実行。**公開 PoC が `github.com/Stuub/SGLang-0.5.9-RCE`**、CERT/CC VU#915947 発行、推奨 fix は `ImmutableSandboxedEnvironment`。AI 推論サーバが **LMDeploy SSRF に続く 2 つ目の武器化された AI-infra プリミティブ**として確定
- **Qwen3.6-27B(Apr 22、トラクション Apr 23-26)— Apache 2.0 dense 27B が 397B-A17B MoE をコーディングで上回る** — SWE-bench Verified **77.2% vs 76.2%**、Terminal-Bench 2.0 59.3 で Claude Opus 4.5 と肩を並べる、**RTX 3090 Q4_K_M ~16.8 GB VRAM で 40 tok/s**、262K context(1M まで拡張可能)、新しい **Thinking Preservation** メカニズム。「シングル GPU コーディングエージェント」の新しいベースラインを設定
- **Microsoft ASP.NET Core CVE-2026-40372(CVSS 9.1)— DataProtection 10.0.0-10.0.6 の SYSTEM 権限 cookie 偽造欠陥に out-of-band 緊急パッチ** — `ManagedAuthenticatedEncryptor` が HMAC 検証タグを誤ったオフセットで計算、全ゼロ HMAC タグの ciphertext が誤って valid と受理される。**認証 cookie 偽造、antiforgery トークン操作、保護ペイロード復号** — SYSTEM までのなりすましが可能。`Microsoft.AspNetCore.DataProtection 10.0.7` で修正。**DataProtection キーリングの回転 + 脆弱期間中に発行された長寿命トークンの監査**が必要
- **OpenClaw v2026.4.25-beta トレイン(Apr 26、beta.3-7+)— voice reply / TTS アップグレード、6 つの新 TTS プロバイダ** — Azure Speech / Xiaomi / Local CLI / Inworld / Volcengine / ElevenLabs v3。**beta.3(Apr 26 13:00)→ beta.4(Apr 26 13:24)→ beta.7+ が単一の午後にリリース** — 連続的な voice-stack 強化下でリリーステンポは sub-24h。Voice reply が「利用可能」から「production 形」へ
- **Pillar Security: Antigravity の `find_by_name -X` exec-batch フラグ経由のプロンプトインジェクション sandbox エスケープ(Google パッチ済み、bug bounty 支払い済み)** — `find_by_name` の Pattern パラメータが `fd` に `-X` を挿入、Antigravity の Secure Mode 下でも RCE を達成。**3 つ目の agentic-IDE ベンダがコメントスタイルプロンプトインジェクションクラスに脆弱と確認**
- **Apr 23 Claude Code リグレッションについての Anthropic エンジニアリングポストモーテム — March 4 reasoning カット + April 16 verbosity-prompt 問題、Apr 20 v2.1.116 で修正** — Anthropic 公式ポストモーテムが anthropic.com/engineering/april-23-postmortem に掲載、Claude Code + Agent SDK + Cowork 全体で **2 つの異なる週単位品質リグレッション**を整理 — ユーザを「自分のせいか」と思わせていた
- **Claude Code v2.1.119 / v2.1.120 24 時間リグレッションクラスタ(Apr 24-25)** — **24 時間で 8 リグレッション**: 撤回級の自動更新破壊、サイレントモデルスワップ、resume 時クラッシュ x2、UI 重複バグ、WSL2 限定 `/mcp` フリーズ、CLAUDE.md 無視リグレッション、`sandbox.excludedCommands` 約束破壊、macOS worktree ハング。サバイバルチェックリストは v2.1.117 ロールバックを推奨
- **野生のインダイレクトプロンプトインジェクション — Google Online Security Blog + Help Net Security Apr 24、Nov 2025-Feb 2026 で 32% YoY 上昇** — Google 一次調査がオープンウェブをクロールして **悪意あるプロンプトインジェクションコンテンツの 32% 増加** を定量化、**確認済み 10 件の野生 IPI 攻撃** を文書化 — 脅威が「GitHub コメント」から **「オープンウェブ」** へ一般化
- **Ollama MLX バックエンド Apr 23 ディープダイブ(gingter.org)— Foundry Local は Metal 限定のまま、MLX ギャップ拡大** — Ollama on M5 Max で **Qwen3.5-35B-A3B + NVFP4 にて prefill 1.57x / decode 1.93x**;Foundry Local の MLX サポートは未解決の issue(`microsoft/Foundry-Local#329`)のまま
- **llama.cpp ビルド b8936 + b8937 が Apr 26 の 1 時間以内(08:54 + 09:28 UTC)に着地** — 日曜日の 1 時間以内に 2 ビルド — 「ノーウィンドウリリース」パターンが破られた
- **NVIDIA $5T 時価総額再奪取 + AMD +13.9% + Nasdaq / S&P 500 史上最高値(Apr 24、carry-forward)** — Intel Q1 2026 ビート(EPS $0.29 vs $0.01、売上 $13.6B +7% YoY、Apr 24 引け +24% — 1987 年以降最大の単日上昇)が触媒として確定、iShares Semiconductor ETF が Apr 24 までに MTD +40.4%

[news-20260426.md](report/ja/news-20260426.md)

### Predictions check

- **直近 1 週間(4/19-4/25)で 17 予測検証。Relevance 5 が 8 件、Relevance 4 が 4 件、Relevance 1-2 が 5 件**
- **インダイレクトプロンプトインジェクションが CVE 主カテゴリ化(4/19)** Relevance 5:**SGLang CVE-2026-5760 + Pillar Antigravity + Google IPI 32% YoY** で三重確認
- **ローカル優先のクラウドオーバーフロー逆転(4/20)** Relevance 5:本日の Future #3 で明示的に **「Q3 2026 までにコンシューマ GPU コーディングエージェントが cloud-only コーディング API を 30% 以上の dev ワークロードで置き換え」** と成文化。Qwen3.6-27B + Ollama MLX + DeepSeek V4-Pro の 3 角絞り
- **GGUF サプライチェーン予測(4/21)** Relevance 5:**SGLang chat_template SSTI に対する PoC + CERT/CC VU#915947** で決定的に着地 — llama-cpp-python の CVE-2024-34359("Llama Drama")と同じ脆弱性クラス
- **ハイパースケーラ × フロンティアラボ 5 極体制(4/21)** Relevance 5:**Google × Anthropic $40B / 5GW ディール** がトリオを完成(Amazon $25B + Microsoft $13B+ + Google $40B)で Big-3 確認。本日 Future #1 が Q3 2026 までに **エンタープライズマルチクラウド LLM 戦略が「マルチランタイム」から「マルチフロンティアベンダ」へシフト**と予測
- **プロプライエタリ vs オープン重み分断(4/21)** Relevance 5:**GPT-5.5 API +2x** vs **DeepSeek V4-Pro 約 7x 安価** が同一窓で着地して鋭利化、Apr 26 Bloomberg-via-CCTV 記事が DeepSeek V4 と Huawei Ascend を公式整合
- **Agent Registry / OAuth 横断信任 / Agent Control Plane(4/19, 4/22, 4/23)** Relevance 5:すべてが **Okta の Showcase 2026 ブループリント(中央 MCP コントロールプレーンとしての Agent Gateway)**、Cross App Access プロトコル、TrueFoundry の MCP Security / Zero Trust ガイドに収束
- **27B Dense + 1M context 標準化(4/23)** Relevance 5:**Qwen3.6-27B が 397B-A17B MoE を SWE-bench Verified でコンシューマ GPU 価格帯で上回る**(RTX 3090 Q4_K_M ~16.8 GB で 40 tok/s)で決定的に着地
- **3 クラウドオリゴポリ説(4/25)** Relevance 5 — 本日のキーストーン検証。Anthropic 年率換算売上が **$30B 超**(2025 年末 ~$9B から)
- **Relevance 4**:CI / エージェント経由のシークレット流出(4/20、Pillar の 3 つ目の agentic-IDE RCE);Physical-AI-as-RaaS(4/22、BMW Leipzig + Tesla Earth Day + Hannover Messe);1M context 既定オープン重み(4/24、DeepSeek V4 + Qwen3.6-27B);MCP プロトコル攻撃面(4/25、同窓で脅威 + 防御)
- **Relevance 1-2**:1-bit ネイティブ訓練(4/19)、Headless Everything(4/20)、訓練 vs 推論 SKU 分離(4/22)に本日直接進展なし。サードパーティベンダ境界(4/23)と SaaS 置換バリュエーションリセット(4/24)は弱信号のみ — 本日の市場アクションは予測されていた Workday / Atlassian / Box / Smartsheet 15%+ 連鎖落ではなくハードウェアラリー駆動(NVIDIA $5T 再奪取 / AMD +13.9% / Intel +24%)
- ユーザー予測1(悪性ローカル LLM のマルウェア化):**強い裏付け**。SGLang CVE-2026-5760 がまさに失敗モード — モデルファイル(GGUF)が実行可能コード(`tokenizer.chat_template` の Jinja2 SSTI)を運び、推論サーバ内で発火、公開 PoC + CERT/CC VU#915947 で武器化。Okta の中央 MCP コントロールプレーンとしての Agent Gateway + TrueFoundry の "MCP Security: Guide to Zero Trust for Agentic AI" が **「AI 単独でアクセス不可なシステムパスを意図的に設計する」** アーキテクチャを実商品カテゴリとして定式化
- ユーザー予測2(クラウド vs ローカル分化、SaaS 値上げ):**直接成文化された確認**。本日の Future #3 が明示的に **「Q3 2026 までにコンシューマ GPU コーディングエージェントが cloud-only コーディング API を 30% 以上の dev ワークロードで置き換え」**。GPT-5.5 API $5 / $30(2x 値上げ、Codex で出力トークン 約 40% 削減で「per-token 値上げを per-task コストで相殺」)が DeepSeek V4-Pro 約 7x 安価と同一週に着地
- ユーザー予測3(RL/LLM による予測改善):本日直接事例なし。最も近い隣接は Anthropic エンジニアリングポストモーテム(品質リグレッション分析、予測改善ピースではない)。Carry-only

[future-prediction-20260426.md](future-prediction/ja/future-prediction-20260426.md)

---

## 2026-04-25

### News

- **NVIDIA、Apr 24 終値で時価総額 $5.12 兆を再達成** — Intel の Apr 23 引け後決算大幅ビートを起点にチップセクタ全面高、NVIDIA は $208.27(+4.3%)で過去最高値引け、Alphabet との時価総額差は $1 兆超に拡大。AMD は同日 **+13.90%($347.77)** で続伸(決算 5/5)、Nasdaq Composite **+1.63% / 24,836.60**、S&P 500 **+0.80% / 7,165.08** の最高値引け
- **Tesla、Apr 25 を Earth Day マーケティングデーに、Optimus V3「Plant Cube」を限定配布** — 米国直営店で FSD (Supervised) デモドライブ参加者に Optimus が植えた Plant Cube 配布。Apr 23 決算で **V3 mid-2026 デビュー / 7-8 月量産** 再確認、2026 capex $25B 超ガイダンス、Fremont 年産 100 万体 / Giga Texas 第 2 工場 1,000 万体規模
- **Google Cloud × Thinking Machines Lab、複数億ドル規模 GB300 契約(Apr 22 発表)** — Mira Murati の TML が NVIDIA **GB300** 搭載 Google Cloud **A4X Max** VM を採用、訓練 / サービング速度前世代比 **2x**。Anthropic / Meta に続く Google Cloud 3 件目のフロンティアラボ契約
- **BMW Group、Apr 2026 から Leipzig 工場で AEON ヒューマノイド本格テスト + Physical AI Center of Competence 設立** — Spartanburg の **Figure 02 が 10 ヶ月で 30,000 台 / 9 万部品 / 1.2M ステップ / 1,250 時間稼働**、欧州初の Physical AI 拠点を Leipzig に開設。Hexagon Robotics 製 **AEON**(22 センサ / 自己交換バッテリ / 4 層 Physical AI / 20 デモで自律動作習得)を Apr 2026 から導入し夏のパイロット本番へ
- **Hannover Messe 2026(Apr 20-24)閉幕、Physical AI が初の中心テーマ** — 130,000 来場者 / 4,000 出展者 / 1,600 講演者、AEON / HMND 01 / Apptronik Apollo / Agility Digit 並列展示
- **OpenAI GPT-5.5 / GPT-5.5 Pro API 公開(Apr 24)** — 入力 $5.00 / 出力 $30.00 per M tokens(GPT-5.4 比 **2x**)、Pro $30 / $180、Codex は出力トークン 40% 削減で per-task コストを相殺
- **DeepSeek V4 Pro ベンチ詳報** — IMOAnswerBench **89.8**(Claude Opus 4.7 75.3 / Gemini 3.1-Pro 81.0 上回り、GPT-5.4 91.4 に肉薄)、agentic で Sonnet 4.5 を上回り Opus 4.5 級。価格 **$1.74 / $3.48 per M tokens(Opus 4.7 の 1/7)**、Apache 2.0、Huawei Ascend 緊密統合
- **Claude Code v2.1.117(Apr 25)** — `/resume` がストール / 大型セッションを reload 前に auto-summarize、コンテキスト溢れ防止
- **OpenClaw v2026.4.23(Apr 24)** — Providers/OpenAI に Codex OAuth 経由の image gen + reference image editing 追加
- **AWS Bedrock AgentCore Browser、OS レベル インタラクション拡張(Apr 22)** — ファイルアップロード / OS ダイアログ操作 / マルチウィンドウ切替
- **Salesforce Q4: Agentforce ARR $800M / 29,000 deals (+50% QoQ)** — FY2026 売上 $41.5B、Q4 EPS $3.81 / 売上 $11.20B(+12.1% YoY)
- **Nginx UI CVE-2026-33032(MCPwn、CVSS 9.8)実環境悪用** — `/mcp_message` エンドポイントの IP allowlist が空既定で auth ミドルウェアを bypass、MCP ツール 12 個が無認証で晒される、2 HTTP リクエストで Nginx 完全乗っ取り
- **Saltcorn CVE-2026-41478(CVSS 9.9)公開(Apr 24)** — Mobile-Sync SQL injection
- **Amazon × Anthropic 追加 $25B + 5GW Trainium2/3 容量(Apr 20 詳細確定)** — $5B 即時 + $20B マイルストーン連動
- **AI Tinkerers SF + AI Dev 26 x SF + Sage Future 連続(Apr 28-30)**

[news-20260425.md](report/ja/news-20260425.md)

### Predictions check

- 17 予測を 1 週間で検証。**Relevance 5** 連続検証 6 軸:**Agent Control Plane / OAuth 信任 / Physical AI SaaS 化 / 1M context オープン重み標準 / ハイパースケーラ × フロンティアラボ独占同盟 / プロプライエタリ × オープン分裂**
- **プロプライエタリ × オープン分裂(4/21-3)** Relevance 5:GPT-5.5 API 2x 値上げ × DeepSeek V4 Pro 7x 価格破壊が **同日リリース**で決着。Apus 4.5 級が Apache 2.0 オープン重みでローカル動作する構造
- **ハイパースケーラ × フロンティアラボ独占同盟(4/21-2)** Relevance 5:Google × Thinking Machines Lab GB300 契約で 3 社目を確定、Amazon × Anthropic $25B + 5GW Trainium 容量 + 10 年 $100B 詳細確定、Vera Rubin 7 chip 量産で「訓練 = 3 クラウドオリゴポリ / 推論 = レイヤード」2 層構造ロックイン
- **Physical AI SaaS / RaaS 化(4/22-2)** Relevance 5:BMW Leipzig AEON Apr 2026 トライアル + Spartanburg Figure 02 10 ヶ月 30,000 台 + Hannover Messe 2026 Physical AI 初の中心テーマ + Tesla Optimus Earth Day Plant Cube 配布同期 — RaaS / フリート管理 SaaS への構造転換が可視化
- **Physical AI 8h 連続稼働 = 調達要件(4/24-2)** Relevance 5:BMW Spartanburg Figure 02 1,250 時間稼働確定、IROS 10 月 / GTC 秋 2026 で「OEM 採用数 × 連続稼働 × MTBF」リーグテーブル化が視野
- **Agent Control Plane(4/23-1)** Relevance 5:Okta for AI Agents Apr 30 GA カウントダウン + AWS Bedrock AgentCore Browser OS レベル + Managed Harness CLI / Skills + Salesforce Agentforce ARR $800M / 29,000 deals (+50% QoQ) — 課金エンジン本格起動
- **OAuth 信任(4/22-3)** Relevance 5:Okta for AI Agents プレ GA「同社最重要プロダクト」、Microsoft Copilot Studio CVE-2026-21520 で Capsule Security が「パッチだけでは間接プロンプトインジェクションを塞げない」と断言 — エンタープライズ MCP / agent 接続点監査が必須化
- **1M context 既定(4/24-1)** Relevance 5:DeepSeek V4 Pro Hybrid Attention で長コンテキスト推論コストを V3.2 比 27% に / KV cache 10% 圧縮、Apache 2.0 で「1M トークン争奪戦」再点火
- **Agent Registry(4/19-2)** Relevance 5:Okta for AI Agents の Agent Gateway / MCP virtual server / Okta MCP registry + AWS Bedrock AgentCore Managed Harness + CLI + Skills(Kiro Power 即時 / Claude Code、Codex、Cursor 来週)— 配給層構築進行
- **Relevance 1-2**:Headless Everything(4/20-3、Relevance 1)— AgentCore Browser OS レベル拡張で逆方向。1bit ネイティブ学習(4/19-1、Relevance 1)— 新 Qwen / Llama 派生なし。SKU 分裂(4/22-1、Relevance 2) と CI Secret leak OWASP 昇格(4/20-2、Relevance 2)— 直接進展なし
- ユーザー予測 1(悪性ローカル LLM → マルウェア):**Nginx UI CVE-2026-33032(MCPwn)** が MCP プロトコル統合層自体の構造欠陥をマルウェア経路化。本日 Future #3 が「OWASP MCP Top 10 公式公開 / MCP-over-mTLS 業界標準化 / Keycard / Okta / Wiz / Levo.ai / Pillar Security による MCP Gateway / Firewall 製品 Q4 ローンチ」と予測 — 強い裏付け
- ユーザー予測 2(クラウド vs ローカル、SaaS 値上げ):**同日 GPT-5.5 API 2x × DeepSeek V4 Pro 7x 価格破壊**で **週内最も精度高い予測**。「価格体系変更が先行」決着、「役割分担」が Apus 4.5 級が Apache 2.0 でローカル動作で進行
- ユーザー予測 3(RL/LLM 予測改善の波及):本日直接事例なし。隣接信号:Claude Code v2.1.117 `/resume` 自動要約 + DeepSeek V4 Hybrid Attention + GPT-5.5 Codex 出力 40% 削減

[future-prediction-20260425.md](future-prediction/ja/future-prediction-20260425.md)

---
