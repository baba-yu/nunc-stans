# news

*Available in: [English](README.md) | [Español](README.es.md) | [Filipino](README.fil.md)*

<!-- ai-notice -->
> **ご注意:** 本ページの記事および要約は、Anthropic 社の生成AI「Claude」によって作成されています。

- [News Explorer (GitHub Pages)](https://baba-yu.github.io/news/) — 未来予測ダッシュボード
- `report/` — 日次ニュースレポート
- `future-prediction/` — 今日のニュースと昨日までの日次ニュースFuture欄の答え合わせ

---

## 2026-06-28

### News

- **Liquid AI、初日からvLLMとSGLangに対応する230Mのエッジモデルを出荷** — 6月27日、Liquid AIはLFM2.5-230Mを公開した。LFM2アーキテクチャに基づく230百万パラメータのテキスト専用モデルで、32,768トークンのコンテキストウィンドウを備え、スマホ・ロボット・自動化機器上でのエージェント型タスクを狙う。オープンウェイトのベース版と指示チューニング版のチェックポイントが、初日からllama.cpp、MLX、vLLM、SGLang、ONNXのランタイム対応とともに、lfm1.0ライセンスのもとHugging Faceで提供され、4ビット時のサイズは293〜375MBに収まる。LiquidはGalaxy S25 Ultraで毎秒213トークン、Raspberry Pi 5で毎秒42トークン、IFEvalスコア71.71を報告し、これがQwen3.5-0.8BとGemma 3 1Bを上回るとしている。データセンターで使われるのと同じOpenAI互換の推論エンジンが、いまや1ギガバイト未満のオンデバイスモデルの既定の対象になっている。 [MarkTechPost - Liquid AI ships LFM2.5-230M with llama.cpp, MLX, vLLM, SGLang, and ONNX support for on-device inference](https://www.marktechpost.com/2026/06/27/liquid-ai-ships-lfm2-5-230m-with-llama-cpp-mlx-vllm-sglang-and-onnx-support-for-on-device-inference/), [Hugging Face - LiquidAI/LFM2.5-230M model card](https://huggingface.co/LiquidAI/LFM2.5-230M)

- **Qualcomm、CUDAに挑むためModularのクロスベンダー推論コンパイラを買収** — 6月24日、QualcommはModularの買収契約を発表した。ModularはMojo言語と、同じモデルコードをNvidia、AMD、Intel、Qualcommのチップ上でプロセッサごとの書き換えなしに実行できるMAX推論エンジンを手がけるスタートアップだ。報道は全株式取引の規模をおよそ39.2億ドル（最大1,920万株）とし、2026年下半期に完了予定で、エンタープライズ推論におけるNvidiaのCUDA囲い込みへの直接的な一手と読み解いている。Qualcommはまた、2026年末までに大手ハイパースケーラー向けのカスタムシリコン出荷を見込むとし、80〜100億ドルの評価額でTenstorrentを買収する交渉を続けていると報じられている。これらを合わせると、コンパイラ・アクセラレータ・ハイパースケーラー供給にまたがる、Nvidiaへのフルスタックかつオープン命令セットの挑戦に向けておよそ140億ドルを投じることになる。 [Qualcomm - Qualcomm to Acquire Modular (press release, June 24 2026)](https://investor.qualcomm.com/news-events/press-releases/news-details/2026/Qualcomm-to-Acquire-Modular/default.aspx), [Tech Startups - Qualcomm acquires AI startup Modular in $4 billion deal to challenge Nvidia's CUDA dominance](https://techstartups.com/2026/06/24/qualcomm-acquires-ai-startup-modular-in-4-billion-deal-to-challenge-nvidias-cuda-dominance/)

- **Unslothのベータ版、GLM-5.2、Gemma 4のマルチトークン予測、DiffusionGemmaを追加** — 高速かつメモリ効率の良いLoRA/QLoRAファインチューニングのためのオープンソースライブラリUnslothは、6月18日にv0.1.471-betaを出荷し、目玉となる変更は新モデル対応の幅広さだった。Z.aiのGLM-5.2（今月エージェント型コーディングのベンチマークで首位に立ったMITライセンスの約753BパラメータのMoE）を全推論レベルで完全対応したほか、約2倍の高速推論を実現するマルチトークン予測付きのGemma 4、ライブのノイズ除去可視化を備えたDiffusionGemmaの画像生成パス、DeepSeek-OCRを追加した。このビルドはさらに、使用可能なコンテキストを約3倍に伸ばすとされる改良版の自動メモリ調整アルゴリズム、強化されたBlackwell RTX 50X/60X対応、テンソル並列の信頼性向上、vLLM 0.22+互換、並列実行モードも加えた。注目すべきパターンは、最先端のオープンウェイト公開（6月16日のGLM-5.2）から、その2日後に第一級のファインチューニング対応が出てくるまでの間隔が縮まっていることだ。 [GitHub - unslothai/unsloth release v0.1.471-beta (June 18 2026)](https://github.com/unslothai/unsloth/releases/tag/v0.1.471-beta), [DataCamp - GLM-5.2: Features, Setup, Benchmarks, and Model Switching Guide](https://www.datacamp.com/blog/glm-5-2)

- **OWASP、プロンプトインジェクションをエージェント型AIの修正不能な性質として捉え直す** — OWASP GenAI Security Projectは今月、State of Agentic AI Security and Governanceのバージョン2.01を公開し、セキュリティの語り口をまた一つのCVEから設計上の制約へと鋭く転換した。プロンプトインジェクションは大半のエージェント型AIの事案をつなぐ自在継手であり、いまやOWASPのエージェント型アプリケーション向けTop 10の10分類のうち6つに対応する。モデルはシステムプロンプト・ユーザーの要求・取得したテキストを区別のない一つのトークン列として扱うため、どのトークンが命令でどれがデータかを確実に印付ける手段がなく、この欠陥はパッチで直すのではなく設計上の予算で緩和される。報告書はSimon Willisonの致命的な三要素とMetaのエージェント・ルール・オブ・トゥーに依拠し、コーディングエージェントを震源地と名指しする。追跡対象の53のエージェント型プロジェクトのうち28がコーディングエージェントで、最も多く勧告を受けたリポジトリはn8n（57）、Claude Code（22）、AutoGPT（15）、Dify（13）、Roo-Code（11）だった。 [OWASP GenAI Security Project - State of Agentic AI Security and Governance 2.01](https://genai.owasp.org/resource/state-of-agentic-ai-security-and-governance/), [Simon Willison - The lethal trifecta for AI agents: private data, untrusted content, and external communication](https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/)

- **AI World's Fairが今週開幕、夏のチップとセキュリティの日程も確定** — 今後の予定は3つのサブトラックにまたがる。主流の開発／データ系では、AI Engineer World's Fairの本プログラムが6月29日から7月2日までサンフランシスコのMoscone Westで開かれ（約29トラック、約300人の登壇者、6,000人超の参加者）、さらに先にはGitHub Universeが10月28〜29日、AWS re:Inventが11月30日〜12月4日に控える。AIセキュリティ系では、SecurityWeekのAI Risk Summitが8月11〜12日にHalf Moon BayのRitz-Carltonで、Black Hat USA 2026とAI Village付きのDEF CON 34が8月初旬にラスベガスで、OWASP Global AppSec USAが11月5〜6日にサンフランシスコで開催され、ZenityのAI Agent Security Summitシリーズも引き続き注視対象に残る。AIチップ／ハードウェア系では、AMDのAdvancing AI 2026が7月22〜23日にMoscone、Hot Chips 2026が8月23〜25日にStanford、AI Infra Summitが9月15〜17日にSanta Claraで開かれる。 [AI Engineer - World's Fair 2026 program (main program June 29 - July 2, Moscone West, San Francisco)](https://www.ai.engineer/worldsfair/2026/llms.md), [SecurityWeek - AI Risk Summit, August 11-12, Ritz-Carlton Half Moon Bay](https://www.securityweek.com/securityweek-to-host-ai-risk-summit-august-11-12-at-the-ritz-carlton-half-moon-bay/), [Hot Chips - 2026 symposium (August 23-25, Stanford Memorial Auditorium)](https://hotchips.org/)

[news-20260628.md](report/ja/news-20260628.md)

### Predictions check

本日のシグナルは、オープンで可搬なAIスタックが、エッジモデル・ベンダー横断のチップコンパイラ・エージェント型セキュリティ姿勢という3つの層で同時に成熟していることを示す。各層がそれぞれ新たな見立ての起点となるシグナルを供給した。エッジ層では、Liquid AIが6月27日に公開したLFM2.5-230M（2億3000万パラメータのテキスト専用モデル、4ビット時293〜375MB、Galaxy S25 Ultraで毎秒213トークン）が、オープンウェイトのベース版と指示チューニング版をHugging Faceで配布し、初日からllama.cpp、MLX、vLLM、SGLang、ONNXに対応した。対をなすのがUnslothのv0.1.471-beta（6月18日）で、Z.aiのGLM-5.2向けのLoRA/QLoRA対応を、6月16日のオープンウェイト公開からわずか2日後に第一級対応として加えた。このフロンティアで実証された2日という間隔をエッジ層に当てはめることが、「今期に公開された1B未満のオンデバイスモデルが、ウェイト公開と同じ週のうちに主流のチューニングツールキットでLoRA/QLoRA対応を得る」見立て（6月28日）を関連度5段階中5で支える。隔たりは、その特定の1B未満チェックポイントについて主流ツールキットが同じ週に対応した事実がまだない点だ。

シリコン層では、Qualcommが6月24日に合意したModularの買収（約39億2000万ドルの全株式取引、2026年下半期に完了見込み）が中心となる。Modularは、Nvidia・AMD・Intel・Qualcommの各チップでプロセッサごとの書き換えなしに同じモデルコードを動かすMAX推論エンジンを手がける。年内のハイパースケーラー向け独自シリコン供給の約束と、80〜100億ドル規模と報じられるTenstorrentとの協議を合わせ、約140億ドルがNvidia対抗のフルスタック構築に向かう。最大の中立的なベンダー横断型コンパイラ資産を市場から取り除いたこの動きが、「少なくとも1社の競合アクセラレータ陣営が2027年第1四半期までに同等のCUDA非依存の推論コンパイラを買収する」見立て（6月28日）を関連度5で触発する。隔たりは、競合による対抗買収がまだ発表されていない点だ。

3つ目の層はエージェント型セキュリティだ。OWASP GenAI Security Projectのバージョン2.01は、プロンプトインジェクションをパッチ可能なCVEから構造的な設計上の制約へと捉え直し、エージェント型Top 10の10分類のうち6つに対応づける。モデルがシステムプロンプト・ユーザー要求・取得テキストを区別のないトークン列として扱うため、命令とデータを確実に分ける手立てがなく、欠陥はパッチではなく設計上の予算（致命的な三要素、ルール・オブ・トゥー）で緩和される。報告書はコーディングエージェントを震源地と名指しし、勧告が最も多いリポジトリはn8n、Claude Code、AutoGPT、Dify、Roo-Codeだ。この論拠が「主要なコーディングエージェント基盤が2027年第1四半期までにルール・オブ・トゥー型の権限ゲートを既定有効で搭載する」見立て（6月28日）を関連度5で支える。隔たりは、既定有効の三要素ゲートを出荷した基盤がまだない点だ。引き継がれたクラスタも整合的に波及する。256GB未満の単一ノード仮説（6月23日）はGLM-5.2のMoEとメモリ効率化ツールを、トークン予算デフォルト化の仮説（6月25日）は広い既定有効ガードレールの圧力を、それぞれ土台に取った。一方、AMDのAdvancing AI（7月22〜23日）と機密推論の筋は、来たる会場の時計を待っている。

[future-prediction-20260628.md](future-prediction/ja/future-prediction-20260628.md)

---

## 2026-06-27

### News

- **Langflowのテナント横断IDOR（CVE-2026-55255）が実環境で悪用される** — Sysdigの脅威リサーチチームは6月25日、LLMエージェント向けのオープンソースのビジュアル構築ツールLangflowに存在するテナント横断の安全でない直接オブジェクト参照（IDOR）の欠陥が、実環境で悪用された初の既知事例を報告した。CVSS 9.9と評価され、1.9.1で修正されている。get_flow_by_id_or_endpoint_nameがフローをUUIDで解決する際に所有者チェックを一切行わないため、認証済みのユーザーは誰でも、/api/v1/responses経由で別テナントのフローを実行できる（CWE-639）。観測された連鎖では、攻撃者がフローIDを収集し、約20秒後に入力「leak api keys」とともに再生しており、対象インスタンスはKEV掲載のRCEであるCVE-2026-33017も動かしていた。1.9.1より前を運用している者は、いますぐアップグレードし、露出したフローIDはすでに採取されているものとみなすべきだ。 [Sysdig - Understanding Langflow CVE-2026-55255, and why higher-CVSS vulnerabilities aren't always the most exploited](https://webflow.sysdig.com/blog/understanding-langflow-cve-2026-55255-and-why-higher-cvss-vulnerabilities-arent-always-the-most-exploited), [GitHub Advisory Database - Langflow IDOR in /api/v1/responses lets authenticated attackers run another user's flow (CVE-2026-55255)](https://github.com/advisories/GHSA-qrpv-q767-xqq2)

- **AutoGPTのSSRF防御回避（CVE-2026-56663）が内部サービスを露出させる** — 継続的に動くAIエージェントを構築・実行するためのオープンソース基盤AutoGPTに高深刻度の欠陥が見つかり、6月26日にCVE-2026-56663として公開された。CVSS 8.5と評価され、0.6.52で修正されている。エージェントが外向きのHTTP呼び出しに使うSendWebRequestBlockが、IPv4射影IPv6アドレスの扱いを誤り、特定のIP範囲を検証できていないため、認証済みのユーザーは内部IPフィルターをくぐり抜けるリクエストを組み立て、プライベートネットワーク上のサービスに到達できる。汎用の取得部品であるため、テナントのエージェントは、本来は到達できないはずのクラウドのメタデータや内部の管理画面、データベースを探るよう仕向けられてしまう。0.6.52より前を運用している者は、アップグレードし、エージェント実行基盤からの外向き通信を絞り込むべきだ。 [NVD - CVE-2026-56663 Detail (AutoGPT SSRF-protection bypass via IPv4-mapped IPv6 addresses, fixed in 0.6.52)](https://nvd.nist.gov/vuln/detail/CVE-2026-56663)

- **いま予定に入れておきたいAIイベント：AI Engineer World's Fairの週末が開幕、チップとセキュリティの日程は秋まで続く** — 3つのサブトラックすべてにまたがる今後の日程は、この週末にサンフランシスコで開かれるAI Engineer World's Fairが起点となる。主流の開発／データ系では、Cerebral Valleyとの共催によるAIE World's Fair Hackathonがいままさに進行中で（6月27〜28日、再帰的自己改善がテーマ、賞金総額1万ドル超）、任意参加のNew Engineer Orientationが6月28日、本編は6月29日から7月2日までMoscone Westで開催される。AIセキュリティ系では、Black Hat USA 2026が8月初旬にラスベガスのMandalay Bayで開かれ、その直後にDEF CON 34とそのAI Villageが続く。SecurityWeekのAI Risk Summitは8月11〜12日、OWASP Global AppSec USAは11月5〜6日に開かれる。AIチップ／ハードウェア系では、AMDのAdvancing AI 2026が7月22〜23日にMosconeで開かれ、Instinct MI400シリーズに焦点を当てた回が7月23日に行われる。Hot Chips 2026は8月23〜25日、AI Infra Summitは9月15〜17日に開催される。 [AI Engineer - World's Fair 2026 (hackathon June 27-28; main program June 29 - July 2, Moscone West, San Francisco)](https://www.ai.engineer/worldsfair/2026), [AMD - Advancing AI 2026 (San Francisco, July 22-23)](https://www.amd.com/en/corporate/events/advancing-ai.html), [Black Hat - USA 2026 AI Summit (Mandalay Bay, Las Vegas, early August)](https://blackhat.com/us-26/ai-summit.html)

[news-20260627.md](report/ja/news-20260627.md)

### Predictions check

本日、エージェント型AIの攻撃対象領域はひとつの境界を越えた。理論と単発の勧告から、実環境で観測された悪用へと移ったのだ。主役はLangflowのCVE-2026-55255で、LLMエージェント向けの普及したビジュアル構築ツールにおける、テナント横断の安全でない直接オブジェクト参照の欠陥（CWE-639、CVSS 9.9、1.9.1で修正）だ。get_flow_by_id_or_endpoint_nameがUUIDで解決するフローに所有者チェックがないため、認証済みのどのユーザーも/api/v1/responses経由で別テナントのフローを実行できる。Sysdigは6月25日に初の実環境での悪用を報告し、攻撃者がフローIDを収集して約20秒後に入力「leak api keys」とともに再生し、同じインスタンスでKEV掲載のRCEであるCVE-2026-33017も動かしていた様子を観測した。これと対をなすのがAutoGPTのCVE-2026-56663（CVSS 8.5、0.6.52で修正）で、SendWebRequestBlockがIPv4射影IPv6アドレスを誤って扱い、内部サービスに到達してしまう実行層の欠陥だ。

この2件のCVEが本日最も強い裏付けの起点となり、同じ週に並んだ2件の新たな見立てを揃って下支えする。「マルチテナントのエージェント構築ツールが2027年第1四半期までにCVSS 9.0以上のテナント横断認可CVEを引き寄せる」見立て（6月27日）には、Langflowが最初の分類事例として、またn8n／Flowise／Dify／LangGraph Platform／CrewAIの系列に繰り返し現れる設計上の型として種をまく。「主要なAIエージェント基盤が2027年第2四半期までにゼロトラスト制御を初期状態で有効にして出荷する」見立て（6月27日）には、悪用されたテナント横断IDORとSSRF回避が同じ週に並んだことが後押しとなる。双方が関連度5段階中5を整合性4で得た。共通する隔たりは、本日提供されたのが動機づけのCVEであって、分類を裏づける2つ目のプラットフォームでも、名前のある既定の構えを変えるリリースでもない、という点だ。

引き継がれた防御側の見立て、すなわち「コーディングエージェントのハーネスが拒否を既定とするツールセット制御を採用する」（6月20日）と「OpenClawが拒否を既定とするツールとネットワーク制御を出荷する」（6月23日）も、脅威の側から直接の裏づけを得た。AutoGPTの是正策（アップグレードと外向き通信の制限）は、これらの予測が標準になると見込む既定の手作業による版だ。3つ目の話題は前向きの3トラックのAIイベントカレンダーで、AMDのAdvancing AI 2026（7月22〜23日、MI400シリーズの基調講演は7月23日）が「AMD Instinct MI400が名前の付いた出荷・メモリ・ラックの仕様を伴って投入される」見立て（6月27日）に日付と会場という契機を整合性4で提供する一方、秘匿推論の階層（6月26日）や調達のプロンプトインジェクション基準（6月23日）には、漂う会場のリズムのみを与えた。

[future-prediction-20260627.md](future-prediction/ja/future-prediction-20260627.md)

---

## 2026-06-26

### News

- **最高深刻度のRCEがMLフィーチャーストア層に：Feastのレジストリに認証不要のリモートコード実行** — オープンソースの機械学習フィーチャーストアであるFeastに、認証不要で深刻度最大のリモートコード実行（RCE）の欠陥が見つかり、6月24日にCVE-2026-56121として公開された。v4.0採点でCVSS 9.3（v3.1の尺度では9.8）と評価され、Feast 0.63.0で修正されている。レジストリサーバーがgRPCリクエストを処理する際、OnDemandFeatureView仕様のuser_defined_function.bodyフィールドをbase64からデコードし、認可チェックを一切経ずにそのままdill.loads()へ渡してしまう。そのため攻撃者は、任意の__reduce__メソッドを仕込んだシリアライズ済みPythonオブジェクトを送り込み、認証情報なしでFeastのサービスアカウント権限としてOSコマンドを実行できる。構造的に読み取れるのは、機械学習の弱点が、モデルや推論エンジンより一段下の、データとメタデータを扱う配管部分へ降りてきたということだ。シリアライズされた変換ロジックをネットワーク越しに取り込むレジストリは、デシリアライズが認可で守られない限り、認証不要のコード実行口にほかならない。運用者は、ネットワークから到達可能なgRPCレジストリを持つ0.63.0より前のあらゆる構成を露出状態とみなし、ただちにアップグレードし、レジストリが信頼できないネットワークから到達不能であることを確認すべきだ。 [GitHub Advisory Database - Feast unsafe deserialization allows unauthenticated RCE (CVE-2026-56121)](https://github.com/advisories/GHSA-q63x-9pfm-mjx4), [NVD - CVE-2026-56121 Detail (Feast before 0.63.0, gRPC registry deserialization RCE)](https://nvd.nist.gov/vuln/detail/CVE-2026-56121)

- **いま予定に入れておきたいAIイベント：AI Engineer World's Fairが今週末に開幕、チップとセキュリティの日程は夏まで続く** — 3つのサブトラックすべてにまたがる今後の日程は、今週末にサンフランシスコのMoscone Westで開かれるAI Engineer World's Fairが起点となる。主流の開発／データ系では、Cerebral Valleyとの共催による公式のAIE World's Fair Hackathonが6月27〜28日を埋め、任意参加のNew Engineer Orientationが6月28日に行われ、本編は6月29日から7月2日まで開催される（20を超えるトラック、250名以上の登壇者）。GitHub Universeは10月28〜29日に再び開かれ、AWS re:Inventはラスベガスで11月30日から12月4日まで行われる。AIセキュリティ系では、Black Hat USA 2026がラスベガスのMandalay Bayで8月1〜6日に開催され、Summit Day（AI Summitトラックを含む）が8月4日、本編のBriefingsが8月5〜6日、その直後にDEF CON 34とそのAI Villageが8月6〜9日に続く。SecurityWeekのAI Risk Summitは8月11〜12日にHalf Moon BayのRitz-Carltonで、OWASP Global AppSec USAは11月5〜6日にサンフランシスコで開かれる。AIチップ／ハードウェア系では、AMDのAdvancing AI 2026が7月22〜23日にMosconeで開催され、対面の基調講演とInstinct MI400シリーズに焦点を当てた回が7月23日に行われる。Hot Chips 2026は8月23〜25日にStanfordのMemorial Auditoriumで、AI Infra Summitは9月15〜17日にSanta Clara Convention Centerで開催される。 [AI Engineer - World's Fair 2026 (June 29 - July 2, Moscone West, San Francisco)](https://www.ai.engineer/worldsfair/2026), [AMD - Advancing AI 2026 (San Francisco, July 22-23)](https://www.amd.com/en/corporate/events/advancing-ai.html), [Black Hat - USA 2026 (August 1-6, Mandalay Bay, Las Vegas)](https://blackhat.com/us-26/), [SecurityWeek - AI Risk Summit, August 11-12, Half Moon Bay](https://www.securityweek.com/securityweek-to-host-ai-risk-summit-august-11-12-at-the-ritz-carlton-half-moon-bay/)

[news-20260626.md](report/ja/news-20260626.md)

### Predictions check

本日はニュースの少ない日で、土台となる話題はひとつだ。機械学習の基盤層における深刻度最大の欠陥である。オープンソースの機械学習フィーチャーストアであるFeastについて、6月24日にCVE-2026-56121が公開された。認証不要のリモートコード実行の欠陥で、CVSSはv4.0で9.3（v3.1では9.8）と評価され、Feast 0.63.0で修正されている。レジストリサーバーがgRPCリクエストを処理する際、OnDemandFeatureView仕様のuser_defined_function.bodyフィールドをbase64でデコードし、認可チェックを一切経ずにそのままdill.loads()へ渡してしまう。そのため攻撃者は、任意の__reduce__メソッドを持つ細工済みのシリアライズ済みPythonオブジェクトを送り込み、認証情報なしにFeastのサービスアカウント権限でOSコマンドを実行できる。構造的に読み取れるのは、機械学習の弱点が、モデルや推論エンジンより一段下の、データとメタデータを扱う配管部分まで降りてきたということだ。

この単一のCVEが、本日の最も強い裏付けの起点となる。関連度は5段階中5を得て、「機械学習のレジストリサーバーが2027年第1四半期までに2件目の深刻度最大のデシリアライズRCEを記録する」見立て（6月26日）と、「セキュリティベンダーが2027年第1四半期までに機械学習のデシリアライズ走査を名前のある製品階層として出荷する」見立て（6月26日）の双方を、高い整合性で裏支えする。フィーチャーストア・モデルレジストリ・メタデータサーバーにまたがって繰り返し現れるpickle/dill/joblibの仕組みは、2件目の名前のある事例を見込ませると同時に、アプリケーションセキュリティのベンダー（Snyk／Endor Labs／JFrog／Protect AI／HiddenLayerの系統）に、製品化すべき実証済みで武器化可能な脆弱性クラスを与える。防御側の対をなす「マネージドのモデル配信プラットフォームが2027年上半期までに安全な成果物の取り扱いを既定にする」見立て（6月17日）も、その動機づけとなる脅威について本日最も強い裏付けを整合性4で得た。だが4件すべてに共通する隔たりは同じで、本日提供されたのは最初の事例と引き金であって、実際の再発・出荷されたスキャナー・既定化されたプラットフォームではない。

2つ目の話題は、ニュースの出来事ではなく、3つのトラックからなる前向きのAIイベントのカレンダーであり、主に秘匿コンピューティングの筋にとっての会場の地図として機能する。AI Engineer World's Fairは今週末にMoscone Westで開幕し（ハッカソンは6月27〜28日、本編は6月29日から7月2日まで）、その後にAMDのAdvancing AI 2026（7月22〜23日）、Black Hat USA 2026（8月1〜6日、AI Summitは8月4日）、DEF CON 34のAI Village（8月6〜9日）、SecurityWeekのAI Risk Summit（8月11〜12日）、Hot Chips（8月23〜25日）、OWASP Global AppSec USA（11月5〜6日）と続く。同じFeastのレジストリの脆弱性は、引き継がれた秘匿推論と署名付きモデル証明の見立てを脅威の側から後押しするが、それらや自律ペンテストの見立て（6月22日・25日）、数値で示すプロンプトインジェクション耐性の調達基準（6月23日）については、本日提供されたのは脅威の背景と会場のリズムのみで、出荷される部品・階層・契約条項はまだ現れていない。

[future-prediction-20260626.md](future-prediction/ja/future-prediction-20260626.md)

---

