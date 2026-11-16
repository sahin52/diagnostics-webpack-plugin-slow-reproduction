// usage: node bench.js
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const RUNS = 3;

// Scale knob: raise this until the legacy build takes a few minutes, like the real one.
const NUMBER_OF_COMPONENTS = 50;         // src/shared/components/*  (tsx + scss each)

const write = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
fs.rmSync('src', { recursive: true, force: true });

write('src/global.d.ts', `declare module '*.scss';\n`);
write('src/shared/styles/_vars.scss', `$primary: #336699;\n$gap: 8px;\n@mixin card { padding: $gap; border: 1px solid $primary; }\n`);

const imports = [];
const components = [];
for (let i = 0; i < NUMBER_OF_COMPONENTS; i++) {
  write(`src/shared/components/comp-${i}/comp-${i}.scss`, `@use '../../styles/vars' as *;\n.comp-${i} { @include card; color: $primary; &__title { margin: $gap * 2; } }\n`);
  write(`src/shared/components/comp-${i}/comp-${i}.tsx`, `
import { useEffect, useState, type ReactNode } from 'react';
import './comp-${i}.scss';

export interface Comp${i}Props { title: string; url: string; children?: ReactNode; onLoaded?: (items: { id: number }[]) => void }

export function Comp${i}({ title, url, children, onLoaded }: Comp${i}Props) {
  const [items, setItems] = useState<{ id: number }[]>([]);
  useEffect(() => {
    void fetch(url).then(r => r.json()).then((data: unknown[]) => {
      const loaded = data.map((x, index) => ({ id: index, ...(x as object) }));
      setItems(loaded);
      onLoaded?.(loaded);
    });
  }, [url, onLoaded]);
  return <div className="comp-${i}"><h2 className="comp-${i}__title">{title}</h2>{items.map(x => <span key={x.id}>{x.id}</span>)}{children}</div>;
}
`);
  imports.push(`import { Comp${i} } from './shared/components/comp-${i}/comp-${i}';`);
  components.push(`Comp${i}`);
}

// One entry that pulls in every shared component, picked up by the webpack.part.config.js glob.
write('src/index.tsx', `${imports.join('\n')}\nexport const components = [${components.join(', ')}];\n`);
write('src/webpack.part.config.js', `module.exports = { entry: { main: './src/index.tsx' } };\n`);
console.log(`Generated ${NUMBER_OF_COMPONENTS} shared components in src/`);

const OUT_DIR = 'bench-results';
fs.mkdirSync(OUT_DIR, { recursive: true });
const VARIANTS = ['diagnostics-threadsnotset', 'legacy'];
const webpack = require.resolve('webpack-cli/bin/cli.js');
const results = Object.fromEntries(VARIANTS.map(v => [v, []]));

// Reads the BUILD_METRICS JSON line that memory-usage-webpack-plugin prints.
const parseMetrics = output => {
  const line = output.match(/BUILD_METRICS (.*)/)?.[1];
  try { return line ? JSON.parse(line) : null; } catch { return null; }
};

// Fixed-width columns so every row lines up with its header.
const VARIANT_WIDTH = Math.max('variant'.length, ...VARIANTS.map(v => v.length));
const row = (cells, widths) => cells.map((cell, i) => i < 2 ? String(cell).padEnd(widths[i]) : String(cell).padStart(widths[i])).join('  ');
const RUN_WIDTHS = [5, VARIANT_WIDTH, 8, 4, 6, 9, 9, 8, 8, 8];
const mib = value => `${Math.round(value)} MiB`;
const percent = value => `${Math.round(value)}%`;
const cpuTime = m => m.cpuUserSec + m.cpuSystemSec;

console.log(row(['run', 'variant', 'time', 'exit', 'errors', 'heap', 'rss', 'cpu avg', 'cpu peak', 'cpu time'], RUN_WIDTHS));
for (let run = 1; run <= RUNS; run++) {
  for (const variant of VARIANTS) {
    fs.rmSync('node_modules/.cache', { recursive: true, force: true }); // every run is a cold run
    const args = [webpack, '--env', `variant=${variant}`];
    const start = performance.now();
    const result = spawnSync(process.execPath, args, { encoding: 'utf8' });
    const seconds = (performance.now() - start) / 1000;
    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
    const metrics = parseMetrics(output);
    const errors = (output.match(/ERROR/g) ?? []).length;

    results[variant].push({ seconds, metrics });
    const detail = metrics
      ? [mib(metrics.peakHeapMiB), mib(metrics.peakRssMiB), percent(metrics.cpuAvgPercent), percent(metrics.cpuPeakPercent), `${cpuTime(metrics).toFixed(1)}s`]
      : ['-', '-', '-', '-', '-'];
    console.log(row([`${run}/${RUNS}`, variant, `${seconds.toFixed(2)}s`, result.status, errors, ...detail], RUN_WIDTHS));
    fs.writeFileSync(path.join(OUT_DIR, `${new Date().toISOString().replace(/[:.]/g, '-')}-${variant}-run${run}.log`), output);
  }
}

const average = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : NaN;
const cores = Object.values(results).flat().find(r => r.metrics)?.metrics.logicalCores;

console.log(`\nAverage of ${RUNS} runs${cores ? ` (${cores} logical cores)` : ''}:`);
const SUMMARY_WIDTHS = [VARIANT_WIDTH, 13, 8, 9, 9, 8, 8, 8];
const summaryRow = cells => cells.map((cell, i) => i === 0 ? String(cell).padEnd(SUMMARY_WIDTHS[i]) : String(cell).padStart(SUMMARY_WIDTHS[i])).join('  ');
console.log(summaryRow(['variant', 'time range', 'time', 'heap', 'rss', 'cpu avg', 'cpu peak', 'cpu time']));
for (const v of VARIANTS) {
  const times = results[v].map(r => r.seconds);
  const m = results[v].map(r => r.metrics).filter(Boolean);
  const avg = key => average(m.map(x => x[key]));
  console.log(summaryRow([
    v,
    `${Math.min(...times).toFixed(1)}-${Math.max(...times).toFixed(1)}s`,
    `${average(times).toFixed(2)}s`,
    mib(avg('peakHeapMiB')),
    mib(avg('peakRssMiB')),
    percent(avg('cpuAvgPercent')),
    percent(avg('cpuPeakPercent')),
    `${average(m.map(cpuTime)).toFixed(1)}s`,
  ]));
}