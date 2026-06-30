# news

*Available in: [English](README.md) | [Español](README.es.md) | [Filipino](README.fil.md)*

<!-- ai-notice -->
> **ご注意:** 本ページの記事および要約は、Anthropic 社の生成AI「Claude」によって作成されています。

- [News Explorer (GitHub Pages)](https://baba-yu.github.io/news/) — 未来予測ダッシュボード
- `report/` — 日次ニュースレポート
- `future-prediction/` — 今日のニュースと昨日までの日次ニュースFuture欄の答え合わせ

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

## 2026-06-29

### News

- **Micron、売上を414.5億ドルへと4倍に伸ばし、2026年のHBMをすべて完売** — 6月25日に報告されたMicronの2026会計年度第3四半期の決算は、AI構築の動きをメモリ供給の物語へと変える。売上高414.6億ドルは前年同期の93.0億ドルからおよそ346%増で、コンセンサスのおよそ352.5億ドルを大きく上回り、第4四半期はおよそ500億ドルと見込まれる。構造的なシグナルは、NvidiaとAMDのアクセラレータに供給される広帯域メモリ側にある。CEOのSanjay Mehrotra氏は、MicronがHBM需要の半分から3分の2しか満たせず、2026年の供給はすべて複数年契約のもとで完売したと述べた。HBM4の売上は10億ドルを超え、HBM3Eのおよそ2倍の速さで立ち上がっている。さらに当四半期には、最低契約売上およそ1000億ドルと顧客からの前払い金220億ドルを固定する16件のテイク・オア・ペイ型の戦略的顧客契約が含まれた。読み取れるのは、AI計算が今やGPUだけでなくメモリによっても律速されているということだ。 [AI Weekly - Micron Q3 2026: Revenue Quadruples to $42B, HBM Supply Sold Out](https://aiweekly.co/alerts/micron-q3-2026-revenue-quadruples-to-42b-hbm-supply-sold-out), [Micron Investor Relations - Fiscal Q3 2026 Earnings Call Prepared Remarks](https://investors.micron.com/static-files/631b1a32-5537-46ae-8f40-82e42fc79dfe)

- **Qualcomm、2028年向けの最初のDragonfly CPU顧客としてMetaを名指し** — 6月24日、Qualcommはフルなデータセンター向けロードマップを公開し、サーバーシリコンの売り込みに初めて名指しのハイパースケーラーを結びつけた。戦略的で複数世代にわたる契約のもと、Metaは当該部品が2028年に商用提供を迎えた際、Qualcomm Dragonfly C1000 CPUを次世代サーバー群の動力源として採用する計画だ。ロードマップは、Dragonfly C1000 CPU（既存のサーバーCPUに対しワットあたり性能が2倍超と主張）、Dragonfly AI300推論アクセラレータ（現行のGPUアーキテクチャに対しワットあたり性能が4～8倍と主張、2028年にサンプル出荷）、そしてAI200に対し最大54倍の帯域幅向上をもたらすとQualcommが述べる新たなHigh Bandwidth Computeメモリ階層にまたがり、Lenovo、Supermicro、Micron、SK hynix、Samsungを含む35社以上のエコシステムパートナーを擁する。位置づけは学習向けの取り組みではなく、明確にNvidiaへの推論経済性の攻勢だ。難点は時間軸で、最初の商用サンプル出荷はまだ2年先だ。 [Qualcomm - Qualcomm Unveils Comprehensive Data Center Roadmap for the Agentic AI Era with New Dragonfly Portfolio (June 24 2026)](https://www.qualcomm.com/news/releases/2026/06/qualcomm-unveils-comprehensive-data-center-roadmap-for-the-agent)

- **Gartner、2026年のAIエージェントソフトウェアを2065億ドル・139%増と見積もる** — Gartnerの最新予測は、AIエージェントソフトウェアの支出を2026年におよそ2065億ドルと見積もる——2025年の864億ドルからおよそ139%増で、2027年には3763億ドルに向かう見通し——これはAI支出全体の47%の拡大のほぼ3倍の伸び率であり、すでに活況のある市場のなかでも、目的特化型のエージェントソフトウェアを企業向けソフトウェアの最も急成長する区分にしている。Gartnerはこの楽観論に、エージェント型AIプロジェクトの40%超が2027年末までに中止されると予想する、という従来からの注意を添えており、支出曲線と中止リスクがともに上昇している。シグナルは、エージェント型ソフトウェアが一般的なAI支出から独立した独自の項目となり、目的特化型ツールという狭い区分に予算と精査が集中しているということだ。 [Gartner - Gartner Forecasts Worldwide AI Spending to Grow 47% in 2026](https://www.gartner.com/en/newsroom/press-releases/2026-05-19-gartner-forecasts-worldwide-ai-spending-to-grow-47-percent-in-2026)

- **HCLTech、2.34億ドルのクローズを主導し、15億ドルのソブリンAIユニコーンSarvamを生み出す** — ソブリンAIの命題は今週、具体的なデータ点を得た。HCLTechは、Sarvamの3億ドルのシリーズBの2.34億ドルのファーストクローズを、15億ドルの評価額で主導したと認めた——HCLTech自身の1.5億ドルの出資でおよそ10.5%の株式を取得——インド最新のAIユニコーンを生み出した。この資金調達は、コーディング、エージェント、サイバーセキュリティのワークロードを標的とし、国内で構築・ホスト・統治される最先端モデルの計算と学習に充てられる。Gartnerの2065億ドルのエージェント支出予測と照らし合わせると、この取引は、エージェント支出の波が今や米国の最先端ラボだけでなく国家代表のモデル開発企業をも資金の流れへと引き込んでいることを示しており、純粋なVCではなく企業向けITサービスの大手が出資を支えている。 [HCLTech - Sarvam raises $234 million in first close of $300 million Series B at $1.5 billion valuation](https://www.hcltech.com/press-releases/sarvam-raises-234-million-first-close-300-million-series-b-15-billion-valuation)

- **AI World's Fairが本日開幕、夏のチップ・セキュリティの日程も確定** — 今後の予定は3つのサブトラックにまたがる。主流の開発／データ系では、AI Engineer World's Fairの本編プログラムがサンフランシスコのMoscone Westで6月29日から7月2日まで開催され（およそ29トラック、およそ300名の講演者、6000名超の参加者）、本日Coding Agentsの基調講演と展示で開幕し、続いてAutoresearch（7月1日）とHarness Engineering（7月2日）の基調講演が行われる。さらに先には、GitHub Universeが10月28～29日に戻り、AWS re:Inventが11月30日から12月4日まで開催される。AIセキュリティ系では、SecurityWeekのAI Risk Summitが8月11～12日にハーフムーンベイのRitz-Carltonで、Black Hat USA 2026とAI Villageを擁するDEF CON 34が8月初旬にラスベガスで、OWASP Global AppSec USAが11月5～6日にサンフランシスコで開催され、ZenityのAI Agent Security Summitシリーズも引き続き注視対象だ。AIチップ／ハードウェア系では、AMDのAdvancing AI 2026が7月22～23日にMosconeで、Hot Chips 2026が8月23～25日にスタンフォードで、AI Infra Summitが9月15～17日にサンタクララで開催される。 [AI Engineer - World's Fair 2026 (main program June 29 - July 2, Moscone West, San Francisco)](https://www.ai.engineer/worldsfair/2026), [SecurityWeek - AI Risk Summit, August 11-12, Ritz-Carlton Half Moon Bay](https://www.securityweek.com/securityweek-to-host-ai-risk-summit-august-11-12-at-the-ritz-carlton-half-moon-bay/), [Hot Chips - 2026 symposium (August 23-25, Stanford Memorial Auditorium)](https://hotchips.org/)

[news-20260629.md](report/ja/news-20260629.md)

### Predictions check

本日のシグナルは、AI増強がGPUの物語から、メモリと資金の物語へと固まったことだ。チップ採算と資本の流れという2つの軸が、それぞれ新たな仮説の起点シグナルを供給している。メモリ階層では、Micronの2026会計年度第3四半期の決算(6月25日報道)が、増強全体を誤った軸で律速されたものとして描き直す。売上高は414.6億ドル、前年同期比およそ346%増で、約352.5億ドルの市場予想を大きく上回り、5四半期連続の過去最高となった。第4四半期の見通しは約500億ドルだ。構造的なシグナルはHBMの希少性だ。Sanjay Mehrotra最高経営責任者はMicronが需要の半分から3分の2しか満たせないと語り、2026年の供給はすべて複数年契約のもとで完売し、HBM4の売上は10億ドルを超えHBM3Eのおよそ2倍の速さで立ち上がり、当四半期には最低契約売上高にしておよそ1000億ドルを固定する16件のtake-or-pay型の戦略的顧客契約に加え前払いの顧客資金220億ドルを計上した。この完売の供給開示が、「HBM allocation becomes a named binding cap in a vendor disclosure by Q2 2027」という新仮説の起点シグナルとなり、最高の5/5の関連度を持つ。本日は供給側の希少性を供給したが、買い手側のアクセラレータ・ベンダーやハイパースケーラーがHBMを自社出荷の律速上限として名指しした事実はまだない。同じ決算は、引き継いだ「OpenAI locks equity-coupled HBM allocation」仮説(6月24日)を直接前へ進める。take-or-payと前払い資金の型がいまや16の戦略的顧客にわたって標準だ。ただし名指しのフロンティア研究所の相手や出資連動は開示されていない。さらに同じ決算は、「hyperscaler details AI-buildout debt financing」仮説(6月13日)を供給側から後押しする。ここでは、ハイパースケーラーが自社の説明会で社債を名指しするのではなく、顧客が資金を前払いする形だ。

シリコン層では、Qualcommの6月24日のDragonflyロードマップが、マーチャント型の非Nvidiaスタックに初めて名指しのハイパースケーラーを結びつける。複数世代にわたる戦略的合意のもと、Metaは、2028年の商用提供開始時にDragonfly C1000 CPU(既存のサーバーCPU比で2倍超の電力あたり性能をうたう)を次世代サーバー群に採用する計画だ。あわせて、Dragonfly AI300推論アクセラレータ(現行GPUアーキテクチャ比で4〜8倍の電力あたり性能をうたい、2028年サンプル出荷)と、AI200比で最大54倍の帯域向上をうたうHigh Bandwidth Computeのメモリ階層も並び、Lenovo・Supermicro・Micron・SK hynix・Samsungを含む35社超のエコシステムパートナーが支える。競争上の契機は仕様ではなく名指しの顧客への言及だ。いったん1社の事業者がNvidiaへの推論採算上の攻勢を支持すると記録に残れば、その論拠は同業に裏付けられた調達シグナルとなり、競合が応えざるを得なくなる。これが「second hyperscaler names non-Nvidia data-center inference silicon by Q4 2027」という新仮説を5/5で生み、隔たりは第2の最上位事業者と、Qualcommの2年というサンプル出荷の遅れだ。同じ案件は、引き継いだ「Corsair-class inference silicon books a named hyperscaler deployment」仮説(6月17日)に合致し、「inference-ASIC cohort fourth-named-buyer」仮説(6月25日)が名指しの部品と買い手を加え続けるのを保ち、「rival accelerator vendor buys a CUDA-agnostic inference compiler」仮説(6月28日)を補強する。昨日のModular/コンパイラの半分と本日のハードウェアの半分は、同じフルスタック攻勢の両面だ。ただし競合の対抗買収はまだ表に出ていない。

資本の流れの層では、GartnerがAIエージェント向けソフトウェア支出を2026年に約2065億ドルと見積もる。2025年の864億ドルからおよそ139%増、2027年には3763億ドルに向かい、AI支出全体の47%成長のほぼ3倍にあたる。これは専用のエージェント向けソフトウェアを企業向けソフトウェアで最速成長の領域とするものだが、2027年末までにエージェント型AIプロジェクトの40%超が中止されるという従来からの警告と対になり、支出と中止の曲線がともに上がる。対応する供給側のデータ点が、HCLTechがSarvamの3億ドルのシリーズBについて2億3400万ドルのファーストクローズを15億ドルの評価額で主導したことだ。HCLTech自身が1.5億ドルを投じて約10.5%の持ち分を取得し、コーディング・エージェント・サイバーセキュリティ向けのフロンティアモデルを国内で構築・ホスト・統治するインドの最新AIユニコーンを誕生させた。この組み合わせが「sovereign-AI national champion crosses unicorn valuation by Q4 2026」という新仮説の起点シグナルとなり、5/5の関連度を持つ。西側VCではなく企業向けITサービスの戦略的投資家が軸であり、隔たりは、同じ国内戦略的出資の構造で別の市場における第2の主権チャンピオンが現れることだ。横断的なパターンは、計算の希少性・マーチャント型シリコンの競争・国産チャンピオンの資本が本日同じ日に固まったことであり、一方で先の予定表、すなわち本日から7月2日まで開催のAI Engineer World's Fair、AMDのAdvancing AI(7月22〜23日)、Hot Chips(8月23〜25日)、8月のAIセキュリティの集まり(AI Risk Summit、Black Hat、DEF CON)が、これらの筋が次に決着する会場を定めている。

[future-prediction-20260629.md](future-prediction/ja/future-prediction-20260629.md)

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
