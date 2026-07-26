export function registeredBaseFromEnv(env = process.env) {
  const raw = [env.BASE_X, env.BASE_Y, env.BASE_Z]
  if (raw.every(value => value === undefined)) return null
  if (raw.some(value => value === undefined)) {
    throw new Error('BASE_X, BASE_Y and BASE_Z must all be provided')
  }

  const [x, y, z] = raw.map(Number)
  if (![x, y, z].every(Number.isFinite)) {
    throw new Error('BASE_X, BASE_Y and BASE_Z must be valid numbers')
  }

  return {
    position: { x, y, z },
    hasChest: env.BASE_HAS_CHEST === 'true',
    hasCraftingTable: env.BASE_HAS_CRAFTING_TABLE === 'true'
  }
}
