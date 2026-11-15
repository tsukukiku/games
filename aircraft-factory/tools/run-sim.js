// ブラウザなしでゲームのロジックを動かし、自動プレイ(simulateRun)の結果を出す。
//   node tools/run-sim.js          … seed 12345 で1周
//   node tools/run-sim.js 777      … seed を指定
//   node tools/run-sim.js multi    … seed を変えて10周し、要約だけ出す
// index.html の <script> 一覧を読み、js/ui/ と js/main.js 以外を順に実行する(追加の依存なし)。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sources = [...html.matchAll(/<script src="([^"]+)"/g)]
  .map(m => m[1])
  .filter(src => !src.startsWith('js/ui/') && src !== 'js/main.js');

const sandbox = { console };
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const src of sources) {
  vm.runInContext(fs.readFileSync(path.join(root, src), 'utf8'), sandbox, { filename: src });
}

const arg = process.argv[2];
if (arg === 'multi') {
  const out = [];
  for (let seed = 1; seed <= 10; seed++) {
    const s = sandbox.AF.dev.simulateRun({ seed: seed * 1009, silent: true }).summary;
    out.push({ seed: seed * 1009, 倒産: s.bankrupt, 組立解放: s.phase2Month, 初納入: s.firstAircraftMonth,
               機体納入: s.aircraftDelivered, 最終資金: s.finalFunds, 納期内: s.contractStats.onTime,
               遅延: s.contractStats.late, 打切: s.contractStats.failed });
  }
  console.table(out);
} else {
  sandbox.AF.dev.simulateRun({ seed: arg ? Number(arg) : 12345 });
}
