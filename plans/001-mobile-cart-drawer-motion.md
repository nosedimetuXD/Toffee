# 001 — Mobile Sales Cart Drawer Spring Transition

- **Status**: DONE
- **Commit**: d7d58ff
- **Severity**: HIGH
- **Category**: Easing & duration, Physicality & origin
- **Estimated scope**: 2 files (Cafeteriaweb/src/index.css, Cafeteriaweb/src/pages/Sales.jsx)

## Problem

On mobile screens, the sales cart drawer was previously using generic CSS transitions (`transition-transform duration-300 ease-out`), which created a linear, mechanical feel upon opening and closing. Furthermore, the bottom sheet lacked a visual drag affordance handle, creating ambiguity about whether the cart could be pulled down or minimized.

```jsx
/* Cafeteriaweb/src/pages/Sales.jsx:776 — previous */
<div className={`fixed lg:static bottom-0 left-0 right-0 z-50 ... transition-transform duration-300 ease-out ${
  isMobileCartOpen ? 'translate-y-0' : 'translate-y-full lg:translate-y-0'
}`}>
```

## Target

Apply the iOS-standard drawer curve `--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)` with `will-change: transform`, an interactive visual pull handle (`w-12 h-1.5 rounded-full bg-[#9F6839]/40`), and backdrop fade transition.

```css
/* target: Cafeteriaweb/src/index.css */
.drawer-motion {
  transition: transform var(--duration-drawer) var(--ease-drawer);
  will-change: transform;
}
```

```jsx
/* target: Cafeteriaweb/src/pages/Sales.jsx */
<div className={`fixed lg:static bottom-0 left-0 right-0 z-50 ... drawer-motion ${
  isMobileCartOpen ? 'translate-y-0' : 'translate-y-full lg:translate-y-0'
}`}>
  <div className="lg:hidden w-12 h-1.5 rounded-full bg-[#9F6839]/40 dark:bg-[#DABA8C]/30 mx-auto mb-2.5 cursor-grab" onClick={() => setIsMobileCartOpen(false)} />
  ...
</div>
```

## Repo conventions to follow

- Motion tokens live in `Cafeteriaweb/src/index.css` under `:root`.
- Curves: `--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);`, `--duration-drawer: 320ms;`.
- Respect `prefers-reduced-motion: reduce`.

## Steps

1. In `Cafeteriaweb/src/index.css`, declare `--ease-drawer` and `.drawer-motion` utility class.
2. In `Cafeteriaweb/src/pages/Sales.jsx`, replace `transition-transform duration-300 ease-out` with `drawer-motion`.
3. Add the top pill handle `<div className="lg:hidden w-12 h-1.5 rounded-full bg-[#9F6839]/40..." />`.

## Boundaries

- Do NOT touch order processing, cart calculation, or checkout APIs.
- Do NOT alter desktop sidebar layout (`lg:w-96 lg:static`).

## Verification

- **Mechanical**: `go build` passes, React bundles with 0 syntax errors.
- **Feel check**:
  - Open mobile drawer: sheet slides up crisply with deceleration at the top.
  - Tap backdrop or handle: sheet slides down smoothly without layout jank.
  - In DevTools 10% animation speed: confirm `cubic-bezier(0.32, 0.72, 0, 1)` curve is active.
- **Done when**: Drawer movement feels native to mobile touch devices.
