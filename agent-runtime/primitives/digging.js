import { setTimeout as delay } from 'node:timers/promises'

export function stopDigging(bot) {
  try {
    bot.stopDigging?.()
  } catch {
    // Best effort during timeout cleanup.
  }
}

export async function waitUntilGrounded(bot, {
  stableMs = 500,
  timeoutMs = 3_000,
  signal
} = {}) {
  const startedAt = Date.now()
  let groundedSince = null

  while (Date.now() - startedAt < timeoutMs) {
    if (signal?.aborted) return false
    if (bot.entity?.onGround) {
      groundedSince ??= Date.now()
      if (Date.now() - groundedSince >= stableMs) return true
    } else {
      groundedSince = null
    }
    await delay(50)
  }
  return false
}

function positionOf(block) {
  return {
    x: block.position.x,
    y: block.position.y,
    z: block.position.z
  }
}

export async function digCancelable(bot, block, context, {
  serverVersion = null,
  attemptNumber = null,
  recordAttempt = () => {}
} = {}) {
  context.assertActive()
  if (!bot.canDigBlock?.(block)) {
    throw new Error(`Block ${block?.name ?? 'unknown'} is not diggable`)
  }

  const logsBefore = bot.inventory?.items?.()
    ?.filter((item) => item.name === block.name)
    .reduce((sum, item) => sum + item.count, 0) ?? 0
  const attempt = {
    serverVersion,
    botVersion: bot.version ?? null,
    block: block.name,
    position: positionOf(block),
    distance: bot.entity.position.distanceTo(block.position),
    canDigBlock: bot.canDigBlock(block),
    onGroundBeforeLook: bot.entity.onGround,
    onGroundBeforeDig: null,
    estimatedDigTimeMs: bot.digTime?.(block) ?? null,
    heldItem: bot.heldItem?.name ?? null,
    attemptNumber,
    startedAt: new Date().toISOString(),
    startedAtMs: Date.now(),
    status: 'started',
    diggingCompletedEvents: 0,
    diggingAbortedEvents: 0,
    airBlockUpdates: 0,
    blockChanged: false,
    inventoryDelta: { [block.name]: 0 },
    digResolved: false,
    timedOut: false,
    abortReason: null
  }
  recordAttempt(attempt)

  const onCompleted = () => { attempt.diggingCompletedEvents += 1 }
  const onAborted = () => { attempt.diggingAbortedEvents += 1 }
  const onBlockUpdate = (oldBlock, newBlock) => {
    if (oldBlock?.position?.equals?.(block.position) && newBlock?.type === 0) {
      attempt.airBlockUpdates += 1
    }
  }
  bot.on('diggingCompleted', onCompleted)
  bot.on('diggingAborted', onAborted)
  bot.on('blockUpdate', onBlockUpdate)

  const onAbort = () => {
    attempt.abortReason = String(context.signal.reason ?? 'aborted')
    stopDigging(bot)
  }
  context.signal.addEventListener('abort', onAbort, { once: true })

  try {
    await bot.lookAt(block.position.offset(0.5, 0.5, 0.5), true)
    context.assertActive()
    attempt.onGroundBeforeDig = bot.entity.onGround
    await bot.dig(block, 'ignore', 'raycast')
    attempt.digResolved = true
    attempt.status = 'resolved'
    context.assertActive()
    return attempt
  } catch (error) {
    attempt.status = 'failed'
    attempt.error = error.message
    throw error
  } finally {
    context.signal.removeEventListener('abort', onAbort)
    bot.removeListener('diggingCompleted', onCompleted)
    bot.removeListener('diggingAborted', onAborted)
    bot.removeListener('blockUpdate', onBlockUpdate)
    const finishedAtMs = Date.now()
    attempt.finishedAt = new Date(finishedAtMs).toISOString()
    attempt.elapsedMs = finishedAtMs - attempt.startedAtMs
    attempt.blockChanged = bot.blockAt(block.position)?.type === 0
    const logsAfter = bot.inventory?.items?.()
      ?.filter((item) => item.name === block.name)
      .reduce((sum, item) => sum + item.count, 0) ?? 0
    attempt.inventoryDelta[block.name] = logsAfter - logsBefore
  }
}
