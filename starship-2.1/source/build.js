const fs = require('fs');
const src = f => fs.readFileSync(__dirname + '/src/' + f, 'utf8');
const js = ['mask.js', 'sim.js', 'tex.js', 'gfx.js', 'ui.js'].map(src).join('\n');
fs.mkdirSync(__dirname + '/dist', { recursive: true });
fs.writeFileSync(__dirname + '/dist/index.html', src('index.tpl.html').replace('/*__SCRIPTS__*/', () => js).replace('/*__LOCALE__*/', () => src('locale.js')));
console.log('built', (fs.statSync(__dirname + '/dist/index.html').size / 1024).toFixed(0), 'KB');
