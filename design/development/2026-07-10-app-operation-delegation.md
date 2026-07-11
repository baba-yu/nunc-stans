# App operation is delegated to AI — direction note (2026-07-10)

Status: direction recorded, owner-stated in session 2026-07-10 (night).
This is NOT Phase E scope — Phase E executes T9–T12 exactly as planned
first (owner: build it through, then critique from real use). This note
exists so the direction survives until its own lane opens.

## The principle (owner, verbatim)

> 何のために設計が見れるようになってるかというと、あくまで人間の認知
> スピードに合わせるためなんだよね。実際の操作まで人間がやりたいわけ
> じゃないのよ。
>
> 入力がない場合はAIがアプリのレコード状況を巡回して、人間に調子を
> うかがってレコードを作るのが体験なんだよ。

Design visibility exists to match HUMAN COGNITIVE SPEED. Operating the
app — hand-entering records in the generated UI — is toil, not the
experience. The intended experience: the AI watches the app's record
state and, when input is missing, opens the conversation ("how are
things going?") and creates the records from the answers.

## What this changes / does not change

- The generated UI demotes from primary experience to an inspection /
  fallback surface. It STAYS: S-7's human leg remains the proof that
  both actors operate the same app through the same rails, and the
  bundle contract (contracts/app-bundle.md) is untouched by this note.
- Everything below rides EXISTING rails: apps-host published API + MCP
  tool surface (PE7), nunc-ai bounded tool loop (PE9), profile-skills
  gating (PE10). No new write path, no bypass of the host's validation.

## The split (candidate scope for the new lane)

- **A — FourFive right pane: `design | app` toggle.** When the
  session's app has a served bundle, an "App" view shows live records +
  metrics (v0 candidate: embed the served shell — same origin behind
  the gate). Design view = the cognition surface; App view = the
  inspection surface.
- **B — operation delegated in the app's FourFive chat.** The session
  chat gains the app's five verbs through the existing tool loop, so
  「受注1件入れといて」 works in place. Plus the INTERACTIVE patrol v0:
  on session open, the AI sweeps recent rows + metrics and opens with a
  status question; a confirmed answer becomes a create. This stays
  inside "interactive co-use".
  - OPEN QUESTION for the plan: does the design chat get an implicit
    `apps:<own-slug>` grant, or an explicit profile-skills grant like
    every other surface? (One gating rule everywhere vs owner-surface
    convenience — decide at plan time, PE10 is the precedent.)
- **C — unattended patrol (scheduled/resident) stays DEFERRED** — F14 /
  SPL v3+, exactly as the Phase E plan names it. A/B must not smuggle
  it in; only the in-session opening sweep is v0 territory.

## Trigger

After Phase E close (T12), or earlier only by explicit owner call.
First step per §7: plan doc + owner approval before any code.
