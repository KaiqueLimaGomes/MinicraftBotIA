# Checklist do projeto

## Etapa 1 — Ambiente-base

- [x] Java instalado
- [x] Node.js instalado
- [x] npm instalado
- [x] Git instalado
- [x] Driver NVIDIA reconhecendo RTX 3070
- [ ] Ollama rodando sem aviso de conexão
- [ ] Modelo local baixado e testado

Comandos:

```powershell
java -version
node --version
npm --version
git --version
ollama --version
nvidia-smi
```

## Etapa 2 — Servidor Minecraft sem IA

- [x] Baixar Paper 1.21.11
- [x] Colocar `paper-1.21.11-116.jar` em `C:\MinicraftBotIA\server`
- [x] Rodar `server\start-server.bat`
- [x] Aceitar EULA
- [x] Aplicar configuração de `server.properties.template`
- [x] Entrar manualmente no servidor
- [ ] Validar mundo, mobs, mineração, ciclo dia/noite e salvamento

## Etapa 3 — Bot Mineflayer sem IA

- [x] Instalar dependências do `bot-smoke-test`
- [x] Conectar bot no servidor
- [x] Enviar mensagem no chat
- [x] Ler vida/fome/posição
- [x] Andar alguns blocos
- [x] Desconectar corretamente
- [x] Retestar sem `PartialReadError` em Paper/Minecraft 1.21.11

## Etapa 4 — Ollama

- [x] Iniciar Ollama
- [x] Baixar modelo `sweaterdog/andy-4:micro-q8_0`
- [x] Baixar `embeddinggemma`
- [x] Testar resposta do modelo
- [ ] Verificar uso da RTX 3070
- [x] Comparar Andy-4 Micro com Qwen para planejamento estruturado
- [x] Instalar `qwen3:4b-instruct-2507-q4_K_M`
- [x] Executar benchmark inicial de planner
- [ ] Implementar validator + autocorreção + fallback

## Etapa 5 — Mindcraft

- [ ] Instalar Mindcraft
- [ ] Criar perfil do primeiro agente
- [ ] Conectar agente no servidor
- [ ] Executar missão: coletar 4 troncos e retornar ao spawn

## Etapa 6 — Sobrevivência individual

- [ ] Coletar 16 troncos
- [ ] Criar bancada
- [ ] Criar ferramenta
- [ ] Obter comida
- [ ] Comer quando necessário
- [ ] Fazer abrigo
- [ ] Sobreviver uma noite
- [ ] Registrar resultado em `experiments`
