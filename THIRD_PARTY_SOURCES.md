# AgentiCOS Third-Party Sources

AgentiCOS intentionally incorporates or evaluates open-source agent software.

Every imported repository must be recorded with:

- repository URL;
- exact commit;
- license evidence;
- imported path;
- integration mode;
- modifications;
- dependency/license review status.

Current planned sources:

| Source | License checked | Intended use |
|---|---|---|
| NousResearch/hermes-agent | MIT repository license | agent capabilities, skills, memory, tools, providers |
| deepseek-ai/deepseek-harness | MIT repository license | plugin architecture, events, profiles, sessions, composition |
| Microsoft AutoGen | MIT code license; repository can contain separately licensed material | multi-agent orchestration patterns |
| OpenHands/OpenHands | MIT for core project; enterprise content needs separate review | coding agents, runtimes, server/session architecture |
| browser-use/browser-use | MIT package metadata | browser agent/runtime capabilities |
| langchain-ai/langgraph | MIT for LangGraph package | durable graph/workflow orchestration |

The table is a project intake list, not a blanket claim that every file or dependency inside each repository is MIT. DeepSeek Harness explicitly notes that third-party dependencies retain their own licenses, and its repository generates third-party notices. citeturn727260search13

Before integration, AgentiCOS must inspect the exact commit, file/package boundary, dependency closure and applicable license notices.

## License rule

An MIT root repository does not automatically make all code in its dependency tree MIT.

AgentiCOS must preserve required copyright/license notices and must not remove third-party attribution when integrating source code.
