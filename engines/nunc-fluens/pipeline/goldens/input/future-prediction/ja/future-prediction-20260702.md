# Future Prediction Validation Report 2026-07-02

<!-- ai-notice -->
> **ご注意:** 本ページの記事および要約は、Anthropic 社の生成AI「Claude」によって作成されています。

Coverage window: predictions from 2026-06-25 through 2026-07-01 (last 7 days, excluding today). Today's news report is for 2026-07-02.

## Validation findings

| Prediction (summary) | Prediction date | Today's relevance | Evidence summary | Reference link(s) |
|---|---|---|---|---|
| Multi-tenant agent builders draw a 9.0+ cross-tenant authz CVE by Q1 2027 | 2026-06-27 | 5 | 本日のニュースはこの予測をそのまま現実化した。Sysdig は CVE-2026-55255 の実環境での悪用を初めて確認したと報告した。これは Langflow の /api/v1/responses エンドポイントに存在する CVSS 9.9 の安全でない直接オブジェクト参照(IDOR)であり、認証済みユーザーが被害者のフロー ID を指定するだけで別テナントのフローを実行できてしまう。修正は Langflow 1.9.2 で行われた。これはマルチテナント型のエージェントビルダーにおける、9.0 超のテナント間認可 CVE そのものであり、しかも単に公表されただけでなく、実際に武器化されている。Sysdig はさらに、この IDOR がより古い 9.8 の RCE より先に狙われた点を指摘し、素の CVSS スコアは攻撃者が実際に手を伸ばす対象をうまく予測できないと述べている。この指摘は、エージェントビルダーの認可境界こそが現に狙われている攻撃対象領域だという予測の見立てを裏付けている。 | [NVD - CVE-2026-55255 Detail](https://nvd.nist.gov/vuln/detail/CVE-2026-55255), [Sysdig - Understanding Langflow CVE-2026-55255 and why higher-CVSS vulnerabilities aren't always the most exploited](https://www.sysdig.com/blog/understanding-langflow-cve-2026-55255-and-why-higher-cvss-vulnerabilities-arent-always-the-most-exploited) |
| AMD Instinct MI400 launches with a named ship, memory, or rack spec by Q3 2026 | 2026-06-27 | 5 | AMD はサンフランシスコの Moscone で 7 月 22〜23 日に開催する Advancing AI 2026 を正式に告知した。ここで MI400 シリーズ(TSMC 2nm 上の CDNA 5)と Helios ラックスケールシステムの詳細を明らかにする予定で、報道は MI350 世代の 2 倍を超えるメモリ帯域を指し示している。これにより予測は、具体的なメモリ仕様と、確定した公開日を伴う具体的なラックシステムを得ることになり、MI400 はロードマップ上の存在から公開日程の決まった対象へと進んだ。確定した日付と Helios というラックの名称が、複数の観点で同時に予測を満たしている。 | [AMD - Advancing AI 2026 press release](https://ir.amd.com/news-events/press-releases/detail/1283/amd-announces-advancing-ai-2026), [Introl - The AI Memory Supercycle: HBM 2026](https://introl.com/blog/ai-memory-supercycle-hbm-2026) |
| HBM allocation becomes a named binding cap in a vendor disclosure by Q2 2027 | 2026-06-29 | 4 | 本日の AMD 関連報道は、次のアクセラレータ世代を演算主導ではなくメモリ主導として位置づけている。高帯域メモリの供給は 2026 年暦年を通じて完売状態が続き、2028 年までに約 $100B と見込まれる市場規模に対して不足しており、長文脈推論による KV キャッシュの増大が買い手をより大きな HBM プールへと向かわせている、というものだ。これは、HBM の割り当てがベンダーの開示において具体的な拘束条件になるという予測を前進させる、供給側の希少性を示す明確なシグナルである。ただし、割り当ての上限を提出書類で名指しする具体的なベンダー開示までには至っておらず、予測を完全に実現するのではなく前進させる段階にとどまる。 | [Introl - The AI Memory Supercycle: HBM 2026](https://introl.com/blog/ai-memory-supercycle-hbm-2026), [AMD - Advancing AI 2026 press release](https://ir.amd.com/news-events/press-releases/detail/1283/amd-announces-advancing-ai-2026) |
| Frontier-class open-weight LLM runs single-node under 256GB by Q4 2026 | 2026-06-23 | 4 | Mistral は Apache 2.0 ライセンスで Mistral 3 のオープンウェイトファミリーを公開した。総パラメータ 675B のうち有効 41B のスパース MoE である Mistral Large 3 に加え、エージェント的なツール利用向けに調整した 14B・8B・3B の 3 つの密モデルを組み合わせている。小型の密モデルは Ollama・llama.cpp・MLX で無理なく動く規模で、フロンティア級のオープンウェイト能力を単一ノード・256GB 未満の範囲に十分収めている。一方、MoE の旗艦モデルはサーバー展開向けに vLLM と SGLang を狙っている。これは小型密モデルの側で予測を直接前進させるが、総 675B の MoE 旗艦モデルは依然として単一ノード・256GB 未満の基準を超えており、実現は部分的にとどまる。 | [Mistral AI - Introducing Mistral 3](https://mistral.ai/news/mistral-3/) |
| Quantized-by-default serving lands as the OSS inference baseline by H1 2027 | 2026-06-30 | 4 | Mistral 3 の公開では、Large 3 の MoE を vLLM と SGLang 向けに調整して提供する一方、14B・8B・3B の密モデルを公開時点で Ollama・llama.cpp・MLX 向けに合わせている。報道は、公開と同時にそろえるサーバー実行環境とローカル実行環境の両対応を、オープンウェイト公開における譲れない最低条件として浮上しつつあると位置づけている。サーバーとローカル双方のスタックにまたがる、この初日からのランタイム同梱は、OSS 推論のベースラインという見立てを前進させる。ここで名前の挙がるローカルランタイムは、まさに量子化配信への入り口だからである。これは、量子化をデフォルトとする標準化されたベースラインへ向かう方向を示すものの、量子化を明示的なデフォルトのフラグとしてまだ宣言してはいない。 | [Mistral AI - Introducing Mistral 3](https://mistral.ai/news/mistral-3/) |
| Sub-gigabyte on-device LLM gains same-week Unsloth tuning support by Q3 2026 | 2026-06-28 | 4 | Unsloth は v0.1.471-beta を公開し、あらゆる推論レベルにわたる GLM 5.2 への当日レベルの対応、同じ VRAM でおよそ 3 倍長い文脈を実現できるとうたう刷新されたメモリ自動調整、そして Blackwell RTX のより良いサポートを盛り込んだ。解説では、Unsloth が新たに公開されたオープンモデルに対して同じ週のうちに対応を出荷し続ける数少ないチューニングスタックの一つだと述べており、これはまさに予測が見込む素早い追随のチューニング頻度である。直接の的中は、新公開のオープンモデルに対する同一週対応というパターンであって、具体的なサブギガバイトのチェックポイントではない。したがって、この見立てのうちチューニング頻度の側を強く前進させる。 | [GitHub - unslothai/unsloth releases](https://github.com/unslothai/unsloth/releases), [Unsloth - 2026 Update: Faster MoE](https://unslothai.substack.com/p/unsloth-2026-update-faster-moe) |
| Single 24-32GB GPU fine-tuning crosses 100K-token context routine by Q2 2027 | 2026-06-20 | 4 | Unsloth v0.1.471-beta はメモリ自動調整アルゴリズムを刷新し、同じ VRAM でおよそ 3 倍長い文脈を実現できるとうたう。Blackwell RTX GPU のサポートも改善され、単一の 192GB B200 上で最大 380K トークンの RL 文脈を報告した従来の路線を土台としている。同じ VRAM で 3 倍の文脈という自動調整は、長文脈の微調整を単一のコンシューマー級 GPU 上で日常的なものへ押し進めるうえで予測が拠り所とする仕組みであり、本日の公開はこの見立てを前進させる。ただし、示された大規模文脈の数値は、100K トークンで動作する具体的な 24〜32GB のカードではなくハイエンドのシリコンに依っており、完全な実現ではなく前進にとどまる。 | [GitHub - unslothai/unsloth releases](https://github.com/unslothai/unsloth/releases), [Unsloth - 2026 Update: Faster MoE](https://unslothai.substack.com/p/unsloth-2026-update-faster-moe) |
| Major AI-agent platform ships zero-trust controls as default-on by Q2 2027 | 2026-06-27 | 3 | Langflow のテナント間 IDOR が実環境で悪用されたことが確認され、エージェントプラットフォームがオブジェクト単位・テナント単位の認可を後付けではなく出荷時のデフォルトにすべきだという圧力が高まっている。本日の Future セクションは、主要なエージェントビルダー各社がテナントごとの認可をデフォルトへ移していく様子を描いており、Sysdig の「攻撃者はより低い CVSS の IDOR に手を伸ばした」という指摘は、悪用実態を優先した堅牢化へとベンダーを押しやる。これは、出荷済みのデフォルト有効なゼロトラスト制御そのものではなく、それに向けた圧力である。したがって関連度は中程度である。 | [Sysdig - Understanding Langflow CVE-2026-55255 and why higher-CVSS vulnerabilities aren't always the most exploited](https://www.sysdig.com/blog/understanding-langflow-cve-2026-55255-and-why-higher-cvss-vulnerabilities-arent-always-the-most-exploited), [NVD - CVE-2026-55255 Detail](https://nvd.nist.gov/vuln/detail/CVE-2026-55255) |
| Coding-agent harnesses adopt default-deny toolset gating as standard by H1 2027 | 2026-06-20 | 3 | Langflow の IDOR 悪用が確認されたことは、モデルだけでなく視覚的なエージェントビルダーとツール実行の層こそが、いまや主要な攻撃対象領域だという点を補強する。Unsloth が Studio セッションを Cloudflare 暗号化で前面に置く新しい --secure フラグも、同じツール実行の安全性への懸念を反映している。これらのシグナルは、ハーネスがデフォルトでツールアクセスを制限すべきだという圧力を保ち続ける。これはデフォルト拒否のツールセット制限を裏づける文脈であって、具体的なコーディングエージェントのハーネスがその制御を出荷したわけではない。したがって関連度は中程度である。 | [Sysdig - Understanding Langflow CVE-2026-55255 and why higher-CVSS vulnerabilities aren't always the most exploited](https://www.sysdig.com/blog/understanding-langflow-cve-2026-55255-and-why-higher-cvss-vulnerabilities-arent-always-the-most-exploited), [GitHub - unslothai/unsloth releases](https://github.com/unslothai/unsloth/releases) |
| Agent-framework SQL tools ship read-only-by-default execution guards by Q1 2027 | 2026-06-05 | 3 | [REVIVED] 本日確認された Langflow のテナント間 IDOR の実環境での悪用は、認証済みユーザーが実行層で別テナントのフローを実行するもので、この休眠中の行が持つ中核シグナル——プロンプトインジェクションから任意実行へ、そしてフレームワークが強制する実行ガード——と一致する。攻撃者がより古い RCE より先に認証済み IDOR に手を伸ばしたという Sysdig の指摘は、最小権限のデフォルトを強制すべき場所がエージェントフレームワークの実行ラッパーであることを強調する。ただし証拠は、text-to-SQL の読み取り専用ガードそのものではなく、実行層の認可にまつわる一般的な事案である。したがって、この見立てを中程度の関連度で復活させる。 | [Sysdig - Understanding Langflow CVE-2026-55255 and why higher-CVSS vulnerabilities aren't always the most exploited](https://www.sysdig.com/blog/understanding-langflow-cve-2026-55255-and-why-higher-cvss-vulnerabilities-arent-always-the-most-exploited), [NVD - CVE-2026-55255 Detail](https://nvd.nist.gov/vuln/detail/CVE-2026-55255) |


## Bridge


On the "Multi-tenant agent builders draw a 9.0+ cross-tenant authz CVE by Q1 2027" prediction (2026-06-27): Sysdig が Langflow の CVSS 9.9 のテナント間 IDOR(CVE-2026-55255)について実環境での初悪用を確認したことは、予測が見込んでいた 9.0 超のマルチテナント認可 CVE そのものである。しかもそれは Q1 2027 という想定時期をかなり前倒しして、すでに武器化された状態で現れた。


On the "AMD Instinct MI400 launches with a named ship, memory, or rack spec by Q3 2026" prediction (2026-06-27): AMD が確定させた 7 月 22〜23 日の Advancing AI は、MI400 の公開を Q3 2026 の期間内に固定し、Helios ラックスケールシステムの名称を示した。報道は MI350 の 2 倍を超えるメモリ帯域を指し示しており、確定した日付を伴う具体的なメモリ・ラック仕様となっている。


On the "HBM allocation becomes a named binding cap in a vendor disclosure by Q2 2027" prediction (2026-06-29): HBM の供給が約 $100B の市場規模に対して 2026 年まで完売と報じられ、KV キャッシュの増大が買い手をより大きなメモリプールへ向かわせていることは、予測が必要とする供給不足という構造的な force そのものである。ただし、割り当ての上限を提出書類で名指ししたベンダーはまだ存在しない。


On the "Frontier-class open-weight LLM runs single-node under 256GB by Q4 2026" prediction (2026-06-23): Mistral 3 の Apache 2.0 の密モデル 14B・8B・3B は Ollama・llama.cpp・MLX で動く規模であり、フロンティア級のオープンウェイトを単一ノード・256GB 未満の範囲に十分収めている。一方で総 675B の MoE 旗艦モデルは依然としてその基準を超えている。


On the "Quantized-by-default serving lands as the OSS inference baseline by H1 2027" prediction (2026-06-30): Mistral 3 が初日から vLLM と SGLang での配信に加えて Ollama・llama.cpp・MLX の同梱を提供したことは、公開と同時にそろえるランタイム対応をオープンウェイトの最低条件として定着させる。そしてこれらのローカルランタイムは、ベースラインの見立てが拠り所とする量子化配信への入り口である。


On the "Sub-gigabyte on-device LLM gains same-week Unsloth tuning support by Q3 2026" prediction (2026-06-28): Unsloth v0.1.471-beta が GLM 5.2 への当日レベル対応を出荷したことは、予測が拠って立つ、新公開のオープンモデルに対する同一週のチューニング頻度を裏付ける。的中したのは素早い追随のパターンであって、具体的なサブギガバイトのチェックポイントそのものではない。


On the "Single 24-32GB GPU fine-tuning crosses 100K-token context routine by Q2 2027" prediction (2026-06-20): Unsloth が刷新したメモリ自動調整は、Blackwell RTX のより良いサポートとともに、同じ VRAM でおよそ 3 倍長い文脈をうたう。これは長文脈の微調整を単一のコンシューマー GPU 上で日常的なものへ押し進める仕組みである。ただし、示された大規模文脈の数値は依然としてハイエンドのシリコンに依っている。


On the "Major AI-agent platform ships zero-trust controls as default-on by Q2 2027" prediction (2026-06-27): Langflow のテナント間悪用が確認されたことは、エージェントプラットフォームがテナント単位・オブジェクト単位の認可を出荷時のデフォルトにすべきだという圧力を高める。ただし本日示されたのは攻撃の証拠とベンダーの意向であって、プラットフォームが実際にデフォルト有効なゼロトラスト制御を出荷したわけではない。


On the "Coding-agent harnesses adopt default-deny toolset gating as standard by H1 2027" prediction (2026-06-20): Langflow の実行層での悪用と、Unsloth の新しい --secure Studio フラグは、いずれもツール実行の境界をデフォルトで制限されたアクセスへと押しやり、デフォルト拒否のツールセット制限という方向を裏づける。ただし、これを標準として出荷した具体的なコーディングエージェントのハーネスはまだない。


On the "Agent-framework SQL tools ship read-only-by-default execution guards by Q1 2027" prediction (2026-06-05): 認証済みユーザーが実行層で別テナントのフローを実行する Langflow のテナント間 IDOR は、実行ラッパーにおける最小権限という同じ懸念を反映し、フレームワークが強制する実行ガードの必要性を復活させる。ただしこれは text-to-SQL の読み取り専用デフォルトそのものではなく、実行層の認可にまつわる一般的な事案である。


## Summary (Plain Language)

AI エージェントビルダーの深刻なバグが、いま実環境で悪用されている。新しいオープンモデルが、無料で入手して自分で動かせる形で登場した。AI チップの競争は、速度だけでなくメモリへと移っている。


## Summary of Findings

本日の証拠群は珍しく整合性が高く、2 つの予測が同じ日に最大の強さで的中した。最も明確なのはセキュリティの軸である。Sysdig は CVE-2026-55255 の実環境での初悪用を確認した。これは Langflow の /api/v1/responses エンドポイントに存在する CVSS 9.9 の安全でない直接オブジェクト参照(IDOR)で、認証済みユーザーが被害者のフロー ID を指定するだけで別テナントのフローを実行できてしまう(1.9.2 で修正)。これは「マルチテナント型エージェントビルダーが 9.0 超のテナント間認可 CVE を引き寄せる」という予測(2026-06-27)を直接現実化するもので、しかも単なる公表ではなく実際の悪用として、想定の Q1 2027 をかなり前倒しして現れた。Sysdig のより踏み込んだ指摘——この IDOR がより古い 9.8 の RCE である CVE-2026-5027 より先に武器化されたこと——は、素の CVSS が攻撃者が実際に手を伸ばす対象をうまく予測できないことを示し、モデルだけでなく視覚的なエージェントビルダーとツール実行の層こそが主要な攻撃対象領域であることを裏付ける。同じ事案は「主要な AI エージェントプラットフォームがゼロトラスト制御をデフォルト有効で出荷する」(2026-06-27)、「コーディングエージェントのハーネスがデフォルト拒否のツールセット制限を採用する」(2026-06-20)、そして復活した「エージェントフレームワークの SQL ツールが読み取り専用デフォルトの実行ガードを出荷する」(2026-06-05)という各見立てに圧力をかける。Unsloth の新しい --secure Cloudflare 前面配置の Studio フラグも、同じツール実行の安全性への感覚を反映している。

アクセラレータの軸が 2 つ目の完全な的中である。AMD は Moscone での Advancing AI 2026 を 7 月 22〜23 日に正式告知し、そこで MI400 シリーズ(TSMC 2nm 上の CDNA 5)と Helios ラックスケールシステムの詳細を明らかにする。報道は MI350 の 2 倍を超えるメモリ帯域を指し示しており、「AMD Instinct MI400 が具体的な出荷・メモリ・ラック仕様を伴って登場する」という予測(2026-06-27)を、確定した日付とともに Q3 2026 の期間内に固定する。周辺の位置づけは「HBM の割り当てがベンダー開示で具体的な拘束条件になる」という見立て(2026-06-29)を前進させる。HBM の供給は 2026 年暦年を通じて完売と報じられ、2028 年までに約 $100B の市場規模に対して不足しており、長文脈推論による KV キャッシュの増大が買い手をより大きな HBM プールへ向かわせている。NVIDIA の GB300 が最大 288GB の HBM3e、Rubin Ultra が 512GB を狙うことで、市場の頂点はメモリ容量の争いであり続ける。明確なシグナルは、演算主導からメモリ主導のアクセラレータ世代への移行である。

オープンウェイトの側では、Mistral 3 が完全な Apache 2.0 ファミリーとして登場した。総 675B のうち有効 41B のスパース MoE である Mistral Large 3 に加え、エージェント的なツール利用向けに調整した密モデル 14B・8B・3B からなり、小型の密モデルは Ollama・llama.cpp・MLX 向けの規模、旗艦モデルは vLLM と SGLang を狙う。これは「フロンティア級のオープンウェイト LLM が単一ノード・256GB 未満で動く」という予測(2026-06-23)を小型密モデルの側で前進させ、初日からのサーバー・ローカル両ランタイム対応を定着させることで「量子化デフォルトの配信が OSS 推論のベースラインになる」という見立て(2026-06-30)も前進させる。これにより、オープンウェイトのフロンティアは Qwen 3.5 や DeepSeek と並ぶ少数の MoE ファミリーへと集約されつつある。最後に、Unsloth v0.1.471-beta があらゆる推論レベルにわたる GLM 5.2 への当日レベル対応に加え、同じ VRAM でおよそ 3 倍長い文脈をうたう刷新されたメモリ自動調整と改善された Blackwell RTX サポートを出荷した。これは「サブギガバイトのオンデバイス LLM が同一週の Unsloth チューニング対応を得る」(2026-06-28)と「単一の 24〜32GB GPU の微調整が 100K トークン文脈を日常的にこなす」(2026-06-20)という見立ての背後にある素早い追随のチューニング頻度を裏付け、単一の 192GB B200 上で最大 12 倍高速な MoE 学習と 380K トークンの RL 文脈を報告した従来の Faster MoE 路線を土台としている。


## Relation to My Own Predictions

ユーザーの第 1 の継続予測(悪意あるローカル LLM がマルウェアとして機能し、ゼロトラストが根本的な防御になる)は、そのエージェント的ワークフロー CVE の軸において、本日の最も直接的で強力な裏付けを得た。一方、認証(アテステーション)と調達の軸は静かなままである。Sysdig が確認した Langflow の CVSS 9.9 テナント間 IDOR(CVE-2026-55255)の実環境での初悪用——認証済みの攻撃者が /api/v1/responses エンドポイント経由で別テナントのフローを実行し、それがより古い 9.8 の RCE である CVE-2026-5027 より先に武器化された——は、この見立てが名指しするエージェントスタックの CVE 連鎖から実際の悪用へ、まさにその通りのものであり、素の CVSS が実際の悪用をうまく予測できないという論点を裏づける。Unsloth の新しい --secure フラグが Studio セッションを Cloudflare 暗号化で前面に置くことは、この見立てが見込むツール実行の安全性の姿勢へのかすかな一歩である。ただし、この予測が拠って立つ構造的な答えは現れなかった。署名付きチェックポイントのアテステーションも、テナントごとの権限制限の基本要素も、同盟陣営の調達ゲート条項も浮上しなかった。したがって本日は悪意あるツールの脅威の側を鋭くする一方、デフォルト拒否のアテステーション防御は未解決のまま残る。

ユーザーの第 2 の継続予測(高度・フロンティア作業にはクラウド API、日常にはローカル LLM、SaaS の値上げが後押し)は、本日そのローカル実行の極に豊かに触れた。これは通常のクラウド偏重とは逆の展開である。Mistral 3 の Apache 2.0 ファミリー——Ollama・llama.cpp・MLX 向けの規模の密モデル 14B・8B・3B と、vLLM・SGLang 向けの総 675B の MoE 旗艦モデル——は、日常ローカルの軸が期待する、まさに広がりゆくコンシューマー GPU と自己ホストの範囲であり、Qwen 3.5 や DeepSeek の MoE チェックポイントと対比して鋭さを増している。Unsloth v0.1.471-beta のおよそ 3 倍長い文脈の自動調整は、ローカルのチューニング手法を前進させ続ける。クラウドと基盤の経済性の軸は、メモリコストの側から補強される。AMD の MI400(CDNA 5、2nm)は MI350 の 2 倍を超える帯域を持ち、HBM は 2028 年までに約 $100B の市場規模に対して 2026 年まで完売、NVIDIA の GB300 は 288GB、Rubin Ultra は 512GB という水準は、フロンティア学習をクラウドに結びつけ続けるハイパースケーラ級の設備投資を示す。これはまさに、汎用作業をローカルへ押しやる SaaS コストという逃げ場のない圧力である。本日は分岐の両極を同時に前進させ、日常ローカルの側に特に強く新鮮な裏付けをもたらした。

ユーザーの第 3 の継続予測(RL/LLM ベースの予測性能の向上と、基盤・ガバナンス・実世界展開の各軸が並行して固まる)は、その基盤の軸で意味のある接触を得た一方、ガバナンスや展開ではほとんど得られなかった。Unsloth v0.1.471-beta の刷新されたメモリ自動調整——同じ VRAM でおよそ 3 倍長い文脈を実現できるとうたい、Blackwell RTX のより良いサポートを備え、単一の 192GB B200 上で最大 380K トークンの RL 文脈と 12 倍高速な MoE 学習を報告した路線を土台とする——は、まさにこの見立てが追う、超長文脈での RL の安定性と MoE バックボーンの学習機構である。Mistral Large 3 の有効 41B・総 675B のスパース MoE は、この見立てが見込む混合エキスパートのバックボーンに新鮮なオープンウェイトの基盤を加える。そして、HBM を拘束条件とし、長文脈推論による KV キャッシュの増大が買い手をより大きなプールへ向かわせるメモリ主導のアクセラレータ世代は、長いロールアウトを行う予測エージェントが動かねばならないハードウェアの範囲を定義する。ただし、router のみの LoRA も、router を意識した advantage 分解のプレプリントも、署名付きスキルレジストリの相互運用も、NIST の非人間 ID 制御プロファイルも、物理 AI の生産ループの完結も現れなかった。したがって基盤の軸は前進した一方、正式なガバナンスと実世界展開の証明は今後の課題として残る。

