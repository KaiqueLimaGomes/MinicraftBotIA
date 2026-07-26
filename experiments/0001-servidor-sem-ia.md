# Experimento 0001 — Servidor sem IA

## Objetivo

Validar que o servidor Paper funciona sozinho antes de conectar bots ou IA.

## Configuração

- Minecraft: Java 1.21.11
- Servidor: Paper 1.21.11
- Dificuldade: normal
- Modo: survival
- PVP: false
- View distance: 6
- Simulation distance: 5

## Critérios de aprovação

- [x] Servidor inicia sem erro crítico
- [x] Mundo é gerado
- [x] Jogador humano entra
- [x] Jogador consegue andar
- [x] Jogador consegue quebrar blocos
- [ ] Mobs aparecem
- [ ] Ciclo dia/noite funciona
- [ ] Mundo salva e recarrega

## Resultado

Servidor Paper iniciou e permaneceu aberto em 26/07/2026.

Configuração ajustada para o laboratório local:

- dificuldade normal;
- PVP desativado;
- `online-mode=false`;
- `view-distance=6`;
- `simulation-distance=5`;
- `spawn-protection=0`.

As mudanças em `server.properties` exigem reinicialização do servidor para entrarem em vigor.
