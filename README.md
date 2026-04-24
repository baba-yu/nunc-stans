# news

- [News Explorer (GitHub Pages)](https://baba-yu.github.io/news/) — 注目コンテンツの探索ダッシュボード
- `report/` — 日次ニュースレポート
- `future-prediction/` — 今日のニュースと昨日までの日次ニュースFuture欄の答え合わせ

---

## 2026-04-24

### ニュース

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

[news-20260424.md](report/news-20260424.md)

### 答え合わせ

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
- ユーザー予測3（電力/計算資源逼迫で AI SaaS 値上げ）：**最強相関** — GPT-5.5 API 価格 2x、Alphabet 2026 capex $175-185B（2025 の 2x）、Tesla capex $25B 超、ServiceNow 等 Legacy SaaS 連鎖下落、+ エージェントセキュリティ層（Keycard $38M / Okta Showcase / Zenity Fortune Cyber 60）で新規 SaaS 請求ライン追加の二極構造

[future-prediction-20260424.md](future-prediction/future-prediction-20260424.md)

---

## 2026-04-23

### ニュース

- Google Cloud Next '26 で **Gemini Enterprise Agent Platform** 発表（Vertex AI を改称統合、Model Garden に Claude 含む 200+ モデル、Agent Designer / Inbox / Skills、Workspace Studio no-code agent builder、Project Mariner web agent、A2A 本番版、マネージド MCP サーバ、**$750M パートナー基金**）
- **Tesla Optimus V3** 中期お披露目 + Fremont 7月末〜8月生産確定（37 関節、歩行 1.2m/s、Model S/X ライン転用、Giga Texas 第2工場 2027 夏稼働、年産 100 万台→最終 10M 台計画）、2026 capex $25B 超、Roadster / 無監督 FSD は後倒し
- **Qwen3.6-27B（Apache 2.0）公開** — 27B Dense、Gated DeltaNet + self-attention ハイブリッド、262K→1M context、Thinking Preservation、**SWE-bench Verified 77.2%** で MoE 397B を超え Claude Opus 4.5/4.6 同等。RTX 4090 1 枚で GGUF Q4_K_M 動作
- **OpenAI Workspace Agents** — Codex 駆動、ChatGPT Business / Enterprise / Edu / Teachers に研究プレビュー、ファイル / コード / Slack / Salesforce 横断、May 6 まで無料→以降クレジット課金
- **Anthropic Claude Mythos Preview 未認可アクセス事案** — 第三者ベンダ環境に外注クレデンシャル + Mercor 流出データ + 命名規則推測で Private Discord グループが到達。Anthropic 内部システムは無傷と発表
- **AWS Bedrock AgentCore 新機能** — Managed Harness（preview）+ AgentCore CLI + Kiro / Claude Code / Codex / Cursor 向けプリビルド skills
- **Anthropic 年率売上 $30B 超**（OpenAI $25B 上回る）+ Google / Broadcom 経由で 2027 開始の複数 GW 級 TPU 追加契約
- **NVIDIA Vera Rubin プラットフォーム 7 チップ量産入り**（Vera CPU / Rubin GPU / NVLink 6 Switch / ConnectX-9 / BlueField-4 / Spectrum-6 / Groq 3 LPU）、2026 後半から AWS / Google Cloud / Azure / OCI / CoreWeave / Lambda / Nebius / Nscale が順次提供
- IBM Q1 2026：売上 $15.92B（+9% YoY）、**z17 メインフレーム +51%**、株価は Red Hat / Confluent 依存懸念で下落
- ServiceNow Q1 2026：サブスク売上 $3,671M（+22%）、**AI コミット 2026 $1.5B（50% 上方修正）**、中東遅延で株価 -12%
- 重大 CVE 多数公開：Xerte 9.8 / Esri 9.8 / Web App PrivEsc 9.6 / Nimiq 9.6 / Jellystat 9.1 / OAuth2 Proxy 9.1 / EspoCRM 9.1、Microsoft Defender CVE-2026-33825 が CISA KEV 追加
- Hannover Messe 2026 で Agile Robots「ブルーアイ」工具箱詰め実演、Accenture + Vodafone + SAP のヒューマノイド倉庫業務パイロット公開

[news-20260423.md](report/news-20260423.md)

### 答え合わせ

- 過去4日（4/19〜4/22）の Future セクション 12 予測のうち Relevance 5 が 4件 / 4 が 2件 / 3 が 3件 / 2 が 3件
- Relevance 5：Agent Registry（Google Gemini Enterprise Agent Platform / AWS Bedrock AgentCore Managed Harness / OpenAI Workspace Agents の 3 社並列発表）、ローカル>クラウド逆転（Qwen3.6-27B Dense で SWE-bench 77.2%、RTX 4090 1 枚）、ハイパースケーラ排他同盟（Anthropic + Google/Broadcom 2027 追加契約 + Vera Rubin 7 チップ量産）、Physical AI SaaS 化（Hannover Messe + Accenture パイロット + Tesla Optimus 生産確定 + Woven City）
- Relevance 4：CI/エージェント Secret 流出（Mythos 未認可アクセス + OAuth2 Proxy CVE-2026-40575）、OAuth 横断信任（Mythos + Google AI Control Center）
- Relevance 2：1-bit ネイティブ学習は Qwen3.6-27B Dense BF16/FP8 で**側面突破**（1-bit ではなく Dense 長 context で側面突破）、Headless Everything は Project Mariner / Workspace Studio / Slack・Salesforce 直接統合で**逆方向**、GGUF 署名検証の標準化アナウンスは本日分未確認
- ユーザー予測1（悪性ローカルLLMのマルウェア化）：Mythos「危険モデル×アクセス制御破綻」で準備段階が完成、直接事例は薄い
- ユーザー予測2（RL/LLM による予測改善の普及）：OpenAI Workspace Agents + Microsoft Foundry RFT グローバル展開 + Google Agent Designer で供給側プラットフォームが 3 社並列整備

[future-prediction-20260423.md](future-prediction/future-prediction-20260423.md)

---

## 2026-04-22

### ニュース

- Google Cloud Next '26 で第8世代 TPU を訓練 / 推論 2SKU 分割発表（**TPU 8t** 訓練・前世代比 3x 演算 / **TPU 8i** 推論・$ あたり 80% 性能向上、FP4 ネイティブ）。1 superpod = 9,600 チップ / 121 exaflops / 2PB 共有メモリ、$750M 企業 AI 導入基金
- Tesla Q1 2026 決算で EPS $0.41 / 売上 $22.38B / gross margin 21.1%、**Optimus 第1世代工場 Q2 準備開始・年産 100 万台計画**、Fremont の Model S/X ライン転用
- OpenClaw CVE-2026-41329（CVSS 9.9、サンドボックス回避→権限昇格）公開
- Vercel が Context.ai 経由のサプライチェーン侵害を確認、OAuth トークン侵害→内部環境横展開→BreachForums で $2M 出品
- Neura Robotics × AWS が Physical AI 戦略提携、Amazon FC 展開可能性検討
- DEEPX × Hyundai Motor Group Robotics LAB が次世代 Physical AI コンピュート提携
- Anthropic 売上 $30B 超で OpenAI $25B を上回り、自社 AI チップ開発を模索

[news-20260422.md](report/news-20260422.md)

### 答え合わせ

- 過去3日（4/19〜4/21）の Future セクション 9 予測のうち Relevance 5 が 4件 / 4 が 2件 / 3 が 2件 / 2 が 1件
- Relevance 5：間接プロンプトインジェクションの主CVE化、ローカル>クラウド逆転、CI・エージェント Secret 流出、ハイパースケーラ排他同盟
- 間接プロンプトインジェクション系は OpenClaw CVE-2026-41329 に加え **Google Antigravity の find_by_name ツール経由 RCE** が本日分で加わり、LLM エージェントランタイム横断の脆弱性クラスタを形成
- ハイパースケーラ排他同盟は **TPU 8t/8i の訓練・推論 2SKU 分離**と **Anthropic の自社 AI チップ検討報道**が並列で出て、Trainium / TPU / MAIA / MI300X の分化が「5極体制固定化」予測の筋書きを強化
- 「Headless Everything」は Codex の GUI 拡張・ChatGPT Images 2.0 の UI 多重化で逆方向、Relevance 2
- ユーザー予測「悪性ローカルLLMのマルウェア化」は SGLang CVE-2026-5760 が定義的初例
- ユーザー予測「RL/LLM による予測改善の普及」は ml-intern の GRPO 相当最適化が直接型

[future-prediction-20260422.md](future-prediction/future-prediction-20260422.md)
