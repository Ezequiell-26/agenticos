---
name: agenticos-architecture
description: Repository-safe architecture workflow for AgentiCOS
---

# AgentiCOS Architecture Skill

Before editing, read the state manifest, project state, operation journal and relevant architecture contract.

Rules:

- one authorized implementation step at a time;
- preserve existing code/history by default;
- never invent repository/API/license facts;
- use registered source evidence for non-trivial integrations;
- keep domain/application/infrastructure/presentation boundaries explicit;
- do not create duplicate crates or parallel ownership trees;
- record rollback and verification evidence;
- never mark a step verified without evidence.

For frontend work also read `docs/architecture/FRONTEND-ARCHITECTURE.md`.

Every operation reports: changed, created, deleted, preserved, verified, unverified, risks, rollback point and exactly one next step.
