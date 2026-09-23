# AgentiCOS — AI Skill Catalog

This repository keeps a local operational copy of the most important development playbooks so a future coding agent does not depend on conversational memory.

## Installed runtime skills used as references

| Skill | Runtime source | Use |
|---|---|---|
| Browser automation | `skills://plugins/vercel/agent-browser/skill.md` | interact with dev servers, snapshots, screenshots, flows |
| Browser verification | `skills://plugins/vercel/agent-browser-verify/skill.md` | load/error/blank-page/interaction verification |
| React quality | `skills://plugins/vercel/react-best-practices/skill.md` | React/TypeScript component quality review |
| AI SDK | `skills://plugins/vercel/ai-sdk/skill.md` | AI streaming, tools, agents, provider integrations |
| AI Elements | `skills://plugins/vercel/ai-elements/skill.md` | AI-native UI primitives and tool-call rendering |
| Persistence | `skills://plugins/vercel/ai-generation-persistence/skill.md` | durable AI generation/session storage |
| shadcn/ui | `skills://plugins/vercel/shadcn/skill.md` | UI primitives, design tokens, composition |

The runtime skills are available in the development environment. The repository-local playbooks below are the durable fallback for future agents.

## Repository-local playbooks

- `skills/agenticos-architecture/SKILL.md`
- `skills/agenticos-browser-verification/SKILL.md`
- `skills/agenticos-react-quality/SKILL.md`
- `skills/agenticos-ai-ui/SKILL.md`
- `skills/agenticos-design-system/SKILL.md`

## Loading rule

When a task touches the frontend, read:

1. `AGENTS.md`
2. `reference/PROJECT-STATE.md`
3. `reference/manifests/implementation-state.json`
4. `docs/architecture/CANONICAL-ARCHITECTURE.md`
5. `docs/architecture/FRONTEND-ARCHITECTURE.md`
6. the relevant local skill;
7. the latest frontend changelog entry.

A skill is guidance, not evidence. Repository code, tests and CI remain the source of truth.
