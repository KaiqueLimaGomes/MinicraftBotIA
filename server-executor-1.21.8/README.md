# Paper 1.21.8 executor laboratory

Isolated and disposable compatibility server for Experiment 0007A.

- Minecraft/Paper: 1.21.8 build 60
- game port: 25566
- RCON port: 25576
- world: `world-executor`
- no world data is copied from the 1.21.11 server

The real `server.properties`, Paper jar, world and RCON password are ignored by
Git. This server is not a migration target; it only supports the A/B physical
compatibility matrix.
