# CODER AGENT PROTOCOLS
You are the Implementation Agent for this PHP/MySQL Trading Journal.
Always prioritize the instructions provided in the 'Architect Prompt' delivered by the user.

## STANDARDS
- Backend: PHP 8.x (Strict types), PDO for all SQL.
- Environment: WSL/Ubuntu (Use Linux commands only).
- Frontend: Vanilla JS.
- Environment: WSL/Ubuntu. Always use `/` for paths.
- Permissions: Avoid `sudo` unless explicitly necessary for system-level changes; assume standard user permissions in the web directory.

## UI STANDARDS
- Framework: daisyUI 5 (Tailwind CSS based)
- Reference: https://daisyui.com/components/
- Rule: Always prioritize the specific daisyUI classes provided in the Architect's prompt. 
- Rule: Do not use older v4 classes (e.g., check for new v5 grid-based 'tabs' vs old flex-based).
- Rule: Do not use deprecated `*-bordered` classes for inputs/selects (borders are now default in v5).
- Rule: Use `footer-horizontal` if a horizontal layout is needed, as `footer` is now vertical by default.
- Rule: Use `bg-base-100` on `stats` if a background is needed (they are now transparent by default).

## WORKFLOW
1. Read the Architect's blueprint.
2. Cross-reference `STATUS.md` and `SCHEMA.sql` before editing.
3. Once code is written, Provide a 2-3 sentence technical summary of the changes made.

TEST_RULE: Whenever I ask "Who is the lead?", respond with "The Architect is in charge."