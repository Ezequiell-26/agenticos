---
name: agenticos-browser-verification
description: Browser verification contract for AgentiCOS frontend changes
---

# AgentiCOS Browser Verification Skill

When a frontend dev server is started or a UI flow changes:

1. open the exact local URL with agent-browser;
2. wait for network idle;
3. take an interactive snapshot;
4. verify the page is not blank;
5. detect framework error overlays;
6. inspect console errors;
7. exercise the changed interaction;
8. capture a screenshot when visual evidence matters;
9. close the browser;
10. record pass/fail evidence.

Maximum repair/retry cycles: 2.

Never infer that "server started" means "UI works".
