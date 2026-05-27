# Security Policy

## Reporting a vulnerability

If you discover a security vulnerability in `anigamer`, **please do not open a public issue**.

Instead, use one of:

- **GitHub Private Vulnerability Reporting**: <https://github.com/timo9378/anigamer/security/advisories/new>
- **Email**: `timo9378@gmail.com` with subject `[anigamer security]`

Expect an initial response within 7 days. After triage, we will work with you on a fix and coordinate disclosure.

## Scope

This SDK runs your Bahamut credentials through HTTP to `api.gamer.com.tw`. In-scope concerns:

- Cookie / JWT handling bugs that could leak credentials
- Code execution paths from untrusted server responses (regex DoS, prototype pollution, JSON.parse on huge bodies, etc.)
- Dependency vulnerabilities in `devDependencies` that affect published artifacts

Out of scope:

- Bahamut's own API security (report directly to 巴哈姆特)
- Issues in third-party reverse-engineering tools used to obtain cookies
- Theoretical attacks requiring an already-compromised local environment

## Best practices for users

- **Never commit your cookies.** Use env vars or persisted state outside the repo.
- **Treat persisted cookie files like passwords.** `chmod 600` them.
- **Rotate by re-logging in to ani.gamer.com.tw** if you accidentally expose your `BAHARUNE` JWT — it will invalidate the old token.
