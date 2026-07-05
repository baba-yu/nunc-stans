# Tier debug — 2026-04-26

Bootstrap run. Tier thresholds applied:

- **Hot**: most recent relevance 4-5 → next ping = last eval + 2 days
- **Warm**: most recent relevance 3 → next ping = last eval + 5 days
- **Lukewarm**: most recent relevance 1-2 → next ping = last eval + 7 days
- **Dormant**: no validation signal for ≥ 14 days (none yet — system too new)
- **New**: today's predictions, no validation row yet → next ping = 2026-04-27

| ID | Tier | Last relevance | Computed next ping | Notes |
|---|---|---|---|---|
| 20260419-1 | Lukewarm | 2 (4/26) | 2026-05-03 | 1-bit ネイティブ学習 (Bonsai 系)。Qwen/Llama 1-bit 派生の新出なし。 |
| 20260419-2 | Hot | 4 (4/26) | 2026-04-28 | Agent Registry 方式。Okta for AI Agents / AWS AgentCore で継続裏付け。 |
| 20260419-3 | Hot | 5 (4/26) | 2026-04-28 | 間接プロンプトインジェクション CVE 主カテゴリ化。Comment & Control 攻撃で決定的裏付け。 |
| 20260420-1 | Warm | 3 (4/26) | 2026-05-01 | ローカル > クラウド逆転。DeepSeek V4-Pro 75% OFF が逆方向圧力。 |
| 20260420-2 | Hot | 5 (4/26) | 2026-04-28 | CI Secret 流出。Comment & Control + Vercel/Context.ai で決定的裏付け。 |
| 20260420-3 | Lukewarm | 2 (4/26) | 2026-05-03 | Headless Everything。OpenClaw per-profile headless override は前進だが音声会話追加が逆向き。 |
| 20260421-1 | Warm | 3 (4/26) | 2026-05-01 | GGUF 供給経路。Anthropic MCP Design Vulnerability で延長線。 |
| 20260421-2 | Hot | 4 (4/26) | 2026-04-28 | ハイパースケーラ × フロンティアラボ 5 極体制。中国 Huawei Ascend 6 極目浮上。 |
| 20260421-3 | Hot | 5 (4/26) | 2026-04-28 | プロプライエタリ × オープン分断。米国 × 中国 Apache 2.0 + Huawei で完全顕在化。 |
| 20260422-1 | Lukewarm | 2 (4/26) | 2026-05-03 | 訓練/推論 SKU 分離。ハイパースケーラ自社チップ側の本日新規進展薄。 |
| 20260422-2 | Hot | 5 (4/26) | 2026-04-28 | Physical AI SaaS / RaaS。Hannover Messe 2026 + Manila Times $4 兆判定。 |
| 20260422-3 | Hot | 5 (4/26) | 2026-04-28 | OAuth 横断信任。Vercel/Context.ai 解析 + Okta GA カウントダウン。 |
| 20260423-1 | Hot | 5 (4/26) | 2026-04-28 | Agent Control Plane。Google/AWS/Okta 同期立ち上がり。 |
| 20260423-2 | Warm | 3 (4/26) | 2026-05-01 | 27B Dense + 1M context。DeepSeek V4 は MoE で Dense 路線とは異なる方向。 |
| 20260423-3 | Hot | 4 (4/26) | 2026-04-28 | 第三者ベンダ境界 + URL 命名推測回避。AI-SPM 監査項目化が予測通り。 |
| 20260424-1 | Hot | 5 (4/26) | 2026-04-28 | 1M context 既定。DeepSeek V4-Pro 1M context + Apache 2.0 で決定的裏付け。 |
| 20260424-2 | Hot | 4 (4/26) | 2026-04-28 | Physical AI 8h 本番稼働。Hannover Messe Agile ONE シューズ生産ラインデモ。 |
| 20260424-3 | Warm | 3 (4/26) | 2026-05-01 | SaaS displace 金融市場評価。Big Tech 決算 Super Week 直前で結果待ち。 |
| 20260425-1 | Warm | 3 (4/26) | 2026-05-01 | フロンティア × Tier-1 容量。中国 Huawei Ascend 4 極化シナリオ。 |
| 20260425-2 | Hot | 4 (4/26) | 2026-04-28 | Physical AI リーグテーブル化。Hannover Messe で OEM 採用比較フェーズ。 |
| 20260425-3 | Hot | 5 (4/26) | 2026-04-28 | MCP プロトコル攻撃面。Anthropic MCP Design Vulnerability で決定的裏付け。 |
| 20260426-1 | New | — | 2026-04-27 | フロンティアコーディングエージェント「リリース→即リトラクト」サイクル。今日のニュースから新規。 |
| 20260426-2 | New | — | 2026-04-27 | 中国 LLM「フルスタックローンチ標準」(Day-0 推論 + RL + 値下げ + ハードウェア最適化)。今日のニュースから新規。 |
| 20260426-3 | New | — | 2026-04-27 | サプライチェーン経由 AI ツール侵害が OWASP LLM Top 10 最上位リスク昇格。今日のニュースから新規。 |

## Notes on tier thresholds

Confirmed reasonable thresholds from this snapshot:

- **Hot tier dominates** (12 of 21 evaluated predictions). Reflects current acceleration in MCP / agent / Physical AI / China LLM space.
- **No Dormant entries yet** — earliest prediction (4/19) is only 7 days old, well below 14d quiet threshold. First eligible dormant entrants likely arrive after 2 weekly cycles (need to drop to relevance ≤ 2 for two consecutive pings).
- **Today's 4/26 predictions** treated as New / Hot equivalent — they will be evaluated for the first time by tomorrow's daily prediction-validation job.

Continue emitting this debug file for the next 1-2 Sunday cycles to confirm the Hot/Warm/Lukewarm cutoffs hold up against real data and to verify that dormant transitions trigger as expected once the 14-day quiet window starts elapsing.
