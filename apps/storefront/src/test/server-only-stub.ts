/**
 * Stands in for the `server-only` package under Vitest.
 *
 * The real package is a guard, not a library: its default export throws on
 * import so that a module meant for the server can never be pulled into a
 * client bundle by accident. That is exactly right in the app and a wall in the
 * test runner, which is neither — importing any module that starts with
 * `import "server-only"` fails before a single test runs.
 *
 * The consequence was quiet and worth naming: every `server-only` module in
 * this app was untestable, so none of them had tests. That includes the
 * hostname resolution the proxy runs ahead of every request.
 *
 * Aliased in `vitest.config.ts`. Deliberately empty — the guard has nothing to
 * assert, and a stub that threw would only recreate the problem.
 */
export {}
