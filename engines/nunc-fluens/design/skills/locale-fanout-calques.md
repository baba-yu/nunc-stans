# locale-fanout — calque-avoidance reference (JA / ES / FIL)

MANDATORY reading for every `translate-sourcedata` sub-agent. The `locale-fanout.md`
contract covers STRUCTURE (identity keys, ordering, key-names-stay-English). This file
covers NATURALNESS — the connective tissue *between* preserved tokens, which is where
EN-calque ("重訳") leaks. Yuki (JA native) flagged these directly on 2026-05-29.

## Where calque concentrates

- `news_section.json` / `headlines.json` / `predictions.json` / `change_log.json` / `needs.json`
  → short, enumerative; calque is **usually mild but still apply the rules below**.
- `summary.json` / `bridges.json` (FP) → long narrative prose; **calque hotspot — rewrite for
  the target reader, split EN multi-clause sentences, replace metaphor-nouns with plain words.**

## 0. The `X surface` noun-phrase pattern (ALL locales) — read first

`X surface` is an established EN **noun** = "the set of points where X is exposed/reaches/is
accessible". It is NOT the verb "to surface" (顕在化/aflorar/lumitaw). Concretize it — a literal
"表面/superficie/ibabaw" erases the underlying fact.

| EN | JA | ES | FIL |
|---|---|---|---|
| `distribution surface` | 配信先 / 同時公開プラットフォーム群 | conjunto de plataformas de distribución / lanzamiento simultáneo en N plataformas | mga plataporma ng pamamahagi / unang-araw na pamamahagi |
| `attack surface` | 攻撃対象領域 | superficie de ataque (OK) | attack surface (OK as EN) |
| `tool-call surface` | 呼び出し可能な機能群 | herramientas invocables | abot ng mga tool na matatawag |
| `integration surface` | 統合先 / 連携ポイント | superficie de integración (OK) / puntos de integración | puntong integrasyon |
| `API surface` | 公開 API / API 露出範囲 | API expuesta | API surface (OK as EN) |

ES note: `superficie de ataque` / `superficie de integración` are naturalized; `superficie de
distribución` / `superficie de llamadas a herramientas` are calque tells — concretize those.

## 1. Noun-metaphor calques — do NOT transliterate

| EN | JA avoid → use | ES avoid → use | FIL avoid → use |
|---|---|---|---|
| `forcing function` | 強制関数 → 逃げ場のない圧力 / 不可避な状況 | función forzante → presión inevitable / imperativo | forcing function → hindi maiiwasang puwersa |
| `print` (stock) | プリント/印字 → 高値/約定値/(動)値が出る | imprimir/impresión → marca/cierra a/cotiza a | nag-i-imprenta → lumitaw / nangyari |
| `tape` (trading) | テープ → 相場/値動き | cinta → sesión bursátil/cotización | tape → presyo / kalakaran ng presyo |
| `cohort` | 反射的な集団 → バイサイド勢/ベンダー群/各社 | cohorte (reflexive) → grupo/conjunto/bloque | cohort (OK in fin/procurement) or grupo |
| `pulse` | パルス → シグナル/裏付け | pulso → señal/respaldo/indicio | pulse → senyales / ebidensya |
| `tick` | ティック → 進展/一歩前進 | tick → avance/paso/progreso | tick → pag-unlad/pagsulong |
| `datum` (canonical) | データム → 基準点/参照例 | dato canónico → referencia/ejemplo modelo | translate → batayan/halimbawa |
| `cadence` | ケイデンス → 頻度/間隔/周期 | cadencia (reflexive) → ritmo/frecuencia | cadence → ritmo/dalas |
| `leg` (of thesis) | 脚 → 軸/側面/柱 | pierna → eje/vertiente/dimensión | leg → bahagi/haligi |
| `arc` | 弧 → 流れ/軌道/筋道 | arco → trayectoria/progresión | arc → daloy/landas |
| `node` | 節 → 拠り所/支柱/起点 | nodo → pilar/punto de apoyo | node → haligi/sandigan |
| `run rate` | ランレート → 年率換算収益 | tasa de ejecución → tasa anualizada | run rate → taunang takbo ng kita |
| `runway` | ランウェイ → 猶予期間/活動余地 | (pista) → margen/plazo | runway → panahong inilaan |
| `cycle` | サイクル → 本日の証拠群/今期/今週 | (ciclo) → este período/esta ronda | cycle/ikot (both OK) |

## 2. Verb calques

| EN | JA | ES | FIL |
|---|---|---|---|
| `anchored X to Y` | X を Y に固定 → 紐付ける/根拠とする | fijar → vincular/ligar | nag-anchor → iniugnay/ikinabit |
| `lands the trigger inside` | 内側に着地させる → 同日の出来事で条件を満たす | aterrizar dentro → se activa dentro de | lumapag → tumatama/tumutugma sa loob ng |
| `compounds with` | 複合する → 重なる/相乗する | compone → se combina/se refuerza | nag-compound → nag-uugma/nagsasanib |
| `extends the storyline` | 延長/延伸 → 引き継ぐ/継続する | extiende la línea → prolonga el hilo | i-extend → nagpapalawak sa kuwento |
| `prints inside the window` | ウィンドウ内で印字 → 期間内に発生する | imprime dentro → se produce en el período | nag-i-imprenta → lumitaw sa loob ng |
| `serves as a canonical datum` | データムとして名指し → 基準点として扱う | nombra como dato → funciona como referencia | translate → nagsisilbing batayan |
| `sits between` | の間に座る → 〜の間に位置する | se sienta entre → se sitúa/queda entre | translate → nasa pagitan ng |
| `names a precondition/pattern` | 名指し(adversarial) → 取り上げる/挙げる/指す | nombra → señala/identifica/apunta a | pinangalanan → binabanggit/tinutukoy |
| `expose A as a tool surface` | 露出 → ツールとして提供する | exponer → ofrecer A como herramienta | nagbubunyag → nagbibigay/ginagawang available |
| `lift and adapt` | 持ち上げ適合 → 引用・適応する | levantar y adaptar → citar y adaptar | i-lift at i-adapt → inihahalaw at iniaakma |

## 3. Redundant adjective pairs (collapse to ONE)

- `cleanest freshest` → JA 最も明快な / ES el más reciente / FIL pinakamalinaw — one word, not two.
- `fresh + noun` (state-change/entry/start) → JA 新規の/新たな (NOT 新鮮な, food sense); ES nuevo/reciente/naciente (NOT fresco); FIL bago (not literal preno).
- `clean + noun` (revival/listing) → JA 完全な/問題のない (NOT クリーンな); ES total/clara/inequívoca (NOT limpio).
- `sharpest tick/leg` → JA 最も明確な/顕著な; ES más definido/marcado (NOT afilado); FIL pinakamalinaw.

## 4. EN idioms — never leave literal

| EN | JA | ES | FIL |
|---|---|---|---|
| `top-of-mix storyline` | 主役の/当面最重要の | historia principal/central | pangunahing kuwento |
| `headless everything` | UI を持たないツール群 | arquitectura sin interfaz | walang-dashboard/walang-frontend |
| `path of least resistance` | 最も抵抗の少ない選択肢/自然な流れ | vía natural/opción más fácil | pinakanatural na opsyon |
| `canonical X` | 模範例の/典型的な (NOT 正典) | ejemplo modelo de X (NOT canónico reflexive) | tipikal na X |
| `coordination collapse` | 連携破綻/同期失敗 | ruptura de coordinación | pagkasira ng koordinasyon |

## 5. Sentence-structure rules

- **JA**: 動詞 3 連鎖禁止 — EN の `anchors X / pegs it to Y / leaves Z` 型は句点で 2-3 文に分割。
  `A plus B plus C` の「加えて」連鎖禁止（最後の項のみ「さらに」可）。後置修飾で主語を文末まで
  引っ張らない。
- **ES**: tolerates longer sentences than JA, but cap at 3 finite verbs/sentence; split 4+ with
  `Esto…` / `Por su parte…`. `A plus B plus C` → start a new sentence with `Además,`.
- **FIL**: shortest sentences of the three; aggressively break long EN sentences into 2-3 Tagalog
  sentences. Limit em-dash chains (`—X, Y, Z—` → `. X, Y, at Z.`). Verb-initial is natural; don't
  force leading `ay`. Bias to `lumitaw`/`nangyari`/`bumukas` for state-changes.

## 6. Per-locale preservation specifics (in addition to locale-fanout.md identity keys)

- **ES**: compound EN regulatory names kept verbatim (`Frontier Governance Framework`, `Code of
  Practice`). Financial EN borrowings verbatim (`overweight`, `Buy`, `Sell`, `IPO`, `MoU`, `S-1`).
  Numbers: `,` decimal / `.` thousands (`242,59 dólares`, `65.000 millones`). `primitiva` (fem) for
  software primitive; `coherencia` for prediction coherence.
- **FIL**: tolerates EN tech jargon as borrowings (`MCP`, `tool-call`, `subagent`, `GA`, `Claude
  Code`, `SEC`, `EU AI Act`, tickers, `$`, dates) — do NOT force-translate these. The problem is
  syntactic/idiomatic, not lexical.
- **JA**: also honors the UI-wording rules (avoid 測/査 measurement kanji, bare インテリジェンス) in
  any UI-adjacent string; favor 観察/探索/空間 imagery.

## 7. Banned tokens (quick grep list)

- JA: 強制関数, 配信表面, ツール呼び出し表面, (株式文脈の) プリント/テープ/ティック/パルス/データム/
  エンベロープ/ケイデンス/サーフェス, (動詞の) 着地/名指し/印字, 「加えて」3連以上.
- ES: función forzante, cinta (trading), pulso/tick/cadencia (reflexive), pierna de la tesis,
  superficie de distribución, superficie de llamadas a herramientas.
- FIL: ibabaw ng [X surface], nag-i-imprenta, nag-compound, lumapag (ang trigger), nag-anchor,
  landas ng pinakamababang paglaban, bare `pulse`/`tape`/`tick`/`print`(verb), nagbubunyag (exposes).
