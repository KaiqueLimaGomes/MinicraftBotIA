# Third-party notices

## minecraft-agent-swarm

The executor reliability design was informed by:

- project: `JesseRWeigel/minecraft-agent-swarm`;
- commit: `e69eaa2878b38adacffb4a5dab70d2c2740546ba`;
- copyright: 2024-2026 Jesse Weigel;
- license: MIT.

The upstream watchdog, per-bot mutual exclusion and cleanup patterns were
reviewed before this module was implemented. The MinicraftBotIA runtime is an
independent implementation with a smaller allowlist and its own contracts,
tests and structured results.

The complete upstream MIT license is available at:
https://github.com/JesseRWeigel/minecraft-agent-swarm/blob/e69eaa2878b38adacffb4a5dab70d2c2740546ba/LICENSE
