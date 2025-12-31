# Claude Code Meta-Optimization Skill

## Slash Commands (`.claude/commands/`)
- Filename becomes the command (e.g., `optimize.md` -> `/optimize`).
- Use `$ARGUMENTS` for user input and `!` for bash execution.
- Use `allowed-tools` in frontmatter to enable bash/read during command execution.

## Agent Skills (`.claude/skills/`)
- Use "Progressive Disclosure": Put metadata in `SKILL.md` and details in `/references`.
- Descriptions must answer: "What does this do?" and "When should Claude use it?"

## Subagents (`.claude/agents/`)
- Always include a `description` for dynamic routing.
- Context is isolated; use subagents for "messy" terminal tasks (like Maestro or OCR).