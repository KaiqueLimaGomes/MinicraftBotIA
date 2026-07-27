import fs from 'node:fs/promises'
import path from 'node:path'

const experimentId = process.env.PHYSICAL_EXPERIMENT ?? '0007A'
const conditions = [
  '1.21.11-none',
  '1.21.11-pathfinder',
  '1.21.8-none',
  '1.21.8-pathfinder'
]
const directory = path.resolve(`experiment-results/${experimentId}`)
const reports = []

for (const condition of conditions) {
  try {
    reports.push(JSON.parse(await fs.readFile(
      path.join(directory, `${condition}.json`),
      'utf8'
    )))
  } catch {
    reports.push({ condition, status: 'MISSING', results: [], digAttempts: [] })
  }
}

function p95(values) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.ceil(sorted.length * 0.95) - 1]
}

const summary = reports.map((report) => {
  const attempts = report.digAttempts ?? []
  const results = report.results ?? []
  const collections = results
    .map((row) => row.evidence?.collection)
    .filter(Boolean)
  return {
    condition: report.condition,
    status: report.status,
    attempts: attempts.length,
    digResolved: attempts.filter((row) => row.digResolved).length,
    blockChanged: attempts.filter((row) => row.blockChanged).length,
    inventoryIncreased: attempts.filter(
      (row) => (row.inventoryDelta?.oak_log ?? 0) > 0
    ).length,
    skillSucceeded: results.filter((row) => row.success).length,
    dropsObserved: collections.filter((row) => row.dropsObserved > 0).length,
    dropsCollected: collections.filter(
      (row) => row.code === 'DROP_COLLECTED'
    ).length,
    collectionTimeouts: collections.filter(
      (row) => row.code === 'DROP_COLLECTION_TIMEOUT'
    ).length,
    collectionAborts: collections.filter(
      (row) => row.code === 'DROP_ABORTED'
    ).length,
    grounded: attempts.filter((row) => row.onGroundBeforeDig).length,
    digP95Ms: p95(attempts.map((row) => row.elapsedMs)),
    skillP95Ms: p95(results.map((row) => row.durationMs))
  }
})
const complete = summary.every(
  (row) => row.status === 'COMPLETE' && row.attempts === 5
)
const passed = complete && summary.every((row) =>
  row.digResolved === 5 &&
  row.blockChanged === 5 &&
  row.dropsCollected === 5 &&
  row.skillSucceeded === 5 &&
  row.collectionTimeouts === 0 &&
  row.collectionAborts === 0
)
const aggregate = {
  experiment: experimentId,
  generatedAt: new Date().toISOString(),
  status: complete ? 'COMPLETE' : 'INCOMPLETE',
  passed,
  summary
}
await fs.mkdir(directory, { recursive: true })
await fs.writeFile(
  path.join(directory, `${experimentId}-latest.json`),
  `${JSON.stringify(aggregate, null, 2)}\n`
)
const markdown = [
  `# Experimento ${experimentId} - Matriz de compatibilidade fisica`,
  '',
  `Status: ${aggregate.status}`,
  `Passed: ${aggregate.passed}`,
  '',
  '| Condicao | Tentativas | Dig resolveu | Bloco mudou | Drop visto | Drop coletado | Skill OK | Timeout | Abort | Dig p95 | Skill p95 |',
  '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
  ...summary.map((row) =>
    `| ${row.condition} | ${row.attempts} | ${row.digResolved} | ` +
    `${row.blockChanged} | ${row.dropsObserved} | ${row.dropsCollected} | ` +
    `${row.skillSucceeded} | ${row.collectionTimeouts} | ` +
    `${row.collectionAborts} | ${row.digP95Ms ?? '-'} ms | ` +
    `${row.skillP95Ms ?? '-'} ms |`
  )
]
await fs.writeFile(
  path.join(directory, `${experimentId}-latest.md`),
  `${markdown.join('\n')}\n`
)
console.log(markdown.join('\n'))
