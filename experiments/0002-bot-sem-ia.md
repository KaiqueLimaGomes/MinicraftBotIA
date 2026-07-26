# Experimento 0002 — Bot sem IA

## Objetivo

Validar conexão Mineflayer antes de usar LLM ou Mindcraft.

## Critérios de aprovação

- [x] Bot conecta
- [x] Bot envia mensagem no chat
- [x] Bot lê vida e fome
- [x] Bot lê posição
- [x] Bot anda alguns blocos
- [x] Bot desconecta corretamente

## Observações

O teste básico passou em 26/07/2026 usando `mineflayer`.

Saída relevante:

```text
[spawn] AgenteTeste entrou no servidor.
[health update] vida=20 fome=20 posição=-3.5, 123.0, -3.5
[após andar] vida=20 fome=20 posição=-3.5, 107.0, 4.7
[end] Bot desconectado.
```

Durante a sessão apareceram erros `PartialReadError` relacionados a `entity_metadata`.
Eles não impediram conexão, leitura de status, movimento ou desconexão, mas devem ser investigados antes de depender de comportamento avançado.

Novo teste em Minecraft/Paper 1.21.8:

- servidor 1.21.8 abriu corretamente;
- jogador humano entrou e quebrou blocos;
- bot conectou, leu status, andou e saiu;
- `PartialReadError` persistiu;
- auto-detecção de versão do Mineflayer também manteve o erro.

Hipóteses restantes:

- incompatibilidade específica entre Paper 1.21.8 e parser de `entity_metadata`;
- metadata de alguma entidade/jogador visível ao bot;
- bug ainda presente na pilha Prismarine/Mineflayer para alguns pacotes de 1.21.8.

Teste adicional:

- jogador humano saiu do servidor;
- servidor ficou vazio;
- bot foi executado sozinho;
- `PartialReadError` persistiu.

Hipótese descartada:

- metadata do jogador humano visível ao bot.

Próximas comparações úteis:

1. testar servidor Vanilla oficial 1.21.8;
2. se persistir, testar uma versão mais antiga e madura para Mineflayer, como 1.20.4/1.20.6.

## Reteste em 1.21.11

Configuração:

- Paper 1.21.11 build 116;
- Mineflayer atual;
- versão auto-detectada pelo bot.

Resultado:

```text
[spawn] AgenteTeste entrou no servidor.
[status inicial] vida=undefined fome=undefined posição=-3.5, 123.0, -3.5
[health update] vida=20 fome=20 posição=-3.5, 123.0, -3.5
[após andar] vida=20 fome=20 posição=-3.5, 107.0, 4.7
[end] Bot desconectado.
```

Nenhum `PartialReadError` apareceu.

Conclusão:

```text
Paper/Minecraft 1.21.11 é a base recomendada para continuar o projeto.
```

## Resultado

Aprovado com aviso.
