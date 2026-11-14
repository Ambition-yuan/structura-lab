const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'dist');
if (path.dirname(out) !== root || path.basename(out) !== 'dist') throw new Error('Unsafe build output path');
function copy(from, to) {
  if (fs.statSync(from).isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    for (const name of fs.readdirSync(from)) copy(path.join(from, name), path.join(to, name));
  } else { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(from, to); }
}
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
copy(path.join(root, 'index.html'), path.join(out, 'index.html'));
copy(path.join(root, 'src'), path.join(out, 'src'));
for (const file of ['build/three.module.js', 'build/three.core.js', 'examples/jsm/controls/OrbitControls.js', 'examples/jsm/environments/RoomEnvironment.js', 'examples/jsm/geometries/RoundedBoxGeometry.js', 'examples/jsm/loaders/GLTFLoader.js', 'examples/jsm/utils/BufferGeometryUtils.js', 'LICENSE']) {
  copy(path.join(root, 'node_modules/three', file), path.join(out, 'vendor/three', file));
}
console.log('Built static site: ' + out);
