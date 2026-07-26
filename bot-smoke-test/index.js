import mineflayer from 'mineflayer'

const config = {
  host: process.env.MC_HOST ?? '127.0.0.1',
  port: Number(process.env.MC_PORT ?? 25565),
  username: process.env.MC_USERNAME ?? 'AgenteTeste',
  auth: process.env.MC_AUTH ?? 'offline'
}

if (process.env.MC_VERSION) {
  config.version = process.env.MC_VERSION
}

const bot = mineflayer.createBot(config)

bot.once('spawn', async () => {
  console.log(`[spawn] ${bot.username} entrou no servidor.`)
  bot.chat('Olá! Sou o bot de teste sem IA.')

  printStatus('status inicial')

  bot.setControlState('forward', true)
  await wait(2500)
  bot.setControlState('forward', false)

  printStatus('após andar')

  bot.chat('Teste básico concluído. Desconectando.')
  await wait(1000)
  bot.quit('Teste básico concluído.')
})

bot.on('health', () => {
  printStatus('health update')
})

bot.on('kicked', (reason) => {
  console.error('[kicked]', reason)
})

bot.on('error', (error) => {
  console.error('[error]', error)
})

bot.on('end', () => {
  console.log('[end] Bot desconectado.')
})

function printStatus(label) {
  const pos = bot.entity?.position
  console.log(`[${label}] vida=${bot.health} fome=${bot.food} posição=${formatPos(pos)}`)
}

function formatPos(pos) {
  if (!pos) return 'desconhecida'
  return `${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
