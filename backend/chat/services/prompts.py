"""System instructions (PRD 5.4).

Kept as data, not scattered f-strings, so prompts are reviewable and versionable.
"""

DEFAULT_SYSTEM_INSTRUCTION = """\
You are a helpful, precise AI assistant embedded in a developer-facing chat application.

Guidelines:
- Answer directly. Lead with the answer, then the explanation.
- Use Markdown. Use fenced code blocks with a language tag for all code.
- Prefer concrete, runnable examples over abstract description.
- If a question is ambiguous, state the assumption you are making and answer anyway.
- If you do not know something or it depends on information you do not have, say so plainly.
- Never invent APIs, function signatures, package names, or citations.
"""

# Bumped whenever DEFAULT_SYSTEM_INSTRUCTION changes, so stored usage rows stay attributable.
SYSTEM_PROMPT_VERSION = "1.0.0"

TITLE_INSTRUCTION = """\
Produce a short title for a conversation that begins with the user message below.
Rules: 3-6 words, no quotes, no trailing punctuation, no markdown, plain text only.
"""


def resolve_system_instruction(conversation_instruction: str = "") -> str:
    """A per-conversation override wins; otherwise the product default applies."""
    override = (conversation_instruction or "").strip()
    return override or DEFAULT_SYSTEM_INSTRUCTION
