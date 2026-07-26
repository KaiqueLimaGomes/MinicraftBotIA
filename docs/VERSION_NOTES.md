# Notas de versão

## Migração para 1.21.11

Em 26/07/2026, após o `PartialReadError` persistir em 1.21.8, o projeto foi ajustado para testar Minecraft/Paper 1.21.11.

Motivo:

- o Mineflayer atual registra suporte a Minecraft 1.21.11;
- o Mindcraft informa suporte até 1.21.11;
- 1.21.8 não removeu o erro de `entity_metadata`.

Versão atual em teste:

```text
Minecraft Java Vanilla: 1.21.11
Paper Server: 1.21.11 build 116
Bot Mineflayer: auto-detect/1.21.11
```

Resultado:

- bot conectou;
- leu status;
- andou;
- desconectou;
- nenhum `PartialReadError` apareceu.

Decisão:

```text
Usar 1.21.11 como base do projeto.
```

## Migração para 1.21.8

Em 26/07/2026, o projeto foi ajustado de Minecraft/Paper 1.21.6 para 1.21.8.

Motivo:

- o bot Mineflayer conectou em 1.21.6, mas gerou erros `PartialReadError` em `entity_metadata`;
- o Mineflayer atual registra suporte explícito a Minecraft 1.21.8;
- o projeto ainda está no início, então migrar agora reduz risco antes da camada de IA.

Versão testada:

```text
Minecraft Java Vanilla: 1.21.8
Paper Server: 1.21.8 build 60
Bot Mineflayer: 1.21.8
```
