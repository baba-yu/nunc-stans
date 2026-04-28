# news

*Available in: [English](README.md) | [Español](README.es.md) | [Filipino](README.fil.md)*

<!-- ai-notice -->
> **ご注意:** 本ページの記事および要約は、Anthropic 社の生成AI「Claude」によって作成されています。


- [News Explorer (GitHub Pages)](https://baba-yu.github.io/news/) — 未来予測ダッシュボード
- `report/` — 日次ニュースレポート
- `future-prediction/` — 今日のニュースと昨日までの日次ニュースFuture欄の答え合わせ

---

## 2026-04-28

### News

- **OpenAI–Microsoft が4月27日に提携を再構築 — AGI条項撤廃、Microsoftライセンスは2032年まで非独占に、収益シェアは2030年で打ち止め、OpenAIは全クラウドで販売可能に(AWS $38Bは契約済)** — 10年来の「AGI条項」(OpenAI取締役会がAGIを宣言した時点でMicrosoftのIP権利が無効化される条項)が消滅。収益シェア支払いはAGI宣言の有無にかかわらず2030年で停止。Microsoftの約$135B / 27%の経済的持分は維持されるが、独占性は消失 — OpenAIはAWS / Oracle / Googleで全製品ラインを展開可能。AWS契約は7年で$38B、$50Bの上振れ余地あり。**ハイパースケーラーとAIラボの資本連動仮説の直接的な触媒**として、Mag 7決算前の地合いを支配。
- **Mag 7 スーパーウィーク(4/28-30)+ FOMC(4/28-29、Powell議長最後の会合)が同48時間に圧縮 — Microsoft / Alphabet / Amazon / Meta が4/29、Apple は4/30、2026年合計AI設備投資 約$700B、政策金利は3.50-3.75%で据え置き(コンセンサス100%)** — Microsoft EPS $4.04 / 売上$81.4B / Azure +38%予想; Alphabet EPS $2.64 / 売上$92.2B / FY26設備投資$175B-$185B再確認の見通し; Meta EPS $7.51 / 売上$55.5B(+31%YoY); Amazon AWSは$200B AI計画。NVDAは4/27に+4%で52週高値更新; AMDは5/5決算前の4/24に史上最高値$352.99。WTIは+2.09%で$96.37、ブレントは+2.75%で$108.23、ホルムズ海峡情勢が要因。イランは海峡再開に向け米国へ新提案を提示。**Powell任期は5/15まで** — Warsh氏は4/21に上院銀行委員会公聴会。
- **AWS × Anthropic、4/27にTrainium / Graviton シリコンレベルへ深化 + Claude Cowork が Bedrock に着地; AWS × Meta は Graviton 大規模展開契約; AgentCore CLI が14リージョンで GA、マネージドハーネスは4リージョンでプレビュー** — Anthropicは最先端基盤モデルを**AWS Trainium + Graviton**上で訓練、Annapurna Labsとシリコンレベルで共同設計、$5B-$33B / $100B 10年コミットを背景に。**Claude Cowork が Bedrock 内で稼働**(データはAWS内に常駐); 「Claude Platform on AWS」統合開発体験が後続。**Metaは数千万コアのGraviton**をエージェント型AIのCPU集約ワークロードに展開。AgentCoreマネージドハーネスプレビューはモデル非依存のエージェントループを提供、セッションごとのmicroVM、セッション中のモデル切替、ファイルシステム永続化を実現; CLIは現在CDK対応、Terraformは近日中; SkillsはKiro Powerで利用可能、Claude Code / Codex / Cursorは来週対応。
- **Totolink A8000RU CVE 連発(CVE-2026-7153 / 7154 / 7156 / 7202、いずれもCVSS 9.8、4/27-28)+ Cisco ISE 認証不要 RCE 勧告 + SGLang CVE-2026-5760 は4/28時点でも未パッチ** — **Totolink A8000RU ファームウェア 7.1cu.643_b20200521 を狙うクリティカルなOSコマンドインジェクション CVE が48時間で4件公開**(4/27に7153/7154/7156、4/28に7202)、すべて公開PoCあり、認証不要のリモート攻撃経路。**Cisco ISE 認証不要リモートコード実行勧告**(cisco-sa-ise-unauth-rce-ZAd2GnJ6)も同時期に公開。SGLangのGGUF SSTIプリミティブには**依然としてアップストリームのパッチがない** — v0.5.10は`ImmutableSandboxedEnvironment`緩和なしで出荷; コピペクラスはvLLM(CVE-2025-61620)/ LMDeploy(CVE-2026-33626)へ拡大中。
- **野生環境における間接プロンプトインジェクション(4/24-27) — 10件の新規IPIペイロード(Google + Forcepoint)、OpenAIはプロンプトインジェクションが恒久化することを公に認める** — Forcepointが**新規10件の野生IPIペイロード**を追加、決済対応エージェントを狙う完全指定のPayPalトランザクションや、メタタグ名前空間インジェクションによるStripe寄付リンク誘導が含まれる。間接インジェクションは現在エンタープライズプロンプトインジェクション量の80%超; OpenAIは**プロンプトインジェクションクラスは恒久的**であり、防御側が遅れていることを公に認める — 脅威クラスは「パッチ可能」から「設計制約」へ移行。
- **AI Dev 26 x SF が本日(4/28)Pier 48 で開幕、開発者3,000人以上、Andrew Ng がホスト; Microsoft VibeVoice フロンティア音声 OSS が4/27に注目を集める; `talkie-1930-13b-base` が4/28出荷** — DeepLearning.AI のSF旗艦イベントは4/28-29の2日間、トラックは**Agentic AI / Context Engineering / Multimodal AI Apps / AI Governance / Coding-with-AI** + AI Startup Track。**VibeVoice**はMicrosoftによるMITライセンスのWhisper系STT、話者分離をモデル内蔵、50以上の言語対応。**Talkie-1930**はNick Levine / David Duvenaud / Alec Radfordによる、1931年以前の歴史的テキスト260Bトークンで訓練された13B言語モデル — 初の本格的な「ヴィンテージ」LMリリース。
- **Figure AI が Figure 03 を月産約240台 + 90分ビルドケイデンス + $39B評価額にスケール; Tesla Optimus V3 公開を7月下旬に延期; Boston Dynamics Atlas は Hyundai+DeepMind 2026 配備が確定** — Figure 03 月次出荷数が倍増(2-3-4月で60→120→240)、BotQが年12,000台超へスケール、BMWスパータンバーグのパイロットで30,000台以上の車両をサポート。**Tesla Optimus V3 公開は7月下旬から8月初頭**に移動、Fremont生産開始の直前に; Gigafactory Texasの5.2M sqftのOptimus拡張は年1,000万台を目標; 一般販売は2027年末、価格$20K-$30K帯。
- **Cerebras IPO 5月中旬、$22B-$25B レンジ確定; OpenAI契約は$20B+ / 750MW、2028年まで; Hugging Face Spacesが HF Buckets 永続ストレージ + エージェントトレースのデータセットアップロード + ZeroGPU クォータ超過クレジットを4/26-28に投入** — Cerebras主幹事はMorgan Stanley / Citi / Barclays / UBS; 2025年売上の24%がG42、62%がMBZUAI(集中リスク)。Spacesは現在HF Bucketsを永続ボリュームとしてマウント可能; **Claude Code / Codex / Pi のエージェントトレースが直接Hugging Face Datasetsへアップロード**、トレース形式の自動検出と専用ビューアを備える; ZeroGPU 前払いクレジット($1 / 10分)でPROユーザはクォータ超過利用が可能。

[news-20260428.md](report/ja/news-20260428.md)

### Predictions check

- **直近1週間(4/21-4/27)で20予測検証。Relevance 5 が6件、Relevance 3-4 が5件、Relevance 1-2 が3件; ドーマント・プールから1件 ping(リバイバル・レリバンス1)。** 本日の3つのFuture予測(AGI条項解消テンプレート + AI-Infra KEV サブカタログ + トークンあたりマージン・ゲート設備投資開示)は次ステップ拡張で、4/28-30 + Q3 2026 ウィンドウに集約。
- **ハイパースケーラー対AIラボ資本連結 → コンピュート・スタック・ロックイン(4/26)** Relevance 5: **OpenAI/Microsoft AGI条項撤廃 + AWS $38B for OpenAI + Anthropic が AWS Trainium + Graviton にシリコンレベルで連携 + Claude Cowork が Bedrock 内 + Meta は Graviton をスケール展開**。コンピュート・スタック・ロックインの硬化をリアルタイムに直接確認 — ただし経路は「各クラウドが各ラボを独占」ではなく「各フロンティア・ラボがマルチクラウド配布」に変化。
- **推論サーバ プリミティブ サプライチェーン(4/26)** Relevance 5: **SGLang CVE-2026-5760 が公開後10日以上未パッチ**、**Totolink A8000RU CVE クアッド(7153/7154/7156/7202、すべてCVSS 9.8)が48時間で着弾**、Cisco ISE 認証不要RCE勧告、Google + Forcepoint IPI 32% YoY上昇。NIST/CISAへの圧力は引き締まる。
- **Mag 7 Q1決算がAI capex ROIナラティブをリセット(4/27)** Relevance 5: **FOMC + Mag 7 スーパーウィークが同じ48時間のテープに収束**、2026年 capex 約$700B 集計; 「Why This Week Could Be Huge For AI Stocks」+「Can Big Tech Justify $645 Billion In AI Spending?」がナラティブをアンカー; 本日のFuture #3 はQ3 2026までのトークンあたりマージン・ゲート設備投資開示として継承。
- **3クラウド訓練オリゴポリ仮説(4/25)** Relevance 5: **OpenAI が AWS でクリア(11月署名 $38B、$50Bヘッドルーム)** + Microsoft 非独占。**Anthropic は AWS Trainium + Graviton にシリコンレベルで載る**一方、Google($40B / 5GW)と Amazon($25B + 5GW / 10年 $100B)のアンカーも維持。3クラウド訓練オリゴポリ仮説を直接補強。
- **Agent Control Plane(4/23)** Relevance 5: **AgentCore Managed Harness 4リージョンプレビュー + CLI 14リージョン GA + Skills を Kiro Power に**; **Claude Cowork が Bedrock 内部で AWS データレジデンシーを保ったまま稼働**; 「Claude Platform on AWS」統合サーフェスも近日。直接的な拡張。
- **GGUFサプライチェーン(4/21)** Relevance 5: SGLang CVE-2026-5760 は v0.5.10 で `ImmutableSandboxedEnvironment` 緩和なしで出荷; コピペクラスは vLLM CVE-2025-61620 / LMDeploy CVE-2026-33626 へ拡大。
- **Relevance 4**: 5極ハイパースケーラー対フロンティアラボ体制(4/21、シリコンレベルで部分的に補強 / 独占解除で部分的に反転); 訓練 vs 推論 SKU 分離(4/22、Trainium + Graviton CPUレーンがGPUに並列); MCPプロトコル攻撃面(4/25、Okta Agent Gateway + 仮想MCPサーバ・レジストリ); AI-Infra CVE クラス → 規制プリミティブ(4/27、AI-Infra サブカタログはまだだが圧力は引き締まる)。
- **Relevance 3**: Physical-AI-as-RaaS(4/22、Figure 03倍化 + Optimus V3 + Atlas); 27B Dense + 1Mコンテキスト(4/23、Qwen3.6-27B + V4-Flash + Bonsai-8B); 1Mコンテキスト・デフォルト・オープン重み(4/24); Physical-AI 8h生産(4/24); Physical-AI リーグテーブル IROS/GTC(4/25、リーグテーブル公開はまだ); コンシューマGPU コーディング・エージェント ≥30%(4/26); 州自律エージェント法定アイデンティティ法(4/27、Okta GA 4/30 がアンカーだが州法は未署名)。
- **Relevance 1-2**: プロプライエタリ再拡張 vs オープン重み(4/21、talkie-1930 オープン公開と Qwen3.6-Max-Preview API限定で混在); OAuthトラスト・スコープ(4/22、IPIエビデンスがリスクベクトルを補強するがSSOスコープ・カーブアウトはなし); サードパーティ・ベンダ境界 + URLネーミング・エントロピー(4/23、新規コントラクター・インシデントやURLランダム化義務化なし); SaaS置換バリュエーションリセット(4/24、ナラティブは維持、新規下落はウィンドウ内になし)。ドーマント・プール 20260420-3「Headless Everything」はシグナル・トークンのみ点灯 — 内容はマッチせず; リバイバル・レリバンス1; 次の周期 ping は 2026-05-11。
- ユーザー予測 1(悪性ローカル LLM → マルウェア + ゼロトラストが基本セーフガード):**ゼロトラスト側に強い信号、悪性ローカルLLM側はやや弱い**。Okta for AI Agents GA は4/30で残り2日、「AI 単独でアクセス不可なシステムパスを意図的に設計する」パターンを実装 — Agent Discovery & Governance + Agent Gateway + 仮想MCPサーバ・レジストリ + クレデンシャル・ヴォルト + ユニバーサル・ログアウト。Microsoft Zero Trust for AI(RSAC 2026継続)、Cisco/CrowdStrike/Splunk のコンセンサスがベースラインを補強。Google + Forcepoint IPI in-the-wild(10件の新規ペイロード)とOpenAIのプロンプト・インジェクション恒久化への公的譲歩は、「監視は必要だが十分ではない」但し書きにマップする。
- ユーザー予測 2(クラウド API は先進タスク、ローカル LLM は日常運用、SaaS 値上げが触発):**需給両面のシグナル存在、消費者向け SaaS の明示的値上げイベントはまだ未着弾**。需要側: 4/27の契約再構築は計算をハイパースケーラ所有のシリコン経由に明示的にルーティング; Mag 7 スーパーウィークは2026年 capex 約 $700B を集計、トークンあたりマージン・ゲート仮説が硬化。供給側: DeepSeek V4-Pro $1.74/$3.48 で1Mコンテキスト; PrismML Bonsai-8B 1-bit が iPhone 17 Pro Max / M4 Pro / RTX 4090 で 44/131/368 tok/s; Qwen3.6-27B が Apache-2.0 Dense オプション。トークンあたりマージン・ゲート開示は、予測した価格構造シフトの先行指標。
- ユーザー予測 3(RL/LLM ベース予測精度向上):**直接シグナルなし**。隣接するが確証ではない: AgentCore Managed Harness のセッション中モデル・スワップ + セッション毎マイクロVM(フォーキャスト・エヴァル親和的); Anthropic Rate Limits API + Claude Managed Agents パブリック・ベータ(バッチ・エヴァル向けプログラマブル・ハーネス)。Carry-only。

[future-prediction-20260428.md](future-prediction/ja/future-prediction-20260428.md)

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
