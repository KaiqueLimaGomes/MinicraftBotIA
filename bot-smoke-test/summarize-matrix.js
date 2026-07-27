import fs from 'node:fs/promises'
import path from 'node:path'
import { summarizeMatrix } from './matrix-analysis.js'

const inputDir = path.resolve(process.env.MATRIX_LOG_DIR ?? 'shadow-results')
const outputDir = path.resolve(process.env.MATRIX_RESULT_DIR ?? 'matrix-results')
const files = (await fs.readdir(inputDir))
  .filter(file => file.endsWith('.jsonl'))
  .sort()
const records = []

for (const file of files) {
  const lines = (await fs.readFile(path.join(inputDir, file), 'utf8'))
    .split(/\r?\n/)
    .filter(Boolean)
  for (const line of lines) {
    const record = JSON.parse(line)
    if (record.matrix?.phase) records.push({ ...record, sourceFile: file })
  }
}

const summary = summarizeMatrix(records)
const result = {
  generatedAt: new Date().toISOString(),
  summary,
  phaseCounts: Object.fromEntries(
    [...Array(12)].map((_, index) => {
      const phase = index + 1
      return [phase, records.filter(record => record.matrix.phase === phase).length]
    })
  ),
  records
}

await fs.mkdir(outputDir, { recursive: true })
await fs.writeFile(path.join(outputDir, '0006D-latest.json'), JSON.stringify(result, null, 2))
await fs.writeFile(path.join(outputDir, '0006D-latest.md'), markdown(result))
console.log(markdown(result))

function markdown({ generatedAt, summary, phaseCounts }) {
  const complete = summary.phasesCompleted === 12 &&
    Object.values(phaseCounts).every(count => count >= 3)
  return `# Experimento 0006D - Resultado agregado

Data: ${generatedAt}

Status: ${complete ? 'COMPLETO' : 'INCOMPLETO'}

| Metrica | Resultado | Meta |
|---|---:|---:|
| Fases concluidas | ${summary.phasesCompleted}/12 | 12/12 |
| Decisoes | ${summary.decisions}/36 | >=36 |
| Snapshot correspondente | ${pct(summary.snapshotMatchRate)} | 100% |
| Catalog executable | ${pct(summary.catalogExecutableRate)} | 100% |
| Valida apos inferencia | ${pct(summary.stillExecutableRate)} | 100% |
| Acao esperada | ${pct(summary.expectedActionRate)} | observacao |
| Casos criticos corretos | ${pct(summary.criticalCorrectRate)} | 100% |
| Mesma entrada, mesma decisao | ${pct(summary.sameStateSameDecisionRate)} | >=90% |
| Exploracao prematura | ${summary.prematureExploreCount} | 0 |
| Abrigo antecipado | ${summary.prematureShelterCount} | 0 |
| Erros nao tratados | ${summary.unhandledErrors} | 0 |
| Latencia p95 | ${summary.p95LatencyMs} ms | <=2000 ms |

## Amostras por fase

${Object.entries(phaseCounts).map(([phase, count]) => `- Fase ${phase}: ${count}/3`).join('\n')}
`
}

function pct(value) {
  if (value === null || value === undefined) return 'N/A'
  return `${Math.round(value * 100)}%`
}
