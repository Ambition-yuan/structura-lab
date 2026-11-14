import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { products } from './products/registry.js';

const $ = (id) => document.getElementById(id);
const viewport = $('viewport');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let renderer;
function fail(message) {
  $('loading').hidden = true;
  $('fallback').hidden = false;
  $('fallback').textContent = message;
  document.querySelectorAll('#viewport button, #explode-range').forEach(b => b.disabled = true);
}

try {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch {
  fail('无法启动 3D 视图。请使用支持 WebGL 2 的浏览器，并开启浏览器硬件加速后刷新。');
}

if (renderer) init();

function init() {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.className = 'three-canvas';
  renderer.domElement.setAttribute('tabindex', '0');
  viewport.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 200);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.enablePan = false;
  controls.minDistance = 6;
  controls.maxDistance = 65;
  controls.autoRotateSpeed = 0.7;
  controls.maxPolarAngle = Math.PI * 0.93;
  controls.minPolarAngle = Math.PI * 0.07;
  controls.target.set(0, 0, 0);
  camera.position.set(11, 7.5, 16);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04);
  scene.environment = environment.texture;
  room.dispose(); pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xd9e7ef, 0x373b32, 1.2));
  const key = new THREE.DirectionalLight(0xffffff, 2.7);
  key.position.set(-5, 9, 9); scene.add(key);
  const edge = new THREE.DirectionalLight(0xd7ecc5, 2.5);
  edge.position.set(7, 4, -6); scene.add(edge);
  const fill = new THREE.DirectionalLight(0xa9c4ee, 1.0);
  fill.position.set(-8, -2, -3); scene.add(fill);

  const grid = new THREE.GridHelper(44, 44, 0x747e75, 0x535d55);
  grid.position.y = -4.8;
  grid.material.transparent = true; grid.material.opacity = 0.10;
  scene.add(grid);

  let product, productId, productInfo, parts = [], selected = null, progress = 0, desiredProgress = 0;
  let labelsVisible = false, viewTween = null, fitting = false, fittingDirection = null, lastTime = performance.now();
  let pointerStart = null, userDragging = false;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const temp = new THREE.Vector3();
  const labels = new Map();
  const listButtons = new Map();
  const guideMaterial = new THREE.LineDashedMaterial({ color: 0xd0f66b, transparent: true, opacity: 0.22, dashSize: 0.12, gapSize: 0.12 });
  const guides = new THREE.Group(); scene.add(guides);

  function loadProduct(id) {
    const nextProduct = products[id].create();
    if (product) { scene.remove(product.group); product.dispose?.(); }
    for (const line of guides.children) line.geometry.dispose();
    guides.clear();
    productId = id; productInfo = products[id]; product = nextProduct; parts = product.parts;
    progress = desiredProgress = 0; selected = null;
    labelsVisible = false; viewTween = null; fitting = false; fittingDirection = null;
    pointerStart = null; userDragging = false;
    controls.autoRotate = false;
    // Flush any damping left by a gesture on the previous product before reframing.
    controls.enableDamping = false; controls.update(); controls.enableDamping = true;
    controls.target.set(0, 0, 0); camera.position.fromArray(productInfo.view);
    scene.add(product.group);
    updateProductContent();
    $('parts-list').replaceChildren(); $('labels-layer').replaceChildren();
    listButtons.clear(); labels.clear();
    const originalMaterials = new Set();
    const highlightMaterials = new Map();
    for (const [index, part] of parts.entries()) {
      part.group.position.copy(part.assembled);
      part.group.traverse(mesh => {
        if (!mesh.isMesh) return;
        mesh.userData.partId = part.id;
        // Isolate highlights even when the model shares materials across parts.
        const clone = material => {
          originalMaterials.add(material);
          // Share a highlight material within one part, never between parts.
          if (!highlightMaterials.has(material)) highlightMaterials.set(material, new Map());
          const byPart = highlightMaterials.get(material);
          if (byPart.has(part.id)) return byPart.get(part.id);
          const m = material.clone();
          m.userData.originalEmissive = m.emissive?.clone();
          m.userData.originalIntensity = m.emissiveIntensity;
          byPart.set(part.id, m);
          return m;
        };
        mesh.material = Array.isArray(mesh.material) ? mesh.material.map(clone) : clone(mesh.material);
      });
      const button = document.createElement('button');
      button.className = 'part-item'; button.dataset.part = part.id;
      button.setAttribute('aria-pressed', 'false');
      button.innerHTML = `<span class="part-number">${String(index + 1).padStart(2, '0')}</span><span class="part-name">${part.name}</span><span class="part-mark">${part.kind === 'schematic' ? '示意' : '↗'}</span>`;
      button.addEventListener('click', () => selectPart(part.id, true));
      $('parts-list').append(button); listButtons.set(part.id, button);
      const label = document.createElement('button');
      label.className = 'model-label'; label.textContent = `${String(index + 1).padStart(2, '0')} ${part.name}`;
      label.hidden = true;
      label.addEventListener('click', () => selectPart(part.id, false));
      $('labels-layer').append(label); labels.set(part.id, label);
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([part.assembled, part.exploded]), guideMaterial);
      line.computeLineDistances(); guides.add(line);
    }
    originalMaterials.forEach(material => material.dispose());
    $('labels-btn').setAttribute('aria-pressed', 'false');
    $('auto-rotate-btn').setAttribute('aria-pressed', 'false');
    updateViewButtons(null); setExplosion(0); fitting = false; fittingDirection = null;
    selectPart(null); fitView(false);
  }

  function updateProductContent() {
    const info = productInfo;
    $('product-select').value = productId;
    const accent = document.createElement('span'); accent.textContent = info.title[1];
    $('product-title').replaceChildren(document.createTextNode(info.title[0]), accent);
    $('product-category').textContent = info.category;
    $('product-brand').textContent = info.brand;
    $('product-edition').textContent = info.edition;
    $('product-model-label').textContent = info.modelLabel;
    const subtitle = document.createElement('span'); subtitle.textContent = info.subtitle[1];
    $('product-subtitle').replaceChildren(document.createTextNode(info.subtitle[0]), subtitle);
    $('stage-study').textContent = `${info.edition.slice(1)} — STRUCTURE STUDY`;
    $('stage-wordmark').textContent = info.wordmark;
    $('parts-count').textContent = String(parts.length);
    $('guide-count').textContent = `${parts.length} PARTS · 1 PERSPECTIVE`;
    for (const [view, label] of [['front', info.frontLabel], ['rear', info.rearLabel]]) {
      $(`${view}-view-btn`).textContent = label;
      $(`${view}-view-btn`).title = `查看${label}`;
    }
    viewport.setAttribute('aria-label', `${info.name} 交互式三维模型，拖动旋转，滚轮缩放`);
    renderer.domElement.setAttribute('aria-label', `${info.name} 可交互三维模型；部件也可通过列表选择`);
    document.title = `${info.name} — STRUCTURA 解构实验室`;
    document.querySelector('meta[name="description"]').content = `在三维空间中探索 ${info.name}。旋转、展开与观察 ${parts.length} 组部件，内部结构为程序化示意。`;
    $('model-notes').textContent = info.modelNotes;
    $('schematic-notes').textContent = info.schematicNotes;
    $('sources-links').replaceChildren(...info.sources.map(source => {
      const link = document.createElement('a');
      link.href = source.url; link.target = '_blank'; link.rel = 'noreferrer';
      link.textContent = source.label;
      return link;
    }));
    $('source-footnote').textContent = `非 ${info.brand === 'DJI' ? 'DJI' : '小米汽车'} 官方展示。产品名称与商标归其各自所有者。`;
  }

  function selectPart(id, reveal = false) {
    selected = id;
    for (const part of parts) {
      const active = part.id === id;
      listButtons.get(part.id).setAttribute('aria-pressed', String(active));
      labels.get(part.id).classList.toggle('selected', active);
      part.group.traverse(mesh => {
        if (!mesh.isMesh) return;
        for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          if (!m.emissive) continue;
          m.emissive.copy(active ? new THREE.Color(0xaac94e) : m.userData.originalEmissive);
          m.emissiveIntensity = active ? 0.28 : m.userData.originalIntensity;
        }
      });
    }
    const part = parts.find(p => p.id === id);
    $('detail-index').textContent = part ? `COMPONENT ${String(parts.indexOf(part) + 1).padStart(2, '0')}` : 'PRODUCT OVERVIEW';
    $('detail-title').textContent = part?.name || productInfo.overview.title;
    $('detail-en').textContent = part?.enName || productInfo.overview.enName;
    $('detail-kind').textContent = part ? (part.kind === 'schematic' ? '内部结构 · 示意' : '外观参考 · 简化建模') : `探索 ${parts.length} 组产品部件`;
    $('detail-description').textContent = part?.description || productInfo.overview.description;
    const specs = part?.specs || productInfo.overview.specs;
    $('detail-specs').replaceChildren(...specs.map(([key, value]) => {
      const row = document.createElement('div'); row.className = 'spec-row';
      const dt = document.createElement('dt'); dt.textContent = key;
      const dd = document.createElement('dd'); dd.textContent = value;
      row.append(dt, dd); return row;
    }));
    if (part && reveal && progress < 0.8) setExplosion(1);
    if (part) $('view-status').textContent = `已选择 · ${part.name}`;
    else $('view-status').textContent = progress > 0.01 ? '拆解视图 · 内部结构为示意' : '组装视图';
  }

  function setExplosion(value, direction = null) {
    desiredProgress = THREE.MathUtils.clamp(value, 0, 1);
    fitting = true;
    fittingDirection = direction || camera.position.clone().sub(controls.target).normalize();
    $('explode-range').value = String(Math.round(value * 100));
    $('explode-value').textContent = `${Math.round(value * 100)}%`;
    $('explode-btn').setAttribute('aria-pressed', String(value > 0.5));
    const label = $('explode-btn').querySelector('span');
    if (label) label.textContent = value > 0.5 ? '复原结构' : '展开结构';
    else $('explode-btn').textContent = value > 0.5 ? '复原结构' : '展开结构';
    $('view-status').textContent = value === 0 ? '组装视图' : value === 1 ? '拆解视图 · 内部结构为示意' : '结构展开中 · 示意';
  }

  function getFit(viewDirection = null) {
    product.group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(product.group);
    const center = box.getCenter(new THREE.Vector3());
    const direction = (viewDirection || camera.position.clone().sub(controls.target)).clone().normalize();
    const right = new THREE.Vector3().crossVectors(camera.up, direction).normalize();
    const up = new THREE.Vector3().crossVectors(direction, right).normalize();
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const tanH = tanV * camera.aspect;
    let distance = 0;
    for (const part of parts) {
      const partBox = new THREE.Box3().setFromObject(part.group);
    for (const x of [partBox.min.x, partBox.max.x]) for (const y of [partBox.min.y, partBox.max.y]) for (const z of [partBox.min.z, partBox.max.z]) {
      const v = new THREE.Vector3(x, y, z).sub(center);
      distance = Math.max(distance, Math.abs(v.dot(right)) / tanH + v.dot(direction), Math.abs(v.dot(up)) / tanV + v.dot(direction));
    }
    }
    return { center, position: center.clone().addScaledVector(direction, distance * (productInfo.fitPadding || 1.16)) };
  }

  function fitView(animate = true, direction = null) {
    const fit = getFit(direction);
    if (animate && !reducedMotion) viewTween = fit;
    else { controls.target.copy(fit.center); camera.position.copy(fit.position); controls.update(); }
  }

  function resize() {
    const width = viewport.clientWidth, height = viewport.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height);
    camera.aspect = width / height; camera.updateProjectionMatrix();
    if (product) fitView(false);
  }
  new ResizeObserver(resize).observe(viewport);
  $('product-select').replaceChildren(...Object.entries(products).map(([id, info]) => {
    const option = document.createElement('option'); option.value = id; option.textContent = info.name; return option;
  }));
  loadProduct('action-4'); resize();
  $('loading').hidden = true;

  $('explode-btn').addEventListener('click', () => setExplosion(desiredProgress > 0.5 ? 0 : 1));
  $('explode-range').addEventListener('input', event => setExplosion(Number(event.target.value) / 100));
  $('reset-btn').addEventListener('click', reset);
  $('fit-btn').addEventListener('click', () => fitView());
  $('front-view-btn').addEventListener('click', () => { fitView(true, new THREE.Vector3(0, 0.5, 20)); updateViewButtons('front'); });
  $('rear-view-btn').addEventListener('click', () => { fitView(true, new THREE.Vector3(0, 0.5, -20)); updateViewButtons('rear'); });
  function updateViewButtons(view) {
    $('front-view-btn').setAttribute('aria-pressed', String(view === 'front'));
    $('rear-view-btn').setAttribute('aria-pressed', String(view === 'rear'));
  }
  $('auto-rotate-btn').addEventListener('click', () => {
    controls.autoRotate = !controls.autoRotate;
    $('auto-rotate-btn').setAttribute('aria-pressed', String(controls.autoRotate));
  });
  $('labels-btn').addEventListener('click', () => {
    labelsVisible = !labelsVisible; $('labels-btn').setAttribute('aria-pressed', String(labelsVisible));
  });
  $('product-select').addEventListener('change', event => {
    if (products[event.target.value]) loadProduct(event.target.value);
  });
  function reset() {
    selectPart(null); controls.autoRotate = false;
    labelsVisible = false;
    $('labels-btn').setAttribute('aria-pressed', 'false');
    $('auto-rotate-btn').setAttribute('aria-pressed', 'false');
    const direction = new THREE.Vector3(...productInfo.view);
    updateViewButtons(null); setExplosion(0, direction);
    fitView(true, direction);
  }

  renderer.domElement.addEventListener('pointerdown', event => { pointerStart = { x: event.clientX, y: event.clientY }; });
  renderer.domElement.addEventListener('pointerup', event => {
    if (!pointerStart || Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 5) { pointerStart = null; return; }
    pointerStart = null;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObject(product.group, true);
    selectPart(hits.find(hit => hit.object.userData.partId)?.object.userData.partId || null);
  });
  renderer.domElement.addEventListener('pointercancel', () => { pointerStart = null; });
  controls.addEventListener('start', () => { userDragging = true; viewTween = null; fittingDirection = null; updateViewButtons(null); });
  controls.addEventListener('end', () => { userDragging = false; });
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault(); fail('3D 图形连接已中断。请刷新页面重新加载模型。');
  });

  for (const [openIds, dialogId, closeId] of [
    [['sources-btn', 'info-btn'], 'sources-dialog', 'close-sources-btn'],
    [['help-btn'], 'help-dialog', 'close-help-btn'],
  ]) {
    const dialog = $(dialogId);
    for (const id of openIds) $(id)?.addEventListener('click', () => dialog.showModal());
    $(closeId)?.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  }
  $('nav-explore')?.addEventListener('click', () => renderer.domElement.focus());
  document.addEventListener('keydown', event => {
    if (document.querySelector('dialog[open]') || /INPUT|SELECT|TEXTAREA|BUTTON/.test(event.target.tagName)) return;
    if (event.code === 'Space') { event.preventDefault(); setExplosion(desiredProgress > 0.5 ? 0 : 1); }
    if (event.key.toLowerCase() === 'r') reset();
    if (event.key === 'Escape') selectPart(null);
  });

  function updateLabels() {
    const occupied = [];
    for (const part of [...parts].sort((a, b) => Number(b.id === selected) - Number(a.id === selected))) {
      const label = labels.get(part.id);
      const visible = labelsVisible || selected === part.id;
      if (!visible) { label.hidden = true; continue; }
      new THREE.Box3().setFromObject(part.group).getCenter(temp);
      temp.project(camera);
      const x = (temp.x * 0.5 + 0.5) * viewport.clientWidth;
      const y = (-temp.y * 0.5 + 0.5) * viewport.clientHeight;
      const isInside = temp.z < 1 && temp.z > -1 && x > 65 && x < viewport.clientWidth - 65 && y > 115 && y < viewport.clientHeight - 145;
      const overlap = occupied.some(p => Math.abs(p.x - x) < 130 && Math.abs(p.y - y) < 32);
      label.hidden = !isInside || overlap;
      if (!label.hidden) { label.style.transform = `translate(${x}px,${y}px) translate(-50%, -50%)`; occupied.push({ x, y }); }
    }
  }

  let frameCount = 0;
  function positionPart(part) {
    if (!part.extract) { part.group.position.lerpVectors(part.assembled, part.exploded, progress); return; }
    const phase = 0.45;
    if (progress < phase) part.group.position.lerpVectors(part.assembled, part.extract, progress / phase);
    else part.group.position.lerpVectors(part.extract, part.exploded, (progress - phase) / (1 - phase));
  }
  function animate(time) {
    requestAnimationFrame(animate);
    if (document.hidden) { lastTime = time; return; }
    const dt = Math.min((time - lastTime) / 1000, 0.05); lastTime = time;
    const delta = desiredProgress - progress;
    if (Math.abs(delta) > 0.0005) {
      progress = reducedMotion ? desiredProgress : progress + delta * (1 - Math.exp(-dt * 5));
      for (const part of parts) positionPart(part);
    } else if (fitting) {
      progress = desiredProgress;
      for (const part of parts) positionPart(part);
      fitting = false; if (!userDragging) fitView(true, fittingDirection);
    }
    if (fitting && !userDragging) viewTween = getFit(fittingDirection);
    if (viewTween && !userDragging) {
      const alpha = 1 - Math.exp(-dt * 8);
      camera.position.lerp(viewTween.position, alpha);
      controls.target.lerp(viewTween.center, alpha);
      if (camera.position.distanceTo(viewTween.position) < 0.005 && controls.target.distanceTo(viewTween.center) < 0.005) viewTween = null;
    }
    guides.visible = labelsVisible && progress > 0.15;
    controls.update(dt);
    if (frameCount++ % 3 === 0) updateLabels();
    renderer.render(scene, camera);
  }
  requestAnimationFrame(animate);
  // Read-only diagnostics for acceptance checks; no network or user information.
  window.__structura = {
    state: () => ({ productId, progress, desiredProgress, selected, labels: labels.size, labelsVisible, guides: guides.children.length, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, camera: camera.position.toArray(), target: controls.target.toArray(), autoRotate: controls.autoRotate, parts: parts.length, drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles }),
    bounds: () => parts.map(part => {
      const box = new THREE.Box3().setFromObject(part.group);
      const corners = [];
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) corners.push(new THREE.Vector3(x,y,z).project(camera).toArray());
      return { id: part.id, position: part.group.position.toArray(), assembled: part.assembled.toArray(), exploded: part.exploded.toArray(), corners };
    }),
  };
}
