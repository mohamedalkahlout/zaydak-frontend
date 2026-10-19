@AGENTS.md

## Documentation rule (MANDATORY)

Whenever you add or change a feature under `src/features/<name>/`, update its docs in the same change:

- Create/update `apps/vendor/docs/features/<name>.md` from the template (Overview · Screens/routes · one Mermaid diagram · Components · State & forms · GraphQL operations · Validation · Main files · Notes) and add/refresh its row in `apps/vendor/docs/features/README.md`. Keep it under ~100 lines, exactly one Mermaid diagram, no emojis, only what exists today. Bump the `**Last updated:**` date.
- If the change affects overall structure, routes, a core flow, or state, also update the matching numbered section in `apps/vendor/docs/`.

See the repo-root `CLAUDE.md` for the full house style and the `TODO.md` backlog rule.
