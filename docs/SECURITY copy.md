# Security Policy

## Supported Versions

Use this section to tell people about which versions of your project are
currently being supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| 0.0.x   | :white_check_mark: |

## Reporting a Vulnerability

We take the security of our software seriously. If you suspect you have found a vulnerability, please report it immediately.

### How to Report

Please **do not** open a public issue on GitHub. Instead, please email us at **security@study-saga.com** (or your contact email) with the following details:

1.  **Description**: A detailed description of the vulnerability.
2.  **Steps to Reproduce**: Steps to reproduce the issue.
3.  **Impact**: The potential impact of the vulnerability.

We will acknowledge your report within 48 hours and provide an estimated timeline for a fix.

## Known Risks & Mitigations

### Supabase Realtime Chat
The current global chat implementation uses Supabase Realtime Broadcasts. This is an ephemeral, low-latency channel.
-   **Risk**: Broadcast channels do not natively enforce database-level Row Level Security (RLS).
-   **Mitigation**: We are migrating to a database-backed chat system to enforce strict server-side moderation and banning policies.
-   **Advisory**: Until the migration is complete, the chat should be considered "public" and "unmoderated" at the protocol level, even if the UI hides messages.

### Client-Side Secrets
This project is open source (AGPLv3).
-   **Risk**: Exposure of API keys.
-   **Mitigation**: We strictly use `import.meta.env` for all configuration. No secrets are hardcoded. The `VITE_SUPABASE_ANON_KEY` is public by design, but sensitive operations are protected by RLS and RPCs.

## Security Best Practices for Contributors

-   **Never commit secrets**: Ensure `.env` is always in `.gitignore`.
-   **Validate inputs**: Always validate user input on both client and server (RPCs).
-   **Least Privilege**: Ensure RLS policies are as restrictive as possible.
