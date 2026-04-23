# news

- `report/` — 日次ニュースレポート
- `future-prediction/` — 今日のニュースと昨日までの日次ニュースFuture欄の答え合わせ

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

---

## 2026-04-21

### ニュース

- Amazon が Anthropic に追加 $25B 投資発表（即時 $5B + マイルストーン $20B）、Anthropic は 10年で $100B 超を AWS 支出、Trainium2/3 で 5GW 計算資源
- Qwen3.6-Max-Preview（プロプライエタリ）公開、SWE-bench Pro / SkillsBench / SciCode 等でトップスコア、260K コンテキスト + preserve_thinking
- SGLang CVE-2026-5760（CVSS 9.8、GGUF 経由 Jinja2 SSTI で RCE）の広報拡大
- CISA KEV に 8件追加、連邦機関は Apr 23 期限
- Simon Willison が Claude 系 system prompt の git タイムライン化で Opus 4.6→4.7 差分公開（Knowledge Cutoff が 2026-01 更新、`developer platform`→`Claude Platform` 改称）

[news-20260421.md](report/news-20260421.md)

### 答え合わせ

- 該当日の future-prediction ファイルなし

---

## 2026-04-20

### ニュース

- Qwen3.6-35B-A3B がノートPCローカル推論で Claude Opus 4.7 を上回る評価継続、Ollama / llama.cpp 双方で Day-1 サポート
- Bonsai 1-bit LLM 実装波及、Bonsai-1.7B が RTX 4090 CUDA で 674 tok/s（FP16 比3倍）、実装チュートリアル・量子化デプロイ記事連続公開
- llama.cpp b8838（Apr 18）公開、OpenClaw 2026.4.14 の追従レビュー継続（Claude Opus 4.7 既定化・Gemini TTS・LanceDB メモリ投入）
- GitHub Actions 経由の間接プロンプトインジェクションで Claude Code Security Review / Gemini CLI Action / Copilot Agent の 3製品横断 Secret 窃取 PoC 成立、各社 CVE なしで静的パッチ
- Patch Tuesday 余波で Fortinet FortiClient EMS CVE-2026-35616 が実戦悪用報告

[news-20260420.md](report/news-20260420.md)

### 答え合わせ

- 該当日の future-prediction ファイルなし
