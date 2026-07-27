import mineflayer from 'mineflayer'

const config = {
  host: process.env.MC_HOST ?? '127.0.0.1',
  port: Number(process.env.MC_PORT ?? 25565),
  username: process.env.MC_USERNAME ?? 'AgenteShadow',
  auth: process.env.MC_AUTH ?? 'offline'
}
if (process.env.MC_VERSION) config.version = process.env.MC_VERSION

const timeoutMs = Number(process.env.PREPARE_TIMEOUT_MS ?? 300000)
const bot = mineflayer.createBot(config)
let finished = false
let inventoryPrintTimer

bot.once('spawn', () => {
  bot.inventory.on('updateSlot', scheduleInventoryPrint)
  console.log(`[prepare] ${bot.username} connected without planner or snapshots.`)
  console.log('[prepare] Apply server-console commands now. Press Ctrl+C when ready.')
  printState()
})

bot.on('health', printState)
function scheduleInventoryPrint() {
  clearTimeout(inventoryPrintTimer)
  inventoryPrintTimer = setTimeout(printState, 100)
}
bot.on('kicked', reason => console.error('[prepare:kicked]', reason))
bot.on('error', error => console.error('[prepare:error]', error))
bot.on('end', () => {
  finished = true
  console.log('[prepare:end] Player state was left for the server to persist.')
})

const timeout = setTimeout(() => shutdown('Preparation timeout'), timeoutMs)

process.once('SIGINT', () => shutdown('Preparation completed by user'))
process.once('SIGTERM', () => shutdown('Preparation terminated'))

function printState() {
  if (!bot.entity) return
  const position = bot.entity.position
  const inventory = bot.inventory.items()
    .map(item => `${item.name}:${item.count}`)
    .join(', ') || 'empty'
  console.log(
    `[prepare:state] health=${bot.health} hunger=${bot.food} ` +
    `position=${position.x.toFixed(1)},${position.y.toFixed(1)},${position.z.toFixed(1)} ` +
    `inventory=${inventory}`
  )
}

function shutdown(reason) {
  if (finished) return
  finished = true
  clearTimeout(timeout)
  clearTimeout(inventoryPrintTimer)
  console.log(`[prepare] ${reason}`)
  bot.quit(reason)
}
