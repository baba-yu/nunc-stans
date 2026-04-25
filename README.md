# news

- [News Explorer (GitHub Pages)](https://baba-yu.github.io/news/) — 未来予測ダッシュボード
- `report/` — 日次ニュースレポート
- `future-prediction/` — 今日のニュースと昨日までの日次ニュースFuture欄の答え合わせ

---

## 2026-04-25

### ニュース

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

[news-20260425.md](report/news-20260425.md)

### 答え合わせ

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

[future-prediction-20260425.md](future-prediction/future-prediction-20260425.md)

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
