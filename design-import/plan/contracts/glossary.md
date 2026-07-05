# Glossary

## world

The scope owned by News for world prediction, observation, and external context; here world prediction means News's AI world predictions.

## self

The scope owned by NuncStans for self-prediction, commitment, outcome, revision, mandate, and edge; user-authored world predictions are stored in self with scope=world.

## artifact

The scope owned by FourFive for fixed deliverables and application versions.

## commitment

A record of action. Expresses which prediction, what, and how much was wagered. Belongs to the self scope.

## edge

A connection record that spans scopes. Append-only. Requires `author` and `to_label`.

## WRITE

An operation that, rather than merely saving, determines which semantic layer information is committed to.

## READ

An operation that, rather than searching, reconnects records to the current UserState / INTENT / cognitive load.

## ReconnectionResult

The return value of READ. Holds surface / suppress / defer along with the reason and cognitive-load constraints.

## HTAS

Human Thought Augmentation System. Not the source-of-truth DB, but the upper control layer that owns cognitive control / Memory I/O policy / reconnection.

## NuncStans

Formerly SPL. Owns the source of truth of the self scope, plus edge, commitment, and mandate.

## FourFive

The source of truth of the artifact scope. Owns the fixed versions of the tactical apps the user builds with AI.

## News

The source of truth of the world scope. Owns world prediction, observation, and external context.
