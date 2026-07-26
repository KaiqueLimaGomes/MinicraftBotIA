const observedBlocks = [
  'oak_log', 'oak_leaves', 'stone', 'coal_ore', 'iron_ore', 'crafting_table', 'chest'
]
const observedEntities = ['cow', 'sheep', 'pig', 'chicken', 'zombie', 'skeleton', 'creeper', 'spider']
const hostileEntities = new Set(['zombie', 'skeleton', 'creeper', 'spider'])

export function createStateSnapshot(bot, options = {}) {
  const inventory = inventoryCounts(bot)
  const nearbyBlocks = observedBlocks.filter(name => findBlock(bot, name, 24))
  const entities = nearbyEntities(bot, 24)
  const nearby = [...new Set([
    ...nearbyBlocks,
    ...entities.map(entity => entity.name),
    ...(nearbyBlocks.includes('oak_log') ? ['oak_tree'] : [])
  ])]
  const threat = entities.find(entity => hostileEntities.has(entity.name) && entity.distance <= 10)
  const timeOfDay = Number(bot.time?.timeOfDay ?? 0)

  const registeredBase = options.base ?? null
  const shelterStatus = options.shelterStatus ?? 'unknown'
  return {
    capturedAt: new Date().toISOString(),
    gameTick: Number(bot.time?.age ?? 0),
    position: position(bot),
    time: timeName(timeOfDay),
    timeUntilNightSeconds: secondsUntilNight(timeOfDay),
    health: Number(bot.health ?? 20),
    hunger: Number(bot.food ?? 20),
    inventory,
    inventoryFull: inventorySlotsUsed(bot) >= 36,
    nearby,
    observations: {
      blocks: nearbyBlocks,
      entities
    },
    shelterStatus,
    shelter: shelterStatus === 'present',
    tools: Object.keys(inventory).filter(isTool),
    hasCraftingTable: inventory.crafting_table > 0 ||
      nearbyBlocks.includes('crafting_table') ||
      Boolean(registeredBase?.hasCraftingTable),
    baseStatus: registeredBase ? 'known' : 'unknown',
    baseKnown: Boolean(registeredBase),
    base: registeredBase,
    hasChest: Boolean(registeredBase?.hasChest),
    threatImmediate: Boolean(threat),
    threat: threat ?? null
  }
}

export function snapshotWorldFingerprint(snapshot) {
  return JSON.stringify({
    position: snapshot.position,
    health: snapshot.health,
    hunger: snapshot.hunger,
    inventory: snapshot.inventory,
    nearby: snapshot.nearby,
    threatImmediate: snapshot.threatImmediate
  })
}

export function snapshotDecisionFingerprint(snapshot) {
  return JSON.stringify({
    position: snapshot.position,
    time: snapshot.time,
    nightUrgent: snapshot.timeUntilNightSeconds !== null &&
      snapshot.timeUntilNightSeconds <= 180,
    health: snapshot.health,
    hunger: snapshot.hunger,
    inventory: snapshot.inventory,
    inventoryFull: snapshot.inventoryFull,
    nearby: snapshot.nearby,
    shelterStatus: snapshot.shelterStatus,
    baseStatus: snapshot.baseStatus,
    hasCraftingTable: snapshot.hasCraftingTable,
    hasChest: snapshot.hasChest,
    threatImmediate: snapshot.threatImmediate
  })
}

export const snapshotFingerprint = snapshotDecisionFingerprint

function inventoryCounts(bot) {
  const counts = {}
  for (const item of bot.inventory?.items?.() ?? []) {
    counts[item.name] = (counts[item.name] ?? 0) + item.count
  }
  return counts
}

function inventorySlotsUsed(bot) {
  return (bot.inventory?.items?.() ?? []).length
}

function nearbyEntities(bot, radius) {
  const origin = bot.entity?.position
  if (!origin) return []
  return Object.values(bot.entities ?? {})
    .filter(entity => entity !== bot.entity)
    .map(entity => ({
      name: entity.name ?? entity.mobType?.toLowerCase(),
      distance: Number(origin.distanceTo(entity.position).toFixed(1)),
      position: plainPosition(entity.position)
    }))
    .filter(entity => entity.name && observedEntities.includes(entity.name) && entity.distance <= radius)
    .sort((a, b) => a.distance - b.distance)
}

function findBlock(bot, name, maxDistance) {
  const id = bot.registry?.blocksByName?.[name]?.id
  if (id === undefined) return false
  return Boolean(bot.findBlock?.({ matching: id, maxDistance, count: 1 }))
}

function position(bot) {
  return plainPosition(bot.entity?.position)
}

function plainPosition(pos) {
  if (!pos) return null
  return {
    x: Number(pos.x.toFixed(1)),
    y: Number(pos.y.toFixed(1)),
    z: Number(pos.z.toFixed(1))
  }
}

export function timeName(tick) {
  if (tick < 1000) return 'morning'
  if (tick < 9000) return 'day'
  if (tick < 13000) return 'dusk'
  if (tick < 23000) return 'night'
  return 'dawn'
}

export function secondsUntilNight(tick) {
  if (tick >= 13000 && tick < 23000) return 0
  const ticksUntilNight = tick < 13000 ? 13000 - tick : 24000 - tick + 13000
  return Math.round(ticksUntilNight / 20)
}

function isTool(name) {
  return /_(pickaxe|axe|sword|shovel|hoe)$/.test(name)
}
