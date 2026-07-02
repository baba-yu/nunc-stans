# news

*Available in: [English](README.md) | [Español](README.es.md) | [Filipino](README.fil.md)*

<!-- ai-notice -->
> **ご注意:** 本ページの記事および要約は、Anthropic 社の生成AI「Claude」によって作成されています。

- [News Explorer (GitHub Pages)](https://baba-yu.github.io/news/) — 未来予測ダッシュボード
- `report/` — 日次ニュースレポート
- `future-prediction/` — 今日のニュースと昨日までの日次ニュースFuture欄の答え合わせ

---

## 2026-07-02

### News

- **Langflowのテナント間IDORが実際に悪用され始めた** — Sysdig Threat Research Teamは、CVE-2026-55255が実環境で悪用された初の事例を報告した。これはローコードのAIエージェント構築ツールLangflowに存在するCVSS 9.9の不適切な直接オブジェクト参照(IDOR)で、NVDが6月23日に公開したものだ。この欠陥により、認証済みの攻撃者は`/api/v1/responses`エンドポイント経由で被害者のフローIDを渡すだけで、他ユーザーの任意のフローを実行できてしまう。Langflow 1.9.2で修正済みだ。Sysdigがより鋭く指摘するのは、このIDORが、より古く注目度の高い9.8のLangflow RCEよりも先に武器化された点である。つまり素のCVSS値は、攻撃者が実際に狙うエージェントフレームワークの穴を予測する指標としては貧弱だということだ。Langflowは社内でマルチユーザーの「市民開発者」向けエージェント工場として立ち上げられることが多く、認証済みユーザー限定のバグでも、テナント間に及ぶ広い影響範囲につながる。もはやモデルだけでなく、ビジュアルなエージェント構築レイヤーそのものが主要な攻撃対象になっている。[NVD - CVE-2026-55255 Detail](https://nvd.nist.gov/vuln/detail/CVE-2026-55255), [Sysdig - Understanding Langflow CVE-2026-55255](https://www.sysdig.com/blog/understanding-langflow-cve-2026-55255-and-why-higher-cvss-vulnerabilities-arent-always-the-most-exploited)

- **Unsloth v0.1.471-betaがGLM 5.2、約3倍のコンテキスト、Blackwell RTX対応を追加** — Unslothの最新タグ付きビルドは、GLM 5.2を全推論レベルで同週対応させ、メモリ自動フィットのアルゴリズムを刷新して、同一VRAMで実現可能なコンテキスト長を約3倍に伸ばしたと主張する。あわせてBlackwell RTX GPUへの対応強化、トレンドフィードと検索を備えた再設計版モデルHub、StudioセッションをCloudflare暗号化で保護する`--secure`フラグも追加された。これは、混合エキスパート(MoE)の学習が12倍高速化し、VRAMを35%超節約し、単一の192GB B200上で最大380KトークンのRLコンテキストを実現したと報告した従来路線の延長線上にある。Unslothは、単一ワークステーションGPUで最新のオープンウェイトMoEチェックポイントをチューニングする際の定番の入り口であり続けている。[GitHub - unslothai/unsloth releases](https://github.com/unslothai/unsloth/releases), [Unsloth - 2026 Update: Faster MoE](https://unslothai.substack.com/p/unsloth-2026-update-faster-moe)

- **Mistral 3が完全なオープンウェイトのApache-2.0ファミリーとして登場** — Mistral AIはMistral 3を発表した。中核となるMistral Large 3は、アクティブ41B・総計675Bパラメータで学習された疎な混合エキスパート(MoE)で、これに14B・8B・3Bの3つの密モデルが加わる。このファミリーは明確にエージェント指向・ツール利用重視と位置づけられ、コーディング、ドキュメント分析、長時間のオーケストレーションにまたがる。また、重みを商用ファインチューニングや再配布に安全に使える寛容なApache 2.0条項へ、というMistralの方針転換を引き継いでいる。小型の密モデル群はOllama、llama.cpp、MLXで余裕をもって動くサイズに収められ、MoEの旗艦モデルはvLLMとSGLangに収まる。これによりQwen 3.5やDeepSeekの最新の疎チェックポイントに対するオープンウェイト勢の構図が一段と鮮明になる。[Mistral AI - Introducing Mistral 3](https://mistral.ai/news/mistral-3/)

- **AMDがMI400のお披露目を7月22-23日に設定、メモリがサイクルを牽引** — AMDは、サンフランシスコのMoscone Centerで7月22-23日に開催するAdvancing AI 2026イベントを確定させた。ここでは、MI400シリーズ(TSMCの2nmプロセスによるCDNA 5)と「Helios」ラックスケールシステムの詳細が明かされると見られ、報道はMI350世代の2倍を超えるメモリ帯域を指し示している。業界全体の底流にあるのは、いまや制約となっているのが素のFLOPSではなくメモリだという点だ。長コンテキスト推論によるKVキャッシュの増大が、より大きなHBMプールへと購入者を押しやっており、高帯域メモリが2026暦年を通じて売り切れのまま推移していることが、この逼迫に拍車をかけている。TAMは2028年までに約$100Bに達すると予測される。NVIDIAの対抗策は市場の最上位を容量競争に保っており、最大288GBのHBM3eを搭載するBlackwell Ultra GB300や、512GBを狙うRubin Ultraの各仕様がそれにあたる。[AMD - Advancing AI 2026 press release](https://ir.amd.com/news-events/press-releases/detail/1283/amd-announces-advancing-ai-2026), [Introl - The AI Memory Supercycle: HBM 2026](https://introl.com/blog/ai-memory-supercycle-hbm-2026)

- **AIイベント：World's Fairが本日閉幕、チップ・セキュリティの日程も確定** — Moscone Westで開催中のAI Engineer World's Fairが本日7月2日に閉幕し、29トラック561セッション、6,000名超の参加者を集めた4日間の会期を締めくくる。AIチップのトラックでは、MI400をお披露目するAMDのAdvancing AI 2026が7月22-23日で次に控え、続いてStanfordでのHot Chipsが8月23-25日、Santa ClaraでのAI Infra Summitが9月15-17日に予定される。AIセキュリティでは、日程が8月上旬から中旬に集中する。SecurityWeekのAI Risk SummitがHalf Moon Bayで8月11-12日、Black Hat USAとDEF CON 34のAI VillageがLas Vegasで8月上旬に開催され、OWASP Global AppSec USAがSan Franciscoで11月5-6日に続く。並行して、ZenityのAI Agent Security Summitシリーズも世界各地での開催を継続する。さらに先では、GitHub Universeが10月28-29日、AWS re:Inventが11月30日から12月4日に設定されている。[AI Engineer - World's Fair 2026](https://www.ai.engineer/worldsfair/2026), [AMD - Advancing AI event page](https://www.amd.com/en/corporate/events/advancing-ai.html)

[news-20260702.md](report/ja/news-20260702.md)

### Predictions check

本日のニュースは、既存の2つのテーゼをほぼそのまま裏づけた。実環境で確認されたLangflowのテナント間IDORの悪用は、まさに**マルチテナントのエージェント構築ツールは2027年Q1までに9.0超のテナント間認可CVEを引き当てる**というテーゼ(6月27日)が見込んでいた、名指しの9.0超・マルチテナント認可のCVEそのものであり、関連度は最大の5/5で、しかも予測の地平のはるか手前で実際に武器化された形で到来した。これは同時に、共有される実行レイヤー認可のシグナルの上で、休眠状態だった*エージェントフレームワークのSQLツールは2027年Q1までにデフォルト読み取り専用の実行ガードを搭載する*テーゼ(6月5日)を再び動かし、継続中の*ゼロトラスト制御が2027年Q2までにデフォルトオンになる*(6月27日)および*デフォルト拒否のツールセットゲーティングが2027年H1までに実現する*(6月20日)の各テーゼへの圧力を保っている。この同じインシデントは、本日の新規テーゼ**エージェント構築プラットフォームは2027年Q1までにテナント単位のフロー認可を追加する**の種でもある。エージェント構築ツールのCVE群に共通する障害モードは、認証済みユーザーがテナント間へ到達できてしまうことであり、オブジェクトレベルの認可がそれを封じるからだ。

ハードウェア側では、AMDが確定させた7月22-23日のAdvancing AIの日程が、MI400のお披露目——名指しされたHeliosラック、MI350の2倍超のメモリ帯域——を、**AMD Instinct MI400は2026年Q3までに名指しの出荷・メモリ・ラック仕様を伴って登場する**というテーゼ(6月27日)の窓の内側に、5/5でぴたりと収める。そして本日の新規テーゼ**AMD MI400はAdvancing AIでピークFLOPSよりメモリ帯域を前面に打ち出す**は、これを直接足場にしている。HBMが2026年まで売り切れ、TAMが約$100Bという構図は、継続中の*HBM割り当てが2027年Q2までにベンダー開示の中で名指しの拘束的上限になる*テーゼ(6月29日)を供給側の希少性として前進させる。もっとも、割り当ての上限を提出書類の中で名指ししたベンダーはまだない。

オープンウェイトとローカルチューニングの各軸が、この日を締めくくる。Mistral 3のApache-2.0の密モデル14B/8B/3B版は、フロンティア級のオープンウェイトを単一ノードの256GB未満という枠内に収め、*フロンティア級のオープンウェイトLLMが2026年Q4までに256GB未満の単一ノードで動く*テーゼ(6月23日)を前進させる。一方、そのローンチ当日のvLLM/SGLang対応にOllama/llama.cpp/MLXのパッケージングを加えた点は、*量子化デフォルトのサービングが2027年H1までにOSS推論のベースラインとして定着する*テーゼ(6月30日)を後押しし、本日の新規テーゼ**ローンチ当日のvLLM/SGLang＋Ollama対応がオープンウェイトMoEリリースの基準になる**の種となる。UnslothのGLM 5.2への同週対応と3倍コンテキストの自動フィットは、ファストフォローの頻度と長コンテキストの機構という軸で、*サブギガバイトのオンデバイス同週Unslothチューニング*(6月28日)および*単一24-32GB GPUでの100Kトークンのファインチューニング*(6月20日)の各テーゼを前進させる。横断的なパターンとして、エージェント構築ツールの攻撃対象、メモリ主導のアクセラレータサイクル、そしてオープンウェイト＋ローカルチューニングのスタックが、すべて同じ日に前進した。

[future-prediction-20260702.md](future-prediction/ja/future-prediction-20260702.md)

---

## 2026-07-01

### News

- **Claude Sonnet 5 が Opus に迫るエージェント作業をより安く提供** — Anthropic は6月30日に Claude Sonnet 5 を公開し、刷新した中型モデルを、フラッグシップに近い品質で長期タスクのエージェントを回す最安の手段として位置づけた。ブラウザやターミナルといったツールを自律的に計画・使用できるように作られており、Anthropic は推論・ツール使用・コーディング・知識労働で Sonnet 4.6 から大きく前進したと主張する。さらに中〜高負荷の設定で、BrowseComp のエージェント型検索ベンチマークと OSWorld-Verified のコンピュータ操作ベンチマークにおいて Opus 4.8 と同等のコストパフォーマンスを主張する。導入価格は8月31日まで入力100万トークンあたり2ドル・出力100万トークンあたり10ドルで、その後は標準の3ドル/15ドルへ移る。Free と Pro の既定モデルであり、Max・Team・Enterprise と API でも利用できる。Anthropic は望ましくない挙動の割合が下がり、プロンプトインジェクションによる乗っ取りの試みへの耐性が前モデルより高まったとしている。 [Anthropic - Introducing Claude Sonnet 5](https://www.anthropic.com/news/claude-sonnet-5), [9to5Mac - Anthropic upgrades Claude with new Sonnet 5 model](https://9to5mac.com/2026/06/30/anthropic-upgrades-claude-with-new-sonnet-5-model-details-here/)

- **Claude Science が既存モデルを60以上のラボ用ツールに接続** — 同じ6月30日の周期で Anthropic は Claude Science を投入した。これは研究用のワークベンチで、注目すべきは新しいモデルではなくハーネスである点だ。すでに販売中の Claude モデル（Opus 4.8 を含み、特別なアクセスは不要）をそのまま動かし、ゲノミクス、シングルセル、プロテオミクス、構造生物学、ケモインフォマティクスにまたがる60を超える科学データベースと計算ツールへの事前設定済みコネクタを重ねる。Claude Code と同様に、簡潔で高レベルの指示から意味のある作業を遂行し、タンパク質構造の予測や研究分野を端から端まで整理するといった作業を自動化する。有料の購読者全員がすぐに利用でき、Anthropic は最大50件のプロジェクトに各3万ドルまでの計算クレジットを助成する AI-for-Science プログラムも併せて発表した。応募は7月15日まで。構造的なシグナルは、差別化される製品が重みではなく、汎用モデルを取り巻くツール統合の層とドメインスキルにあるということだ。 [Northeastern Global News - Anthropic's Claude Science aims to boost drug discovery](https://news.northeastern.edu/2026/06/30/anthropic-claude-science-launch/), [Let's Data Science - Anthropic launches Claude Science AI research workbench](https://letsdatascience.com/news/anthropic-launches-claude-science-ai-research-workbench-85428f54)

- **Flowise の MCP コマンドインジェクション RCE が6月下旬の CVE 波の中心に** — いま最も突かれている AI セキュリティの領域はモデルではなく、オープンソースのエージェント開発ツールだ。6月23日の勧告は CVE-2026-56274 を公表した。これは Flowise の Custom MCP Server 機能（3.1.2 より前）にある CVSS 9.9 の OS コマンドインジェクション欠陥で、コマンドフラグ検証の不備とローカルファイルアクセス制限の正規表現バイパスにより、認証済みユーザーが悪意ある MCP サーバーを設定し、validateCommandFlags のブロックリストをすり抜けて任意のホストコマンドを実行できる。これは6月下旬に AI/ML フレームワークで相次いだ RCE 欠陥の波の一つで、Crawl4AI（CVE-2026-53753）、Langflow、picklescan も同時期に 9.6〜9.8 のスコアを付けられた。Microsoft AutoGen Studio の別のコード実行の弱点は、コンテナ分離が不十分なことに由来し、エージェント生成コードが過剰な権限のままホストプロセスで実行される。共通する筋は MCP サーバーとツール実行の境界にあり、エージェントがツールを呼び出す配管部分に、悪用可能なコードが集まっている。 [NVD - CVE-2026-56274 (Flowise Custom MCP Server command injection, CVSS 9.9)](https://nvd.nist.gov/vuln/detail/CVE-2026-56274), [Threat-Modeling.com - Microsoft AutoGen Studio code execution (June 2026)](https://threat-modeling.com/microsoft-autogen-studio-code-execution-june-2026/)

- **新しい arxiv 研究がエージェントのオーケストレーションと自己進化ラボに焦点** — 6月29日に arXiv へ投稿された新しい研究が、マルチエージェントのオーケストレーションという話題を前へ進めている。Stefanie Rinderle-Ma らによる「Design and Implementation of Agentic Orchestrations and Orchestration of Agents」（2606.31518）は、エージェントをどう構成しオーケストレーションするかを、個々のエージェントに後付けする課題ではなく第一級の工学課題として扱う。同じ日には Yankai Jiang らによる「A Self-Evolving Agentic System for Automated Generation and Execution of Biological Protocols」（2606.31763）も出た。これはラボのプロトコルを生成・実行し、時間とともに適応する自律システムで、Anthropic が6月30日に製品化した実験科学向けエージェントハーネスの方向性を研究側で映したものだ。同日に投稿された植物フェノタイピングのエージェント型フレームワーク（2606.31831）と合わせると、6月29日の一群は、ドメイン特化の科学の場でオーケストレーションと自己進化的な自律性へ文献が収束していることを示す。まさに商用ハーネス製品がいま狙っている領域だ。 [arXiv - Design and Implementation of Agentic Orchestrations and Orchestration of Agents (2606.31518)](https://arxiv.org/abs/2606.31518), [arXiv - A Self-Evolving Agentic System for Automated Generation and Execution of Biological Protocols (2606.31763)](https://arxiv.org/abs/2606.31763)

- **AI Engineer World's Fair は最終日程へ。チップとセキュリティの日程も確定** — 3つのサブトラックにまたがる今後の予定を7月1日時点で更新した。主流の開発／データ系では、サンフランシスコの Moscone West で開かれる AI Engineer World's Fair が最終盤に入っている（7月2日まで。約29トラック、約300登壇者、6,000人超の参加者）。本日は Autoresearch 基調講演と約12の並行トラックがあり、7月2日は Harness Engineering の基調講演で締めくくる。先の予定では GitHub Universe が10月28〜29日に戻り、AWS re:Invent が11月30日〜12月4日にラスベガスで開催される。AI セキュリティ系では、SecurityWeek の AI Risk Summit が8月11〜12日に Ritz-Carlton Half Moon Bay で開かれる。Black Hat USA と AI Village を擁する DEF CON 34 は8月上旬にラスベガスで開催。OWASP Global AppSec USA は11月5〜6日、Zenity の AI Agent Security Summit シリーズは東京・ロンドン・ニューヨークへと続く。AI チップ／ハードウェア系では、AMD の Advancing AI 2026 が7月22〜23日に Moscone、Hot Chips 2026 が8月23〜25日に Stanford、AI Infra Summit が9月15〜17日に Santa Clara で開かれる。 [AI Engineer - World's Fair 2026 (June 29 - July 2, Moscone West, San Francisco)](https://www.ai.engineer/worldsfair/2026), [SecurityWeek - AI Risk Summit, August 11-12, Ritz-Carlton Half Moon Bay](https://www.securityweek.com/securityweek-to-host-ai-risk-summit-august-11-12-at-the-ritz-carlton-half-moon-bay/), [Zenity - AI Agent Security Summit 2026 Global Series](https://zenity.io/resources/events/ai-agent-security-summit-2026)

[news-20260701.md](report/ja/news-20260701.md)

### Predictions check

本日の周期は、Anthropic が6月30日にモデルとハーネスの両面で出荷したものと、悪用可能なコードが実際にどこへ集まっているのかというセキュリティ面とに分かれる。**OpenAI か Google が2026年第4四半期までにエージェント調整済みの中位モデルを出荷する** は、Sonnet 5 が新たにまいた仮説だ。ブラウザやターミナルを扱える有能なエージェントループの1トークンあたりコストを旗艦のおよそ3分の1まで下げることで、自律ループの基準価格が定まる。そのため競合のフロンティア研究所は、100万トークンあたり3ドル未満という競争的な価格で、エージェント作業に調整した中位モデルを投入せざるを得なくなる。同じ立ち上げは、基盤コストの文脈を供給して、継続中の *エージェント型コーディング基盤が2027年第2四半期までにトークン予算と上限を既定で出荷する* 仮説（6月25日）を鋭くする。トークンが安くなれば、走る自律ループの量は増えても、それを制約する必要が減るわけではないからだ。さらに *有益な特性を狙った強化学習が2027年上半期までに本番モデルに載る* 仮説（6月21日）を5分の3で裏づける。Sonnet 5 が、望ましくない挙動の低減とインジェクション耐性の強化を、研究成果ではなく出荷済みの本番モデルに畳み込んでいるからだ。

セキュリティの軸は本日で最も密度の高い裏づけだ。**エージェント開発フレームワークが2027年第1四半期までにサンドボックス化した MCP ツール実行を既定で出荷する** が新仮説だ。6月下旬の一群——ブロックリストを正規表現バイパスで打ち破る Flowise の Custom MCP コマンドインジェクション RCE（CVE-2026-56274、CVSS 9.9）、コンテナ分離不足のせいでエージェント生成コードをホストプロセスで走らせる AutoGen Studio、いずれも 9.6〜9.8 の Crawl4AI・Langflow・picklescan——は、認証済みユーザーを信頼しホスト上で走らせるという同一の失敗様式を共有し、堅牢な既定ひとつでそれを封じられる。同じ一群は、継続中の *マルチテナントのエージェント開発ツールが2027年第1四半期までに 9.0 以上のテナント間認可 CVE を引く* 仮説（6月27日）を最大の5分の5の関連度で裏づけ、Flowise が 9.0 の基準を難なく超えた。さらに休眠していた *エージェントフレームワークの SQL ツールが2027年第1四半期までに読み取り専用を既定とする実行ガードを出荷する* 仮説（6月5日）を5分の3で復活させる。バイパスでブロックリストが破られるのは、まさにフレームワークを許可リストによる最小権限の既定へ向かわせる失敗様式だからだ。この一群はまた、継続中の *インラインの MCP チャネルポリシー執行が2027年第1四半期までにプラットフォームの既定として出荷される*（6月16日）と *コーディングエージェント基盤が2027年第1四半期までに三位一体の能力ゲートを既定で出荷する*（6月28日）の各仮説を動かすインシデント圧力を供給する。

**縦割りのドメイン向けエージェントハーネスが2027年第1四半期までに2番目のフロンティア研究所から出荷される** が3つ目の新仮説で、Claude Science がまいたものだ。差別化される製品が重みではなく、既存モデルに重ねるコネクタとドメインスキルの層である以上、少なくとももう1つのフロンティア研究所か主要プラットフォームが、新モデルで応えるのではなく——科学・法務・金融向けに——自前の縦割りハーネスを出荷すると見込まれる。6月29日のオーケストレーションの arXiv 群（構成を第一級の工学課題として扱う 2606.31518 と、自己進化する生物プロトコルエージェント 2606.31763）は、研究の最前線が同じ統合とオーケストレーションの層へ収束していることを示し、継続中の *エージェントのメタハーネスが2027年上半期までにベンダー横断のエージェント向けポリシー基盤になる*（6月15日）と *オーケストレーションのベンチマークが2027年第1四半期までにレイテンシ開示の列を加える*（6月24日）の各仮説を後押しする。ストリームを横断するパターンは、モデルの採算、ハーネスの価値、オーケストレーション研究、エージェントツールの攻撃面がいずれも同じ層へ向かっていることだ。

[future-prediction-20260701.md](future-prediction/ja/future-prediction-20260701.md)

---

## 2026-06-30

### News

- **ClaudeがAzureホスト型GB300上でMicrosoft FoundryのGAに到達** — AnthropicとMicrosoftは6月29日、Microsoft Foundry内でClaudeをプレビューから一般提供へ移行し、[Claude Opus 4.8とHaiku 4.5をMessages API経由で](https://claude.com/blog/claude-in-microsoft-foundry)プロンプトキャッシュと拡張思考とともに公開した。一般提供される「Azureホスト型」ティアは、企業のID・ネットワーク・課金・ガバナンス管理のもとAzureインフラ上をエンドツーエンドで走り、単一の統合請求書とMicrosoft Enterprise Agreement連携を備える。一方「Anthropicインフラ・ホスト型」ティアはプレビューにとどまる。 [Claude by Anthropic - Claude in Microsoft Foundry is now generally available](https://claude.com/blog/claude-in-microsoft-foundry)

- **vLLM v0.24.0が量子化デフォルトのModel Runner V2を出荷** — 支配的なオープンソース推論サーバーが[vLLM v0.24.0](https://github.com/vllm-project/vllm/releases)をリリースし、256人の貢献者から571件のコミットを取り込んだ。Model Runner V2は量子化モデルをデフォルトでサポートするようになり、多層KVキャッシュ・オフロード経路がGPUメモリを超えてキャッシュを退避するオブジェクトストレージの二次層を追加し、DeepSeek-V4はスパースインデックスキャッシュとプリフィルのチャンク計画パスを得て、DeepEP v2がMoEのエキスパート並列のために統合された。カーネルはswap_abによりSM90 CUTLASS FP8で180-290%の高速化を謳い、Rustフロントエンドは認証・CORS・トークン化エンドポイントと、ツール呼び出しと推論を統一したストリーミングパーサーで成熟した。 [GitHub - vllm-project/vllm Releases (v0.24.0)](https://github.com/vllm-project/vllm/releases)

- **WorldEvolverがエージェント計画のため推論時に世界モデルを進化させる** — 6月29日のarXiv論文[「Self-Evolving World Models for LLM Agent Planning」(Xuan Zhang、Wenxuan Zhang、See-Kiong Ng、Yang Deng著)](https://arxiv.org/abs/2606.30639)は、行動の結果をうまく予測できないために計画を誤るエージェントを標的にする。WorldEvolverフレームワークは、エピソード記憶、予測誤差から明示的なルールを蒸留する意味記憶、計画器が見る前に信頼できない予測をふるい落とす選択的予見を組み合わせる。世界モデルは運用中に進化し続け、コアのエージェントは凍結したまま、再訓練なしで推論時に適応する。著者らは3つの基盤モデルにわたり最高の予測精度と、競合する世界モデルのベースラインを上回るタスク成功率を報告している。 [arXiv - Self-Evolving World Models for LLM Agent Planning (2606.30639)](https://arxiv.org/abs/2606.30639)

- **AI Engineer World's Fairが会期中盤。チップとセキュリティの日程も確定** — [AI Engineer World's Fair](https://www.ai.engineer/worldsfair/2026)はサンフランシスコのMoscone Westで会期中盤を迎えている（6月29日から7月2日。約29トラック、約300人の登壇者、6,000人超の参加者）。7月1日にAutoresearch基調講演、7月2日にHarness Engineeringがある。チップのトラックでは、AMDのAdvancing AI 2026が7月22-23日、[Hot Chips 2026](https://hotchips.org/)がスタンフォードで8月23-25日に開催される。セキュリティでは、SecurityWeekの[AI Risk Summit](https://www.securityweek.com/securityweek-to-host-ai-risk-summit-august-11-12-at-the-ritz-carlton-half-moon-bay/)がRitz-Carlton Half Moon Bayで8月11-12日に、8月初旬のBlack Hat USAとDEF CON 34に先立って開かれる。 [AI Engineer - World's Fair 2026 (June 29 - July 2, Moscone West, San Francisco)](https://www.ai.engineer/worldsfair/2026), [Hot Chips - 2026 symposium (August 23-25, Stanford Memorial Auditorium)](https://hotchips.org/), [SecurityWeek - AI Risk Summit, August 11-12, Ritz-Carlton Half Moon Bay](https://www.securityweek.com/securityweek-to-host-ai-risk-summit-august-11-12-at-the-ritz-carlton-half-moon-bay/)

- **AzureホストのClaudeティアがNVIDIA GB300 NVL72上で稼働** — Foundryローンチの裏にある差別化要因はインフラ層だ。AzureホストのClaudeティアは[Quantum-X800 InfiniBandネットワークを備えたNVIDIA GB300 NVL72システム](https://blogs.nvidia.com/blog/anthropic-nvidia-gb300-blackwell-ultra-microsoft-azure/)上を走る。NVIDIAはGB300の推論効率を総所有コストの削減要因として訴求し、自律的でドメイン特化したエージェント向けにSecure Agent Workspaceのリファレンス設計と組み合わせて展開している。フロンティアラボの旗艦モデルが、ハイパースケーラー自社シリコン上でその自社カタログと並んで座るようになり、ラボのAPIを呼ぶことと自社クラウドテナント内に展開することの隔たりを縮めている。 [NVIDIA Blog - Claude Meets Blackwell Ultra: Anthropic's Models Now Run on NVIDIA GB300 in Azure](https://blogs.nvidia.com/blog/anthropic-nvidia-gb300-blackwell-ultra-microsoft-azure/)

[news-20260630.md](report/ja/news-20260630.md)

### Predictions check

本日のシグナルは、配信と基盤をめぐる物語だ。モデルと利用者の間に位置する層が3つの方面で同時に強化され、一方でチップとセキュリティのイベント日程が、これらの筋が次にどこで対面の場として決着するかを定めた。中心となる裏付けは展開の軸にある。AnthropicとMicrosoftは6月29日、ClaudeをMicrosoft Foundry内でプレビューから一般提供へ移し、プロンプトキャッシュと拡張思考を伴うMessages API経由でClaude Opus 4.8とHaiku 4.5を公開した。これはAzureインフラ上をエンドツーエンドで走り、課金を一本化してEnterprise Agreementと統合された、一般提供のAzureホスト型ティアのもとで提供される。差別化要因はその下のシリコンだ。このティアはQuantum-X800 InfiniBandを備えたNVIDIA GB300 NVL72システム上を走り、NVIDIAはGB300の推論効率を総所有コストの削減要因として打ち出し、統制された領域特化のエージェント向けにSecure Agent Workspaceのリファレンス設計を同梱した。この立ち上げは新仮説「2番目のフロンティアラボが2027年第2四半期までにハイパースケーラー自社シリコン上でファーストパーティ一般提供に到達する」の起点シグナルとなる。フロンティア研究所の旗艦モデルが今やハイパースケーラー自社シリコン上で自社カタログと並ぶようになり、研究所のAPIを呼ぶことと自社クラウドテナント内に展開することの隔たりが縮んだからだ。

オープンソースの配信の軸も並んで動いた。vLLM v0.24.0は256人の貢献者から571件のコミットを取り込み、Model Runner V2が量子化モデルを既定とし、GPUメモリを超えてオブジェクトストレージの二次層へキャッシュを退避させる多層KVキャッシュ・オフロード経路、DeepEP v2のエキスパート並列、180〜290%のSM90 CUTLASS FP8カーネル高速化を加えた。この単一リリースが「量子化デフォルトの推論提供が2027年上半期までにOSS推論の標準になる」という新仮説を支えるとともに、休眠していた2つの仮説を復活させる。「統一的な圧縮KVキャッシュフラグ」仮説（2026-04-30）は関連度4で戻り、階層化KV退避を埋もれたフラグではなく既定経路の機能として製品化していく動きを示す。ただし単一スタックにおける退避の階層化にとどまり、予測が求める複数スタック横断の名前を持つ圧縮のつまみではない。「Reservoirルーティング」仮説（2026-05-27）は関連度3で復活し、DeepEP v2とDeepSeek-V4のルーティング最適化が、MoEルーティングの内部処理が主流サーバーにとって既定経路の関心事であることを裏付ける一方、名前を持つステートフルなルーター状態のプリミティブそれ自体は未搭載のままだ。同じリリースは「単一ノードで256GB未満のフロンティア級オープンウェイト」仮説（2026-06-23）の基盤インフラとしても寄与し、量子化を既定とするロードにKV退避が加わることでメモリ下限を直接引き下げる。

研究の軸はWorldEvolverだ。6月29日のarXiv論文は、推論時に更新されてLLMエージェントの行動と結果の予測を鋭くする自己進化する世界モデルを提案する。エピソード記憶、予測誤差から蒸留した意味規則、信頼できない予測を計画器の手前で落とす選択的予見によってこれを行い、世界モデルは運用中に適応する一方でコアのエージェントは凍結したままだ。論文は3つの基盤モデルにわたり最高の予測精度と、競合ベースラインを上回るタスク成功率を報告し、実行時のメモリ更新を微調整より安価な信頼性の梃子として位置づける。これが新仮説「GitHub Copilotコーディングエージェントが2027年第2四半期までに推論時の自己進化メモリを出荷する」の起点シグナルとなり、「コーディングエージェント基盤が三位一体ゲートを既定で出荷する」仮説（2026-06-28）にもエージェントハーネスの信頼性という主題で接触する。ただしこれは、エージェントの許可された組み合わせをゲートで制約するのではなく、振る舞いの予測品質を改善するものだ。横断するパターンは、フロンティア推論が統制されたハイパースケーラーのシリコンへ統合される一方で、ローカル配信スタックのメモリ下限が下がるという二分化であり、先の予定表、すなわち本日から7月2日までのAI Engineer World's Fair、AMDのAdvancing AI（7月22〜23日）、Hot Chips（8月23〜25日）、8月のAIセキュリティの集まりが、これらの筋が次に決着する会場を定めている。

[future-prediction-20260630.md](future-prediction/ja/future-prediction-20260630.md)

---
