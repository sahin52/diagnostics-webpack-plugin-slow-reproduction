// usage: node bench.js
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const RUNS = 3;

// Scale knob: raise this until the legacy build takes a few minutes, like the real one.
const SHARED = 50;         // src/shared/components/*  (tsx + scss each)

const write = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
fs.rmSync('src', { recursive: true, force: true });

write('src/global.d.ts', `declare module '*.scss';\n`);
write('src/shared/styles/_vars.scss', `$primary: #336699;\n$gap: 8px;\n@mixin card { padding: $gap; border: 1px solid $primary; }\n`);

const imports = [];
const components = [];
for (let i = 0; i < SHARED; i++) {
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
console.log(`Generated ${SHARED} shared components in src/`);

const OUT_DIR = 'bench-results';
fs.mkdirSync(OUT_DIR, { recursive: true });
const VARIANTS = ['diagnostics-threadsnotset', 'legacy'];
const webpack = require.resolve('webpack-cli/bin/cli.js');
const times = Object.fromEntries(VARIANTS.map(v => [v, []]));

for (let run = 1; run <= RUNS; run++) {
  for (const variant of VARIANTS) {
    fs.rmSync('node_modules/.cache', { recursive: true, force: true }); // every run is a cold run
    const args = [webpack, '--env', `variant=${variant}`];
    const start = performance.now();
    const result = spawnSync(process.execPath, args, { encoding: 'utf8' });
    const seconds = (performance.now() - start) / 1000;
    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
    const memory = output.match(/Memory usage: (.*)/)?.[1] ?? 'no memory line';
    const errors = (output.match(/ERROR/g) ?? []).length;

    times[variant].push(seconds);
    console.log(`run ${run}/${RUNS}  ${variant.padEnd(26)} ${seconds.toFixed(2)}s  exit ${result.status}  errors ${errors}  ${memory}`);
    fs.writeFileSync(path.join(OUT_DIR, `${new Date().toISOString().replace(/[:.]/g, '-')}-${variant}-run${run}.log`), output);
  }
}

console.log(`\nAverage of ${RUNS} runs:`);
for (const v of VARIANTS) {
  const avg = times[v].reduce((a, b) => a + b, 0) / times[v].length;
  console.log(`${v.padEnd(26)} ${avg.toFixed(2)}s (${Math.min(...times[v]).toFixed(2)}-${Math.max(...times[v]).toFixed(2)})`);
}