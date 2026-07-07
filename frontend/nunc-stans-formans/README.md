# frontend — ME view / world view

The Vue 3 + TypeScript (Vite, Pinia) UI served same-origin by the
nunc-stans engine. In Phase B this evolves into **Nunc Stans Formans**
(`frontend/nunc-stans-formans/`), the single-origin integrated UI.

## Dev loop

```sh
# terminal 1 — the engine (serves the built UI + /self API).
# Uses your configured data store; run `just bootstrap <dir>` once first.
just up

# terminal 2 — hot reload (proxies /self + /health to :8720):
just web              # Vite dev server on :5173
```

`just build-world` refreshes `public/world-headlines.json` from the linked
news checkout (`just news-link <dir>`, strictly read-only; none linked
gives an empty world view).

## Test / build

```sh
pnpm -C frontend test     # vitest
pnpm -C frontend build    # emits frontend/dist (served by the engine)
```
