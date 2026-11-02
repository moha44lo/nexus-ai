# NEXUS autonomy architecture

This branch is the foundation for combining a typed skill system with browser workflow automation.

## Core layers
- Skill compiler: validates declarative, versioned skills.
- Execution runtime: runs only registered tool adapters.
- Approval gate: pauses before write or destructive actions.
- Audit trail: records each step and its outcome.
- Memory: stores user-approved facts separately from conversation history.
- Browser adapter: isolated browser sessions with bounded navigation and explicit action policies.

## Safety and reliability
- No skill can execute arbitrary JavaScript.
- Tools are allowlisted by the host runtime.
- Retries are allowed only for explicitly retry-safe, idempotent tools.
- Sensitive or irreversible actions require approval.
- External actions must report their real result; the model must never claim success without confirmation.

## Delivery sequence
1. Typed skill compiler, execution runtime, and unit tests.
2. Persistent memory and run history in D1.
3. Browser automation adapter with per-domain permissions.
4. Scheduled workflows, recovery, and monitoring.
