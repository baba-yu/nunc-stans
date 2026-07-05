# Future Prediction Validation Report 2026-06-18

<!-- ai-notice -->
> **ご注意:** 本ページの記事および要約は、Anthropic 社の生成AI「Claude」によって作成されています。

Coverage window: predictions from 2026-06-11 through 2026-06-17 (last 7 days, excluding today). Today's news report is for 2026-06-18.

## Validation findings

| Prediction (summary) | Prediction date | Today's relevance | Evidence summary | Reference link(s) |
|---|---|---|---|---|
| Consumer-GPU coding agents displace cloud-only APIs for 30% of devs by Q3 2026 | 2026-04-26 | 3 | [REVIVED] 休眠中のシグナル（コンシューマー向けGPUのコーディングエージェント、クラウド専用API、ローカル優先の切り替え、API比75%安、ハイブリッドなハーネス、Q4_K_M、SWE-bench Verified）に対するLayer-2の意味的マッチ。Z.aiが6月18日にGLM-5.2を完全公開のMITライセンス重みとして公開完了したことは、この休眠中の予測が追う「コーディングモデルをローカルで自前運用する」という筋立てを直接後押しする。753Bパラメータのmixture-of-expertsモデルはローカルまたはVMへの導入用に一般公開でダウンロードでき、すでに20以上のコーディング環境に組み込まれ、長期コーディング（Terminal-Bench 2.1で81.0、SWE-bench Proで62.1）でクローズドな最前線と競い合いながら、価格性能比では下回らせている。重要なのは、これらのモデルをローカルのハードウェアから遠ざけてきた導入コストを、周辺のスタックが取り除きつつある点だ。vLLM v0.23.0は高速なModel Runner V2の実行経路をdenseモデルの既定に昇格させ、MosaicQuantの統合4ビット方式はFP16に近い精度を報告しており、大規模なMoEを自前で動かすコストを下げている。それこそが、この予測が指す「クラウド専用APIをコンシューマー/ローカルGPUのコーディングエージェントが置き換える」という動きであり、いま最上位の公開重みコーダーと安価な4ビット推論が同時に到来している。ただし採用シェアを示すデータは現れないため、これは30%の開発者という指標ではなく軌道を裏付けるものだ。 | [Let's Data Science - Z.ai Releases GLM-5.2 With 1M-Token Context](https://letsdatascience.com/news/zai-releases-glm-52-with-1m-token-context-a24a7a02), [StableLearn - GLM-5.2 Goes Fully Open: 753B Parameters at 1/6 the Cost](https://stable-learn.com/en/glm-5-2-open-source-release/), [arXiv:2606.15652 - MosaicQuant: Inlier-Outlier Disaggregation for Unified 4-Bit LLM Quantization](https://arxiv.org/abs/2606.15652) |
| US open-weights model crosses 54 on Artificial Analysis Index by Q1 2027 | 2026-06-04 | 2 | [REVIVED] 休眠中のシグナル（公開重みによる最前線との差の縮小、Hugging Faceの公開重み、中国のKimiがスコア54、一桁台の差という動く標的、外部による裁定スコア）に対するLayer-2の意味的マッチ。Z.aiが6月18日にGLM-5.2をMITで完全公開したことは、中国の公開重み勢がベンチマーク性能でクローズドな最前線を押し続けている新たな証拠だ。Terminal-Bench 2.1ではクローズド首位の85.0に対し81.0、SWE-bench ProではGPT-5.5の報告値58.6を上回る62.1で、Code Arenaでは2位に到達した。この予測はArtificial Analysis Indexで54を超える米国の公開重みモデルを指しており、GLM-5.2は米国側そのものではなく、動く標的が照らし合わせる相手としての競合だ。差を詰める中国の公開重み世代が一つ現れるたび、米国のラボが超えるべき水準が引き上げられる。これらの数値はベンダー報告であり、Artificial Analysis Indexそのものではなくコーディング系のベンチによるため、関連性は低く間接的だ。 | [Let's Data Science - Z.ai Releases GLM-5.2 With 1M-Token Context](https://letsdatascience.com/news/zai-releases-glm-52-with-1m-token-context-a24a7a02), [Pandaily - Zhipu AI Open-Sources GLM-5.2 With 1 Million Token Context (MIT)](https://pandaily.com/zhipu-ai-glm-5-dot-2-open-source-mit-jun2026) |
| Kimi K2.7-Code lands independent SWE-bench Verified scores by Q3 2026 | 2026-06-13 | 2 | GLM-5.2の6月18日の完全公開リリースは、この予測の土台にある「ベンダー報告のあと独立検証を待つ」という同じ流れを再現している。Z.aiの目玉となるコーディング数値（Terminal-Bench 2.1で81.0、SWE-bench Proで62.1）はラボ自身の数値であり、報道は独立した再現に加え本番規模のレイテンシとメモリの検証がまだ残っていると明示している。重みはMITのもとで自由にダウンロードでき、すでに20以上のコーディング環境に組み込まれているため、この予測がKimi K2.7-Codeに期待する「コミュニティが公開ハーネスを回す」という同じ力学が、同じ名指しのベンチ（SWE-bench Pro、Terminal-Bench）でここにも当てはまる。これはKimi固有のデータではなく、「公開重みコーダーが独立スコアを待つ」というテーマへの隣接した裏付けだ。この予測の実現にはKimi K2.7-Code固有の第三者による再現可能な結果が必要であり、本日のニュースは別のモデルに関するものだ。 | [Let's Data Science - Z.ai Releases GLM-5.2 With 1M-Token Context](https://letsdatascience.com/news/zai-releases-glm-52-with-1m-token-context-a24a7a02), [Pandaily - Zhipu AI Open-Sources GLM-5.2 With 1 Million Token Context (MIT)](https://pandaily.com/zhipu-ai-glm-5-dot-2-open-source-mit-jun2026) |
| Confidential-GPU attestation lands as a cloud-AI contract term by Q2 2027 | 2026-06-14 | 2 | 本日の将来を見据えるイベントの項目は、Confidential Computing Summit（Linux FoundationとOPAQUE主催）が6月23〜24日にサンフランシスコのMintで開催されることを固めた。基調講演ではAMD、Google、Microsoft、NVIDIAが登壇し、コンフィデンシャルAIとデータ主権を扱う。これは、クラウドベンダー、チップメーカー、企業の購買担当が、コンフィデンシャルコンピューティングのアテステーション標準と調達条件をめぐって集まる、当面で最も主要な場だ。すなわち、コンフィデンシャルGPUのアテステーションが契約上の監査可能なクラウドAIの条件として発表または標準化されうる舞台である。サミットは残り5日に迫り、GLM-5.2の自前運用をめぐる話題も今週の議題に同じデータ主権の懸念を織り込んでいる。コンフィデンシャルGPUのアテステーション契約に関する実質的なニュースは本日到来しないため、シグナルは名指しの契約条件の実現に向けた動きではなく、この場の開催が確定したことだ。 | [Confidential Computing Summit (June 23-24, San Francisco Mint)](https://10times.com/e1k5-s2k3-d3xr) |


## Bridge


On the "Consumer-GPU coding agents displace cloud-only APIs for 30% of devs by Q3 2026" prediction (2026-04-26): ローカルで動作し最前線に近いスコアを出すMITライセンスの完全公開753Bコーダーが、高速化されたvLLMの既定経路とFP16に近い精度をうたう4ビット方式とともに到来したことは、この予測が前提とする仕組みを強める。最上位の公開重みモデルと安価な自前運用が同時に実現すると、開発者をクラウド専用APIに縛りつけてきた導入コストが下がり、ローカルでの置き換えが現実味を帯びる。


On the "US open-weights model crosses 54 on Artificial Analysis Index by Q1 2027" prediction (2026-06-04): 本日の証拠は、米国のマイルストーンそのものではなく、この予測が置かれた競争上の背景を物語る。最前線に近いコーディング数値を出す新たな中国の公開重み世代は、米国の公開重みモデルが超えるべき水準を押し上げ続ける。米国側のデータは何もないまま、動く標的という条件を鋭くするにとどまり、数値はコーディング系ベンチによるベンダー報告で、名指しの指数によるものではない。


On the "Kimi K2.7-Code lands independent SWE-bench Verified scores by Q3 2026" prediction (2026-06-13): 報道が独立した再現待ちと指摘するベンダー報告の数値とともに、ダウンロード可能な重みを出した別の公開重みコーダーは、この予測が期待する道筋をなぞっている。重みが公開され標準ハーネスに組み込まれれば、コミュニティが名指しのベンチを再現する。予測される結末の形はありふれて見えるが、予測が追うモデルの第三者スコアは何も供給しない。


On the "Confidential-GPU attestation lands as a cloud-AI contract term by Q2 2027" prediction (2026-06-14): クラウド、チップ、企業の各勢力がコンフィデンシャルAIとデータ主権を基調講演で扱う、5日後に迫り固まったConfidential Computing Summitは、監査可能なコンフィデンシャルGPUのアテステーション条件が標準化または発表されうる場を確かなものにする。適切な当事者を一堂に集めることで予測される結末への道筋を強めるが、これは場の開催が近づいたことであって、契約上の動きではない。


## Summary (Plain Language)

無料でダウンロードできる中国のAIコーダーが、最高峰の有料モデルに肩を並べた。新しい工夫により、大きなモデルを自前のハードウェアで安く動かせるようになった。あるロボットメーカーが、半導体とクラウドの大手から10億ドル超を調達した。


## Summary of Findings

本日の流れは、公開重みコーディングモデルの競争における一つの転換点が中心で、その周りを、それを重大なものにする推論実行と量子化の進展、そしてクロスストリームの構図を広げる最前線規模のフィジカルAIの調達が取り囲んでいる。Z.ai（旧Zhipu AI）はGLM-5.2の公開重みリリースを完了し、6月13日のサブスクリプション版プレビューから、無制限のMITライセンスのもとで一般公開のHugging Face重みへと移した。これは約7530億パラメータのmixture-of-expertsモデル（トークンあたり約400億がアクティブ）で、100万トークンの文脈をIndexShareの変更によって安定して保持する。ラボによれば、これにより最大長でのトークンあたり計算量が約2.9分の1になるという。長期コーディングでは、Terminal-Bench 2.1でクローズド首位の85.0に対し81.0、SWE-bench ProではGPT-5.5の報告値58.6を上回る62.1を報告し、Code Arenaで2位に到達した。これらの数値はベンダー報告であり、独立した再現と本番規模のレイテンシ・メモリ検証を待っている。また報道は、Z.aiのホスト型APIを経由するルートには中国法域でのデータ取り扱いに関する考慮点が伴うと指摘している。

推論実行と量子化の話題こそが、このリリースをリーダーボードの一行から自前運用の選択肢へと変えるものであり、本日で最も整合性の高いまとまりを成している。vLLMは6月15日にv0.23.0をタグ付けし（408コミット、200人の貢献者）、Model Runner V2の実行経路をLlamaとMistralのdenseモデルの既定に昇格させ、DeepSeek-V4を各バックエンドで成熟させ、ストリーミングのgenerateエンドポイント、動的なLoRA読み込み、ツール呼び出しパーサの拡充によって、RustフロントエンドとレガシーなPythonサーバとの差を縮めた。並行して、6月14日に投稿されたarXivの論文がMosaicQuantを紹介している。これは各重み行列を、denseな4ビットのベースと、スパースな4ビットの残差（ZipperEngineの重なりによって統合される）に分解するもので、FP16に近い精度と、LLaMA3およびQwen3で16ビットのベースラインに対し最大1.24倍の高速化を報告する。GLM-5.2のリリースと併せて読むと、これらは本日の将来予測が拠り所とする導入コストの除去要因だ。最上位の公開重みコーダーと、より安価な4ビット推論が同じ週に到来したのである。この合流は、本日の主要予測（MITまたはApache-2.0の公開重みコーダーが2026年Q4までにTerminal-Bench 2.1で85.0に到達する）と、より鋭い自前運用の姿勢に関する予測（名指しの企業またはツールフレームワークが、データ主権を理由に、外部ホスト型APIではなく公開重みの自前運用を既定として公表することが2027年Q2までに起きる）の根拠となっている。

フィジカルAIの筋は別個に走るが、資本面で韻を踏む。Neura Roboticsは最大14億ドルのシリーズC（6月10日に表面化し、今週も報道を牽引中）を、約70億ドルとされる評価額で開示した。これはマイルストーン連動の上限として組まれ、半導体とクラウドの戦略投資家を直接資本構成に引き入れている。Nvidia、Amazon、Qualcomm、Bosch、Schaeffler、EIB、imec.xpand、Lingotto Horizonに加え、Tether主導のシンジケートも参加し、4NE-1ヒューマノイドの量産を2030年までに数百万台規模へと拡大する資金に充てられる。これは本日のヒューマノイド資金調達の予測（別のフルスタックのヒューマノイドメーカーが、重複する半導体またはクラウドの出資者とともに5億ドル超の戦略ラウンドを2026年Q4までに成立させる）の裏付けとなる。検証の側では、ブリッジの大半が公開重みコーダーのテーマに関する休眠プールの復活だ。コンシューマー向けGPUのコーディングエージェントがクラウドAPIを置き換える行（4月26日）と、米国の公開重みがArtificial Analysis Indexで54を超える行（6月4日）は、どちらもGLM-5.2とより安価な推論によって復活する。Kimi K2.7-Codeが独立したSWE-benchスコアに到達する行（6月13日）は、同じ「ベンダー報告のあと検証待ち」の流れを再現し、コンフィデンシャルGPUのアテステーションを契約条件とする行（6月14日）は、Confidential Computing Summit（6月23〜24日）が近づいたことだけで一歩進む。GLM-5.2の自前運用の話題がその議題に織り込むのと同じデータ主権の筋が、ここにも通っている。


## Relation to My Own Predictions

ユーザーの第一の継続予測（悪意あるローカルLLMがマルウェアとなり、ゼロトラストが根本的な防御策となる）は、その脅威の対象範囲と構造的防御の両軸とも本日はおおむね手つかずで、動きは将来の場に限られる。エージェント型ワークフローのCVE、MCPサーバの隔離テレメトリ、モデルレジストリのサプライチェーン破綻はこの流れに現れないため、この筋が指す兵器化の軸には新たなデータがない。唯一の関連シグナルはインシデントではなくガバナンスの場だ。本日のイベント項目は、Confidential Computing Summitが6月23〜24日にサンフランシスコのMintで開催されることを固めた（Linux FoundationとOPAQUE、基調講演はコンフィデンシャルAIとデータ主権、AMD・Google・Microsoft・NVIDIAが登壇）。これは、この筋が追う署名付きアテステーションの基盤要素と調達ゲートが現れうる、当面で最も主要な場である。隣接する将来の目印として、AI Engineer World's Fairのセキュリティトラックと、6月25日のAI TinkerersによるOffensive Security Demo Nightもある。間接的なテーマ上の橋渡しはある——GLM-5.2の完全公開のMIT重みは、推論がどこで走るのかという、ゼロトラストのアテステーションが最終的に答える問いを鋭くする。自前運用は部分的に信頼境界の判断だからだ。ただし署名付きチェックポイント、テナントごとの能力制限、調達での強制の手段は本日どれも実現しないため、本日は防御の軸を近づく場に据え、脅威の軸は静かなままにする。

ユーザーの第二の継続予測（高度な用途にはクラウドAPI、日常にはローカルLLM、SaaSの値上げが推進要因）は、ここ数週間で最も直接的に土台が補強された。それも、オンデバイスの計算能力が広がるにつれてこの筋が広がると述べるローカルLLMの軸の、まさに核心においてである。GLM-5.2の完全公開のMITリリースは、日常×ローカルという極の教科書的な表れに近い。753Bのmixture-of-expertsモデルがローカルまたは仮想マシンへの導入用に一般公開でダウンロードでき、長期コーディングでクローズドな最前線と競い合い（Terminal-Bench 2.1で81.0、SWE-bench Proで62.1）、すでに20以上のコーディング環境に組み込まれ、ホスト型APIの代替よりも価格性能比で明確に安い。周辺のスタックは導入コストを取り除くことで同じ軸を固める。vLLM v0.23.0は高速なModel Runner V2の経路をdenseモデルの既定に昇格させ、MosaicQuantの統合4ビット方式はFP16に近い精度を報告し、大規模なMoEを自前のハードウェアで動かすメモリとコストを削る——まさに、この筋が、コモディティでプライバシーに敏感な推論を従量課金のエンドポイントから引き離すと見込む、広がるローカル計算能力の表れだ。本日の報道におけるデータ主権の枠組み（Z.aiのホスト型APIを経由するルートには中国法域の考慮があるため、企業は公開重みを自社の境界内に取り込める）は、まさにこの筋が描く「高度×クラウド」対「日常×ローカル」の分かれ目であり、いまやコストの抽象論ではなく、公表された調達上の問いとして到来している。高度×クラウドの軸では、本日は新たなハイパースケーラーの設備投資も、AIアクセラレーターのIPO価格決定も、最前線ラボの提携データもなく、推進要因を直接動かす新たなSaaS APIの値上げも出ていない。そのため本日はローカルの軸を強く補強し、クラウドの軸は静かなままにする——この流れが記録してきた中で、ユーザーの分かれ目を示す最も明快な単日の証拠だ。

ユーザーの第三の継続予測（RL/LLMベースの予測性能の向上）は、実世界導入の一歩前進と土台の隣接が見られ、ガバナンスの軸は本日静かだ。通常は静かな実世界導入の軸は、Neura Roboticsの最大14億ドルのシリーズCによって前進する。これは4NE-1ヒューマノイドの量産を2030年までに数百万台規模へ拡大するもので、最初の量産出荷は2026年後半を目標とし——この軸が指す、OEM側の生産ループの閉鎖とコモディティハードウェアによるヒューマノイド導入へと最前線規模の資本が流れ込み、Nvidia、Amazon、Qualcomm、Boschが資本構成に名を連ねる。ただしヒューマノイドのポリシーLoRAファインチューンや生産ライン記録そのものは出ていない。土台の軸では、MosaicQuantの統合4ビットのパイプラインと、vLLM v0.23.0のModel Runner V2の既定化に加えDeepSeek-V4のMoE成熟が、この軸が大規模で実用的な長期RLに依存する、安価なMoE推論と長文脈の効率を前進させる。とはいえ、ルーター対応のアドバンテージ、超長文脈RLの安定性、MoEバックボーンの訓練レシピは本日どれも実現しない。ガバナンスの軸では、署名付きスキルレジストリの相互運用結果、NISTの非人間アイデンティティ制御プロファイル、形式検証のプレプリントはなく、Confidential Computing Summit（6月23〜24日）、AMDのAdvancing AI（7月23日）、Hot Chips（8月23〜25日）、AI Infra Summit（9月15〜17日）が将来の場として控える。そのため本日は実世界導入が一歩進み、推論の土台を後押しし、ガバナンスは後回しとなる。

