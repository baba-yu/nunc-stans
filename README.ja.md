# news

*Available in: [English](README.md) | [Español](README.es.md) | [Filipino](README.fil.md)*

<!-- ai-notice -->
> **ご注意:** 本ページの記事および要約は、Anthropic 社の生成AI「Claude」によって作成されています。

- [News Explorer (GitHub Pages)](https://baba-yu.github.io/news/) — 未来予測ダッシュボード
- `report/` — 日次ニュースレポート
- `future-prediction/` — 今日のニュースと昨日までの日次ニュースFuture欄の答え合わせ

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

## 2026-06-25

### News

- **OpenAIとBroadcom、OpenAI初の自社推論チップ「Jalapeno」を披露** — OpenAIとBroadcomは6月24日、複数年にわたる共同設計から生まれた最初のチップであり、OpenAI初の自社推論アクセラレータとなる「Jalapeno」を披露した。OpenAIはこれを、学習ではなくLLM推論を軸に設計した「Intelligence Processor」と位置づける。エンジニアリングサンプルはすでに量産目標の動作周波数と消費電力でラボ内のワークロードを実行しており、初期テストでは1ワットあたりの性能が「現行の最先端を大きく上回る」とOpenAIは述べる。データセンターへの初期導入は2026年末までにギガワット規模で行う計画だ。プラットフォームは単体のダイではなくラックスケールで構成され、Broadcomのファブリック「Tomahawk」（最大1.6テラビット/秒）が複数のアクセラレータを相互接続し、Celestiaがサーバーラックを共同設計している。構造的に読み解けば、最大手のフロンティアモデル購入者がいまやハイパースケーラーの定石をなぞり、自社の推論ASICを設計してマーチャントGPUの採算構造から抜け出そうとしている。これにより、OpenAIとBroadcomの名を冠した製品が、Google-BroadcomのTPUやAmazon Trainiumの系譜と並ぶ。1ワットあたりの優位はベンダーの主張であり、まだ第三者によるベンチマーク検証は行われていない。 [SiliconANGLE - OpenAI, Broadcom debut custom Jalapeno chip for AI inference](https://siliconangle.com/2026/06/24/openai-broadcom-debut-custom-jalapeno-chip-llm-inference/), [Neowin - OpenAI and Broadcom unveil Jalapeno, a new AI chip built for LLM inference](https://www.neowin.net/news/openai-and-broadcom-unveil-jalapeo-a-new-ai-chip-built-for-llm-inference/), [Constellation Research - OpenAI, Broadcom unveil first AI inference chip](https://www.constellationr.com/insights/news/openai-broadcom-unveil-first-ai-inference-chip)

- **Gartner：AIコーディングのコストは2028年までに開発者の平均年収を上回る可能性** — Gartnerは6月24日、2028年までにAIコーディングのコストが開発者の平均年収を上回るとの調査ノートを公開した。LLMのトークン消費量の増加と、エージェント型コーディングツールにおける従量課金への移行がその背景にある。引用しやすい具体的な数値こそがニュースだ。ノートが引くGartner Peer Insightsのデータによれば、技術部門のリーダーの23%がすでに開発者1人あたり月額$200〜$500をトークンに費やしており、6%の組織は開発者1人あたり月額$2,000超を支払っている。Gartnerは、コスト急増が最も激しいのは、エージェント駆動のワークフローにおける統制されていない自律性、肥大化したコンテキストウィンドウ、そして使用を最適化するための構造化されたフィードバックの欠如によるものだと警告する。そのうえで、開発者1人あたりのコストの中心となっているのは自律型開発ループのツール群（Cursor、Claude Code、Codex CLIといったエージェント型IDE）だと名指しする。トークンの規律は自然には生まれず、エージェントの大規模展開がその恩恵を食い潰す前に、統制された開発運用モデルが各組織には必要だという立場だ。これはアナリストによる予測であって出荷済みの製品ではないため、2028年という分岐点はあくまで見通しにとどまる。 [Gartner - AI coding costs will surpass the average developer's salary by 2028 as token consumption surges](https://www.gartner.com/en/newsroom/press-releases/2026-06-24-gartner-predicts-ai-coding-costs-will-surpass-average-developer-salary-by-2028-as-token-consumption-surges)

- **いま動向を押さえておきたいAIイベント：今週は開発カンファレンスと攻撃的セキュリティのトラックが開幕、チップとセキュリティの予定は秋まで続く** — 3つのサブトラックすべてにわたる先読みの予定表。今週初めに閉幕したイベント（Automate 2026、6月22〜25日、McCormick Place、AI Tinkerers SF Offensive Security Demo Night、Snowflakeのバーチャル開催のDev Day、いずれも6月25日）は終了し、先読みのリストから外れる。主流の開発/データ：AI Engineer World's FairがMoscone Westを舞台に開催される。公式のAIE World's Fair HackathonはCerebral Valleyとの共催で6月27〜28日、任意参加のNew Engineer Orientationは6月28日、メインプログラムは6月29日から7月2日まで。GitHub Universeは10月28〜29日に戻り、AWS re:Inventは11月30日から12月4日までラスベガスで開催される。AIセキュリティ：Black Hat USAのAI Summitは8月1〜6日にラスベガスでDEF CONのAI Villageと並んで開催され、SecurityWeekのAI Risk SummitはHalf Moon Bayで8月11〜12日に続く。OWASP Global AppSec USAはサンフランシスコで11月5〜6日、ZenityのAI Agent Security Summitシリーズも注視リストに残る。AIチップ/ハードウェア：AMDのAdvancing AI 2026はサンフランシスコのMosconeで7月22〜23日に予定され、Instinct MI400シリーズが焦点になると見られる（基調講演は7月23日）。Hot Chips 2026はStanfordのMemorial Auditoriumで8月23〜25日、AI Infra SummitはSanta Clara Convention Centerで9月15〜17日に開催される。 [TweakTown - AMD announces Advancing AI 2026 event for July (July 22-23, San Francisco)](https://www.tweaktown.com/news/110826/amd-announces-advancing-ai-2026-event-for-july/index.html), [MLQ - AMD sets July date for Advancing AI 2026 flagship event in San Francisco](https://mlq.ai/news/v2/amd-sets-july-date-for-advancing-ai-2026-flagship-event-in-san-francisco/)

[news-20260625.md](report/ja/news-20260625.md)

### Predictions check

本日の証拠群には支配的な軸が一つある。AIを動かす経済性が明示的に価格づけされつつあり、最大手の購入者がそれを生き延びるためにハードウェアと支出を組み替えている。先頭に立つのは、6月24日のOpenAIとBroadcomによるJalapeno公開だ。OpenAI初の自社推論アクセラレータであり、複数年にわたる共同設計から生まれた最初のチップで、学習ではなくLLM推論を軸に設計した「Intelligence Processor」と位置づけられている。エンジニアリングサンプルはすでに量産目標の動作周波数と消費電力でラボ内のワークロードを動かしており、OpenAIは1ワットあたりの性能が「現行の最先端を大きく上回る」と主張する。最初のデータセンター展開は2026年末までにギガワット規模を目標とし、BroadcomのTomahawkファブリック（最大1.6テラビット/秒）で接続され、Celestiaがラックを共同設計する。これは「推論ASICを設計する企業群が2027年上半期までに4社目の自社設計チップを得る」予測（6月25日）の起点の兆候であり、繰り越されている「Corsair級推論シリコンが2027年第3四半期までに名前のあるハイパースケーラー展開を受注する」（6月17日）を、名前付き・日付付きの展開という形で強く裏支えする。一方で、1ワットあたりの優位は、独立したベンチマークが出るまではベンダーの主張にとどまる。

2つ目の数値が明確な筋は、Gartnerの6月24日の研究ノートだ。LLMのトークン消費の増大と、エージェント型ツールにおける従量課金への移行を背景に、2028年までにAIコーディングのコストが開発者の平均年収を上回ると予測する。技術系リーダーの23%がすでに開発者1人あたり月額$200〜$500をトークンに費やし、6%の組織は月額$2,000超を支払っている。Gartnerは、最も急峻なコスト上昇の要因を、統制なき自律性、肥大化したコンテキストウィンドウ、構造化された利用フィードバックの欠如に求め、Cursor、Claude Code、Codex CLIといったエージェント型IDEを1席あたりのコストの中心と名指しする。この診断は製品仕様書のように読め、「エージェント型コーディングプラットフォームが2027年第2四半期までにトークン予算と上限をデフォルトで搭載する」予測（6月25日）の起点の兆候となる。

セキュリティの流れは、新たなCVEではなく調達の軸で前進する。XBOWの自律型攻撃側プラットフォーム（環境を地図化し、脆弱性を探り、多段階の悪用を機械の速度で連鎖させる）が、Accenture Venturesからの戦略投資と、顧客向けに継続的な攻撃側テストを実施するパートナーシップを、NVIDIA NVentures、Samsung Ventures、SentinelOne S Venturesが出資する$35MのシリーズC追加調達の上に獲得した。この資金調達とパートナーシップの形は、「自律型ペンテストエージェントが2026年第4四半期までに名前のあるマネージドティアとして出荷される」予測（6月25日）の源となる兆候であり、繰り越されている「自律型ペンテストベンダーが2027年第1四半期までに名前のある企業/政府との取引を獲得する」（6月22日）も裏支えする。今週のAI Tinkerers SF Offensive Security Demo Nightと、Black Hat USAのAI Summit（8月1〜6日）、DEF CONのAI Villageが、秋の調達時期を前に企業バイヤー層を舞台に上げる。横断する構図はこうだ。推論コストがいまや統制の中心であり、基盤層では独自シリコンで、開発者ツール層では支出統制で、そして監査済みの攻撃側ツールが調達可能なデリバリースタックへ移ることで応えられている。

[future-prediction-20260625.md](future-prediction/ja/future-prediction-20260625.md)

---

## 2026-06-24

### News

- **Sakanaのfugu Ultraオーケストレーションモデル、最初の独立した現実検証に直面：ベンチマーク同等の主張が30分のコーディング実行と衝突** — Sakana AIの新モデルfuguは6月22日に公開され、単一のOpenAI互換エンドポイントとして提供される。fugu自身が、差し替え可能なフロンティアLLM群にまたがってルーティング・委任・検証・統合を行うよう訓練された言語モデルであり、自分自身のインスタンスへの再帰呼び出しも行う。設計はICLR 2026の2本の論文TRINITY（軽量な調整役を進化的に育てたもの）とConductor（自然言語によるオーケストレーションを強化学習で身につけたもの）を土台とし、最上位のfugu Ultraティアは、フロンティアモデルを一から訓練することなく、自社が公表したコーディング・科学・推論の各表でAnthropicのFable 5やMythosと同等だとうたわれている。今サイクルの新たな展開は、公開から48時間以内に出た最初の独立した反証だ。WhartonのEthan Mollickがfugu Ultraを自身の標準的なシェーダーおよびインタラクティブシーンのコーディングテストで試し、「とてつもなく遅い」、典型的な所要時間は数分ではなく約30分におよび、出来栄えは「まずまず」だが実際にはFableに及ばないと報告した。公表された同等性スコアはいまだ独立に再現されていない。これが示す兆候は、学習型のマルチモデルオーケストレーションは紙の上ではフロンティアの品質に迫れる一方で、ベンチマーク表が表に出さない大きな遅延の負担を払っている、ということだ。これはまさに、ルーター型モデルの構成が実用に足るために埋めねばならない差である。 [MarkTechPost - Sakana AI launches Sakana Fugu, an orchestration model that routes tasks across a swappable pool of frontier LLMs](https://www.marktechpost.com/2026/06/22/sakana-ai-launches-sakana-fugu-an-orchestration-model-that-routes-tasks-across-a-swappable-pool-of-frontier-llms/), [Tech Times - AI orchestrator Sakana Fugu claims Fable 5 parity; real-world tests reveal 30-minute waits](https://www.techtimes.com/articles/318968/20260624/ai-orchestrator-sakana-fugu-claims-fable-5-parity-real-world-tests-reveal-30-minute-waits.htm)

- **MicronがAnthropicのSeries Hに参加、HBM3社すべてが一つのフロンティアラボのメモリ供給網の中に** — MicronとAnthropicは6月22日に戦略的提携を発表し、4つの要素を束ねた。性能・エネルギー効率・トークン経済性を狙うメモリ・ストレージの協調設計、Micronのデータセンター向け製品からのHBM・DRAM・SSDにまたがる複数年の供給枠、Micronのエンジニアリング・製造・業務部門全体へのClaude社内展開、そしてMicronによるAnthropicのSeries Hへの戦略出資である。ラウンド自体、約9,650億ドルのポストマネー評価額での650億ドル調達は5月28日に完了したが、新たな事実はMicronの参加であり、これにより世界のHBM供給3社、SamsungとSK HynixにMicronを加えた3社が、そろってSeries Hの参加者かつAnthropicのインフラパートナーとなった。他のどのフロンティアラボも現時点で持たない結びつきだ。供給契約の金額もMicronの出資規模も開示されておらず、出回っている具体的な金額はいずれも未確認である。構造的に読み解けば、フロンティアラボは2026年Q4に見込まれる新規上場を前に、単なる発注契約ではなく出資を通じて高帯域メモリの容量を押さえつつあり、AIモデルのロードマップとメモリ製造の供給網との結びつきを強めている。 [Digital Applied - Micron and Anthropic strike a strategic AI infrastructure deal](https://www.digitalapplied.com/blog/micron-anthropic-strategic-infrastructure-agreement-2026)

- **物理AIがAutomate 2026で工場の現場に到達：Cobotの第2世代Proxieが実稼働実績とともにロボット上での推論を出荷** — Collaborative Roboticsは6月22日、Automate 2026で第2世代Proxieを公開し、やるべき仕事を自ら見極めて、ソフトウェア連携も人による指示も一切なしにそれをこなす汎用の移動型協働ロボットと位置づけた。新たな成果は、第2世代がタスク推論を完全にロボット上へ移し、中核処理にクラウドを必要としない点だ。作業空間を人の目の高さで捉え、作業を計画・段取りし、各動作を音声で告げるScoutSenseセンサー群と組み合わされている。ロボットは最大1,500ポンドのカートを動かし、最大200ポンドを垂直に持ち上げ、月額5,000ドルから提供される。Cobotは発表を第1世代の具体的な実稼働実績で裏づけた。実運用で記録された12,627時間、運搬した4,000万ポンド超の資材、病院・製造・物流の現場で1日16時間シフトをこなして削減した1,700万歩超の人手である。今回の発表は、明示的なプログラミングではなく実演によって訓練されるロボット、すなわち物理AIを主要テーマとするより広いAutomate 2026展（6月22～25日、McCormick Place）の中で行われた。初開催となるNVIDIA協賛のHumanoid Robot Pavilionが20を超えるヒューマノイドのプラットフォームを集め、業界がヒューマノイドの研究から商用展開へと移りつつあることを示している。 [Robotics Tomorrow - Cobot announces second-generation Proxie, bringing production-tested physical AI to real operations](https://www.roboticstomorrow.com/news/2026/06/22/cobot-announces-second-generation-proxie-bringing-production-tested-physical-ai-to-real-operations/26756/), [Packaging World - Physical AI dominates Automate 2026's opening day while humanoids steal the show floor](https://www.packworld.com/leaders-new/machinery/robotics/article/22969383/physical-ai-dominates-automate-2026s-opening-day-while-humanoids-steal-the-show-floor)

- **今すぐ計画に入れたいAIイベント：攻撃的セキュリティと開発者カンファレンスのトラックが今週開幕し、チップとセキュリティのカレンダーは秋まで続く** — 3つのサブトラックすべてにまたがる先を見据えたカレンダーで、最も近い項目は数日先だ（6月23～24日にSF Mintで開かれるConfidential Computing Summitは本日閉幕し、先行リストから外れる）。AIセキュリティ：AI Tinkerers San Franciscoが6月25日にOffensive Security Demo Nightを開催し、協賛のXBOWの後押しで自律ペンテストエージェントの実演を行う。さらに先では、Black Hat USAのAI Summitが8月1～6日にラスベガスでDEF CONのAI Villageと並行して開かれ、SecurityWeekのAI Risk Summitが8月11～12日にHalf Moon Bayで続き、OWASP Global AppSec USAが11月5～6日にサンフランシスコで、ZenityのAI Agent Security Summitシリーズも引き続き注視リストに残る。主流の開発/データ：Snowflakeが6月25日にバーチャルのDev Dayを開催し（著名講演2本に加え、エージェント型AIの実践ラボ）、AI Engineer World's FairがMoscone Westを舞台に6月29日から7月2日まで本編を行い（任意のNew Engineer Orientationは6月28日）、これに先立ち公式のAIE World's Fair HackathonがCerebral Valleyと6月27～28日に開かれる。GitHub Universeは10月28～29日に戻り、AWS re:Inventは11月30日から12月4日までラスベガスで開かれる。AIチップ/ハードウェア：Automate 2026は現在開催中で（6月22～25日、McCormick Place）、初開催のNVIDIA協賛Humanoid Robot Pavilionと6月23～24日のHumanoid Robot Forumを擁する。AMDのAdvancing AI 2026は7月22～23日にMosconeで予定され（Instinct MI400シリーズが焦点と見られ、基調講演は7月23日）、Hot Chips 2026は8月23～25日にStanfordで、AI Infra Summitは9月15～17日にSanta Clara Convention Centerで開かれる。 [AI Engineer World's Fair 2026 schedule (June 29-July 2, Moscone West)](https://www.ai.engineer/worldsfair/schedule), [Automate - Humanoid Robot Pavilion sponsored by NVIDIA (June 22-25, 2026)](https://www.automateshow.com/education-networking/humanoid-robot-pavilion)

[news-20260624.md](report/ja/news-20260624.md)

### Predictions check

本日の証拠群は、一本の筋でまとまっている。フロンティア AI の基盤が三つの異なる層で同時に固まりつつあり、各層は今や、宣伝用の表が認めるよりも厳しい現実の単位で測られている。最も明快な例は Sakana AI の Fugu だ。6月22日に公開された、モデルとしてのオーケストレーションであり、これ自体が一つの言語モデルで、入れ替え可能なフロンティア LLM 群に対してタスクの振り分け・委譲・検証・統合を行い、自身のインスタンスを再帰的に呼び出すよう訓練されている。基盤は ICLR 2026 の TRINITY と Conductor の論文で、Sakana 自前のコーディングと推論の各表で Anthropic Fable 5 と Mythos に並ぶと打ち出された。新たな動きは48時間以内に現れた最初の独立した現実検証だ。ウォートン校の Ethan Mollick が標準的なシェーダーとインタラクティブ・シーンのコーディングテストで Fugu Ultra を走らせたところ、とてつもなく遅く、出力はかろうじて悪くない程度なのに実行は約30分かかり、並列スコアは再現されないままだった。これが「Orchestration benchmarks add a latency-disclosure column by Q1 2027」予測（6月24日）の出発点となる兆候である。学習されたマルチモデルの振り分けは、紙の上ではフロンティア品質に近づきうる一方で、精度のみのリーダーボードには決して表れない実時間の代償を払う。

メモリ層は同じ日に固まった。6月22日の Micron による Anthropic との戦略的提携は、メモリとストレージの共同設計、複数年の HBM/DRAM/SSD 供給枠、社内での Claude 導入、そして約9,650億ドルのポストマネー評価で5月28日に完了した650億ドルのシリーズ H への戦略的出資を束ねている。新たな構造的事実は、Micron の参入により Anthropic が世界の HBM 三大供給元すべて、すなわち Micron、Samsung、SK Hynix と資本面で結びついたことだ。他のどのフロンティア研究所も持たない立場であり、「OpenAI locks equity-coupled HBM allocation with a memory maker by Q4 2026」予測（6月24日）の直接の出発点となる。研究所は、Q4 2026 に見込まれるベンダー上場を前に、メモリを購買から争奪される所有権益へと転換しつつある。供給枠の額も出資額も開示されなかったため、競争上の雛形は確立されたが、ライバルの応答はまだ記録に残っていない。

フィジカル層は Automate 2026（6月22～25日、McCormick Place）で固まった。主たるテーマはフィジカル AI で、初めて NVIDIA がスポンサーを務める Humanoid Robot Pavilion は20を超えるプラットフォームを集める。Collaborative Robotics の第二世代 Proxie は、中核となる実行ではクラウドに依存せずタスク推論を完全にロボット側で行い、月額5,000ドルで提供され、定量的な第一世代の実績を発表の拠り所とした。病院・製造・物流にわたる12,627時間の稼働、4,000万ポンド超の運搬、1,700万歩の人間の歩行節約である。このサブスク料金・監査済み稼働時間という枠組みが「General-purpose mobile cobots cross 100K production-operation hours by H1 2027」予測（6月24日）の源となる兆候であり、引き継がれた「Captive in-house fleets will lead paid humanoid deployment」（6月22日）と復活した「Automaker-built humanoid programs add a second high-volume entrant」（6月7日）を、名指しの基準ではなくエコシステムの広がりの面で相互に支える。今週のイベント・カレンダーが連結組織を供給する。6月25日の XBOW が後ろ盾となる Offensive Security Demo Night は、8月の Black Hat の AI Summit と DEF CON の AI Village に先立って自律型ペンテスト・ツールを公の舞台に置き続け、自律型ペンテストの名指し取引（6月22日）と AWS Continuum のエクスプロイト実証（6月21日）の見立てに、契約ではなく可視性の支えを与える。一方、AMD の Advancing AI、Hot Chips、AI Infra Summit の連なりは、推論シリコン展開の注視（6月17日）をカレンダー上の文脈としてのみ枠づける。

[future-prediction-20260624.md](future-prediction/ja/future-prediction-20260624.md)

---
