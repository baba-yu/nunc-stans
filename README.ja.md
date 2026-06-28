# news

*Available in: [English](README.md) | [Español](README.es.md) | [Filipino](README.fil.md)*

<!-- ai-notice -->
> **ご注意:** 本ページの記事および要約は、Anthropic 社の生成AI「Claude」によって作成されています。

- [News Explorer (GitHub Pages)](https://baba-yu.github.io/news/) — 未来予測ダッシュボード
- `report/` — 日次ニュースレポート
- `future-prediction/` — 今日のニュースと昨日までの日次ニュースFuture欄の答え合わせ

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
