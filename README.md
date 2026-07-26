# MinicraftBotIA

Experimento de agentes de IA no Minecraft Java, começando por um bot individual tentando sobreviver sozinho em um servidor local.

## Objetivo inicial

Validar, em etapas pequenas, se um agente consegue:

1. conectar no servidor;
2. observar vida, fome, posição e mundo ao redor;
3. executar ações básicas sem IA;
4. usar IA local apenas para decisões de alto nível;
5. sobreviver uma noite sem intervenção humana.

## Stack planejada

- Minecraft Java 1.21.11
- Paper Server 1.21.11
- Java instalado: 25.0.2 LTS
- Node.js instalado: 22.16.0
- npm instalado: 11.6.1
- Git instalado: 2.51.0
- GPU: RTX 3070 8 GB
- Ollama instalado, mas o serviço precisa ser iniciado/testado

## Estrutura

```text
C:\MinicraftBotIA\
├── server\          # Servidor Paper local
├── bot-smoke-test\  # Bot Mineflayer mínimo, sem IA
├── mindcraft\       # Mindcraft será colocado/configurado depois
├── profiles\        # Perfis dos agentes
├── experiments\     # Planos e resultados de experimentos
├── logs\            # Logs locais, ignorados pelo Git
├── backups\         # Backups locais, ignorados pelo Git
├── scripts\         # Scripts auxiliares
└── docs\            # Documentação do projeto
```

## Regra do projeto

Não avançar várias etapas ao mesmo tempo.

Cada etapa deve ser validada antes da próxima, para não misturar erro de servidor, rede, versão, autenticação, pathfinding e IA.

## Próxima etapa

Validar novamente o bot Mineflayer sem IA usando Minecraft/Paper 1.21.11.
