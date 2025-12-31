---
description: detailed audit of agent overlap and token usage.
allowed-tools: [Bash, Read]
---
# Compliance Check

Run a check on `.claude/agents/*.md`:

1. **Overlap Check**: Do any two agents have descriptions that share more than 2 keywords? (e.g. "React Native")
2. **Token Check**: Does any agent load more than 3 skills?
3. **Tool Check**: Does an agent have `Write` access if it's only a "Strategist"?

Output a table of "Violations" and "Suggested Fixes".