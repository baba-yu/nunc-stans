# research

リサーチ・調査系の成果物をまとめるリポジトリ。

- `report/` — 日次ニュースレポート
- `future-prediction/` — 未来予測・予測検証レポート

---

## 2026-04-22

### ニュース

ChatGPT Images 2.0（gpt-image-2）公開でネイティブ推論・2K解像度・1プロンプト8枚一貫生成へ。Codex が computer use / web workflows / image gen / memory / automations / SSH devboxes へ拡張。OpenClaw CVE-2026-41329（CVSS 9.9、サンドボックス回避→権限昇格）公開。Vercel が Context.ai 経由のサプライチェーン侵害を確認、OAuth トークン侵害→内部環境横展開→BreachForums で $2M 出品。CISA KEV に Cisco Catalyst SD-WAN Manager 3件含む 8件追加。Anthropic が Claude Code の Pro 除外 A/B テストを開始→即日撤回。Hugging Face ml-intern が Qwen3-1.7B の GPQA を 10h 未満で 8.5%→32%（Claude Code 22.99% 超え）。Amazon–Anthropic $25B の後続報道で 100,000+ 組織が Bedrock で Claude 利用、Q2 2026 から 5GW 稼働。

[news-20260422.md](report/news-20260422.md)

### 答え合わせ

過去3日（4/19〜4/21）の Future セクション 9 予測のうち、Relevance 4以上が 6件、3が 2件、2が 1件。「間接プロンプトインジェクションの主CVEカテゴリ化」「ローカル>クラウド逆転」「CI/エージェント Secret 流出」「ハイパースケーラ排他同盟」の 4件は 1〜3日で新規具体事例（CVE・侵害・投資・ベンチ超え）が出揃い実態追認フェーズへ。「Headless Everything」は Codex の GUI 方向拡張と ChatGPT Images 2.0 の UI 多重化で逆方向の動きが強く Relevance 2。ユーザー予測「悪性ローカルLLMのマルウェア化」は SGLang CVE-2026-5760 が定義的初例、「RL/LLM による予測改善の普及」は ml-intern の GRPO 相当最適化が直接型。

[future-prediction-20260422.md](future-prediction/future-prediction-20260422.md)

---

## 2026-04-21

### ニュース

Amazon が Anthropic に追加 $25B 投資発表（即時 $5B + マイルストーン $20B）、Anthropic は 10年で $100B 超を AWS 支出、Trainium2/3 で 5GW 計算資源。Qwen3.6-Max-Preview（プロプライエタリ）公開、SWE-bench Pro / SkillsBench / SciCode 等でトップスコア、260K コンテキスト + preserve_thinking。SGLang CVE-2026-5760（CVSS 9.8、GGUF 経由 Jinja2 SSTI で RCE）の広報拡大。CISA KEV に 8件追加、連邦機関は Apr 23 期限。Simon Willison が Claude 系 system prompt の git タイムライン化で Opus 4.6→4.7 差分公開（Knowledge Cutoff が 2026-01 更新、`developer platform`→`Claude Platform` 改称）。

[news-20260421.md](report/news-20260421.md)

### 答え合わせ

該当日の future-prediction ファイルなし。

---

## 2026-04-20

### ニュース

Qwen3.6-35B-A3B がノートPCローカル推論で Claude Opus 4.7 を上回る評価継続、Ollama / llama.cpp 双方で Day-1 サポート。Bonsai 1-bit LLM 実装波及、Bonsai-1.7B が RTX 4090 CUDA で 674 tok/s（FP16 比3倍）、実装チュートリアル・量子化デプロイ記事連続公開。llama.cpp b8838（Apr 18）、OpenClaw 2026.4.14 の追従レビュー継続、Claude Opus 4.7 既定化・Gemini TTS・LanceDB メモリ投入。GitHub Actions 経由の間接プロンプトインジェクションで Claude Code Security Review / Gemini CLI Action / Copilot Agent の 3製品横断 Secret 窃取 PoC 成立、各社 CVE なしで静的パッチ。Patch Tuesday 余波で Fortinet FortiClient EMS CVE-2026-35616 が実戦悪用報告。

[news-20260420.md](report/news-20260420.md)

### 答え合わせ

該当日の future-prediction ファイルなし。
