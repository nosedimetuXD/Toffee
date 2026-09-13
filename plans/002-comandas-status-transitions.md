# 002 — Comandas Live Order Cards Status Transitions

- **Status**: DONE
- **Commit**: d7d58ff
- **Severity**: MEDIUM
- **Category**: Purpose & frequency, Physicality & origin
- **Estimated scope**: 2 files (Cafeteriaweb/src/index.css, Cafeteriaweb/src/pages/Comandas.jsx)

## Problem

When orders arrive via Server-Sent Events (SSE) or baristas change status (`pendiente` -> `en_preparacion` -> `listo`), card elements were rendering abruptly into their columns without an entrance transition.

```jsx
/* Cafeteriaweb/src/pages/Comandas.jsx:160 — previous */
<div className="bg-[#FEE4D7]/20 dark:bg-[#2A150C] border border-[#D4B28E] rounded-3xl p-4 flex flex-col justify-between gap-3 shadow-xs hover:border-[#9F6839] transition-all">
```

## Target

Add `.card-enter` keyframe animation (`cardFadeIn`) with a subtle 6px vertical slide and opacity fade with `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`.

```css
/* target: Cafeteriaweb/src/index.css */
.card-enter {
  animation: cardFadeIn var(--duration-fast) var(--ease-out) forwards;
}

@keyframes cardFadeIn {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

## Steps

1. Declare `@keyframes cardFadeIn` and `.card-enter` in `Cafeteriaweb/src/index.css`.
2. Apply `card-enter` to the card container in `renderCard()` in `Cafeteriaweb/src/pages/Comandas.jsx`.

## Verification

- **Feel check**: Changing comanda status smoothly slides the card into the new column instead of popping abruptly.
