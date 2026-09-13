# 003 — Modal Dialog Subtle Scale & Entrance

- **Status**: DONE
- **Commit**: d7d58ff
- **Severity**: MEDIUM
- **Category**: Physicality & origin, Easing & duration
- **Estimated scope**: 2 files (Cafeteriaweb/src/index.css, Cafeteriaweb/src/components/Modal.jsx)

## Problem

Generic scale pop (`zoom-in-95`) on modals lacked calibrated cubic-bezier deceleration curves.

## Target

Implement `.modal-enter` with `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)` and initial `scale(0.96) translateY(4px)` (avoiding `scale(0)`).

```css
/* target: Cafeteriaweb/src/index.css */
.modal-enter {
  animation: modalIn var(--duration-fast) var(--ease-out) forwards;
}

@keyframes modalIn {
  from {
    opacity: 0;
    transform: scale(0.96) translateY(4px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
```

## Verification

- **Feel check**: Opening modals in POS, Customers, Inventory and Accounting displays a polished, high-end dialog appearance.
