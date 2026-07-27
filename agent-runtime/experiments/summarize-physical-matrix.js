import fs from 'node:fs/promises'
import path from 'node:path'

const conditions = [
  '1.21.11-none',
  '1.21.11-pathfinder',
  '1.21.8-none',
  '1.21.8-pathfinder'
]
const directory = path.resolve('experiment-results/0007A')
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
  return {
    condition: report.condition,
    status: report.status,
    attempts: attempts.length,
    digResolved: attempts.filter((row) => row.digResolved).length,
    blockChanged: attempts.filter((row) => row.blockChanged).length,
    inventoryIncreased: attempts.filter(
      (row) => (row.inventoryDelta?.oak_log ?? 0) > 0
    ).length,
    skillSucceeded: (report.results ?? []).filter((row) => row.success).length,
    grounded: attempts.filter((row) => row.onGroundBeforeDig).length,
    digP95Ms: p95(attempts.map((row) => row.elapsedMs)),
    skillP95Ms: p95((report.results ?? []).map((row) => row.durationMs))
  }
})
const complete = summary.every(
  (row) => row.status === 'COMPLETE' && row.attempts === 5
)
const aggregate = {
  experiment: '0007A',
  generatedAt: new Date().toISOString(),
  status: complete ? 'COMPLETE' : 'INCOMPLETE',
  summary
}
await fs.mkdir(directory, { recursive: true })
await fs.writeFile(
  path.join(directory, '0007A-latest.json'),
  `${JSON.stringify(aggregate, null, 2)}\n`
)
const markdown = [
  '# Experimento 0007A - Matriz de compatibilidade fisica',
  '',
  `Status: ${aggregate.status}`,
  '',
  '| Condicao | Tentativas | Dig resolveu | Bloco mudou | Inventario + | Skill OK | Grounded | Dig p95 | Skill p95 |',
  '|---|---:|---:|---:|---:|---:|---:|---:|---:|',
  ...summary.map((row) =>
    `| ${row.condition} | ${row.attempts} | ${row.digResolved} | ` +
    `${row.blockChanged} | ${row.inventoryIncreased} | ${row.skillSucceeded} | ` +
    `${row.grounded} | ${row.digP95Ms ?? '-'} ms | ` +
    `${row.skillP95Ms ?? '-'} ms |`
  )
]
await fs.writeFile(
  path.join(directory, '0007A-latest.md'),
  `${markdown.join('\n')}\n`
)
console.log(markdown.join('\n'))
