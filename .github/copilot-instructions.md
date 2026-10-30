# Repository instructions for Copilot (code review and chat)

- Stack: React 18 + Vite (frontend), Node 20 + Express, ES modules (bff), Java 21 + Spring Boot 3 (api).
- Tests: Vitest + Testing Library (frontend), `node:test` (bff), JUnit 5 + MockMvc (api).
- Every behaviour change needs a test. Flag source changes that have none.
- The BFF is the only caller of the Java API. The browser must never call the API directly.
- Never log or commit secrets. Flag any string that looks like a key or token.
- Deployment is in-place with AWS CodeDeploy; flag changes to `appspec.yml`, `scripts/deploy/` or `config/` as high risk.
