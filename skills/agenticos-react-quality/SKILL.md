---
name: agenticos-react-quality
description: React/TypeScript quality rules for AgentiCOS
---

# AgentiCOS React Quality Skill

Keep components small, typed and feature-oriented.

Rules:

- no `any` for convenience;
- avoid network calls in leaf UI components;
- route backend access through typed services;
- clean up subscriptions/effects;
- design loading/error/empty/streaming states;
- preserve keyboard and screen-reader semantics;
- avoid unnecessary global state;
- use stable keys;
- avoid premature memoization;
- keep provider/model logic outside visual components;
- run TypeScript typecheck and targeted tests after changes.

Use the repository design-system tokens instead of arbitrary visual values.
