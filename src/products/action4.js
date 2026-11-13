import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Exterior proportions follow DJI's published dimensions. All internal geometry,
// fasteners, printed circuits and separation paths are illustrative, not a repair guide.
export function createAction4() {
  const group = new THREE.Group();
  group.name = 'DJI Osmo Action 4';
  const parts = [];
  const textures = [];
  const makeTexture = (width, height, draw) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    draw(canvas.getContext('2d'), width, height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    textures.push(texture);
    return texture;
  };

  const grain = makeTexture(128, 128, (ctx, w, h) => {
    const data = ctx.createImageData(w, h);
    let seed = 49;
    for (let i = 0; i < data.data.length; i += 4) {
      seed = (seed * 16807) % 2147483647;
      const value = 115 + (seed % 33);
      data.data.set([value, value, value, 255], i);
    }
    ctx.putImageData(data, 0, 0);
  });
  grain.colorSpace = THREE.NoColorSpace;
  grain.wrapS = grain.wrapT = THREE.RepeatWrapping;
  grain.repeat.set(7, 7);
  const mat = {
    body: new THREE.MeshStandardMaterial({ color: 0x1d2022, roughness: 0.62, metalness: 0.16, envMapIntensity: 0.55, bumpMap: grain, bumpScale: 0.021 }),
    front: new THREE.MeshStandardMaterial({ color: 0x181b1d, roughness: 0.57, metalness: 0.12, envMapIntensity: 0.45, bumpMap: grain, bumpScale: 0.012 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x171a1b, roughness: 0.88 }),
    black: new THREE.MeshStandardMaterial({ color: 0x0a0e10, roughness: 0.43, metalness: 0.1 }),
    ring: new THREE.MeshStandardMaterial({ color: 0x161b1e, roughness: 0.32, metalness: 0.55, envMapIntensity: 0.45 }),
    edge: new THREE.MeshStandardMaterial({ color: 0x697478, roughness: 0.3, metalness: 0.85 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xbda675, roughness: 0.32, metalness: 0.8 }),
    board: new THREE.MeshStandardMaterial({ color: 0x164f48, roughness: 0.5, metalness: 0.32 }),
    chip: new THREE.MeshStandardMaterial({ color: 0x24292b, roughness: 0.48, metalness: 0.3 }),
    silver: new THREE.MeshStandardMaterial({ color: 0xa4aaac, roughness: 0.31, metalness: 0.87 }),
    red: new THREE.MeshStandardMaterial({ color: 0xd4493d, roughness: 0.44, metalness: 0.15 }),
    optic: new THREE.MeshPhysicalMaterial({ color: 0x05121f, roughness: 0.095, metalness: 0.3, envMapIntensity: 0.24, clearcoat: 0.8, clearcoatRoughness: 0.07 }),
  };

  function mesh(parent, geometry, material, x = 0, y = 0, z = 0) {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  }
  function box(parent, w, h, d, radius, material, x = 0, y = 0, z = 0) {
    return mesh(parent, new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 2, h / 2, d / 2)), material, x, y, z);
  }
  function cylinder(parent, radius, depth, material, x = 0, y = 0, z = 0, segments = 64) {
    const result = mesh(parent, new THREE.CylinderGeometry(radius, radius, depth, segments), material, x, y, z);
    result.rotation.x = Math.PI / 2;
    return result;
  }
  function torus(parent, radius, tube, material, x = 0, y = 0, z = 0) {
    return mesh(parent, new THREE.TorusGeometry(radius, tube, 8, 64), material, x, y, z);
  }
  function roundedPath(path, x, y, w, h, r) {
    path.moveTo(x + r, y);
    path.lineTo(x + w - r, y);
    path.quadraticCurveTo(x + w, y, x + w, y + r);
    path.lineTo(x + w, y + h - r);
    path.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    path.lineTo(x + r, y + h);
    path.quadraticCurveTo(x, y + h, x, y + h - r);
    path.lineTo(x, y + r);
    path.quadraticCurveTo(x, y, x + r, y);
    return path;
  }
  function ring(parent, outer, inner, depth, material, z = 0) {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, outer, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, inner, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    return mesh(parent, new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 48 }), material, 0, 0, z - depth / 2);
  }
  function label(parent, text, w, h, x, y, z, color = '#c9cfd0', font = '600', size = 58) {
    // Match the canvas to the label's aspect ratio so narrow labels such as the
    // red "4" do not become a compressed sliver inside a wide transparent canvas.
    const texture = makeTexture(Math.max(64, Math.round(128 * w / h)), 128, (ctx, width) => {
      ctx.fillStyle = color;
      const fontSize = Math.min(112, size * 1.55);
      ctx.font = `${font} ${fontSize}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, width / 2, 67, width * 0.93);
    });
    return mesh(parent, new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }), x, y, z);
  }
  function part(id, name, enName, assembled, exploded, description, category, kind, specs = []) {
    const object = new THREE.Group();
    object.name = name;
    object.userData.partId = id;
    object.position.fromArray(assembled);
    group.add(object);
    const item = { id, name, enName, group: object, assembled: new THREE.Vector3(...assembled), exploded: new THREE.Vector3(...exploded), description, category, kind, specs };
    parts.push(item);
    return object;
  }

  // A real opening through the enclosure makes the exploded view readable.
  const frame = part('frame', '机身框架', 'Body frame', [0, 0, 0], [0, 0, 0],
    '紧凑的深灰色机身为屏幕、镜头与内部元件提供支撑。整体比例参考官方尺寸；框架壁厚、固定点与内部连接关系为示意。', '结构组件', 'exterior', [['整机尺寸', '70.5 × 44.2 × 32.8 mm'], ['整机重量', '145 g'], ['框架细节', '示意']]);
  // C-shaped section leaves the battery opening unobstructed. The side door is
  // attached to the battery presentation group below and travels with it.
  const shell = new THREE.Shape();
  shell.moveTo(-3.525, 1.83);
  shell.quadraticCurveTo(-3.525, 2.21, -3.095, 2.21);
  shell.lineTo(3.095, 2.21);
  shell.quadraticCurveTo(3.525, 2.21, 3.525, 1.78);
  shell.lineTo(3.525, -1.78);
  shell.quadraticCurveTo(3.525, -2.21, 3.095, -2.21);
  shell.lineTo(-3.095, -2.21);
  shell.quadraticCurveTo(-3.525, -2.21, -3.525, -1.83);
  shell.lineTo(-3.3, -1.83);
  shell.quadraticCurveTo(-3.3, -1.995, -3.03, -1.995);
  shell.lineTo(3.03, -1.995);
  shell.quadraticCurveTo(3.31, -1.995, 3.31, -1.715);
  shell.lineTo(3.31, 1.715);
  shell.quadraticCurveTo(3.31, 1.995, 3.03, 1.995);
  shell.lineTo(-3.03, 1.995);
  shell.quadraticCurveTo(-3.3, 1.995, -3.3, 1.83);
  shell.closePath();
  mesh(frame, new THREE.ExtrudeGeometry(shell, { depth: 2.52, bevelEnabled: true, bevelThickness: 0.045, bevelSize: 0.045, bevelSegments: 2, curveSegments: 10 }), mat.body, 0, 0, -1.26);
  // USB hatch opposite the battery opening.
  box(frame, 0.065, 2.53, 1.87, 0.025, mat.front, 3.56, -0.1, -0.14);
  box(frame, 0.085, 0.2, 0.55, 0.025, mat.rubber, 3.61, -0.37, -0.14);
  // Small microphone openings are a single instanced draw.
  const holes = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.032, 0.032, 0.018, 8), mat.black, 12);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 12; i++) {
    dummy.position.set(-0.54 + i * 0.095, 2.255, 0.1);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    holes.setMatrixAt(i, dummy.matrix);
  }
  frame.add(holes);
  // Inward support posts and visible fasteners are deliberately simplified.
  for (const [x, y] of [[-3.13, -1.98], [3.13, -1.98], [-3.13, 1.98], [3.13, 1.98]]) {
    cylinder(frame, 0.1, 2.45, mat.ring, x, y, 0, 12);
    cylinder(frame, 0.062, 0.04, mat.silver, x, y, 1.3, 12);
    box(frame, 0.072, 0.014, 0.012, 0.004, mat.black, x, y, 1.327);
  }

  const front = part('front-cover', '前面板', 'Front fascia', [0, 0, 1.31], [-1.15, -0.15, 3.65],
    '前面板围合前屏与镜头，保留 ACTION 4 标识和紧凑的横向布局。面板卡扣、密封结构及拆解方向为示意。', '外观组件', 'exterior', [['外观依据', 'DJI 官方产品图'], ['面板结构', '简化示意']]);
  const frontShape = roundedPath(new THREE.Shape(), -3.46, -2.15, 6.92, 4.3, 0.39);
  frontShape.holes.push(roundedPath(new THREE.Path(), -2.89, -0.9, 2.57, 2.59, 0.23));
  const lensHole = new THREE.Path();
  lensHole.absarc(1.7, 0.38, 1.34, 0, Math.PI * 2, true);
  frontShape.holes.push(lensHole);
  mesh(front, new THREE.ExtrudeGeometry(frontShape, { depth: 0.08, bevelEnabled: true, bevelSize: 0.025, bevelThickness: 0.025, bevelSegments: 2, curveSegments: 32 }), mat.front, 0, 0, -0.04);
  label(front, 'ACTION', 1.7, 0.45, -2.0, -1.5, 0.073, '#c9cdcd', '700', 60);
  label(front, '4', 0.47, 0.48, -0.94, -1.5, 0.074, '#eb5849', '700', 90);
  label(front, 'dji', 0.81, 0.46, 2.66, -1.49, 0.073, '#d7dada', 'italic 800', 88);
  cylinder(front, 0.062, 0.02, mat.black, -3.1, 1.54, 0.06, 16);
  cylinder(front, 0.029, 0.023, new THREE.MeshStandardMaterial({ color: 0x91a1a1, emissive: 0x687c70, emissiveIntensity: 0.3 }), -3.1, 1.54, 0.07, 12);

  const cover = part('lens-cover', '镜头保护盖', 'Lens protective cover', [1.7, 0.38, 1.72], [3.95, 0.65, 5.2],
    '圆形保护盖位于镜头最前端。外圈的细密纹理与玻璃反光用于还原视觉特征；螺纹、镀膜层和内部间距为示意。', '光学组件', 'exterior', [['结构', '圆形可拆卸保护盖'], ['内部细节', '示意']]);
  ring(cover, 1.42, 1.2, 0.36, mat.ring, 0);
  torus(cover, 1.385, 0.024, mat.edge, 0, 0, 0.155);
  ring(cover, 1.31, 1.18, 0.065, mat.black, 0.2);
  torus(cover, 1.2, 0.018, mat.edge, 0, 0, 0.228);
  const ridges = new THREE.InstancedMesh(new THREE.BoxGeometry(0.025, 0.085, 0.235), mat.front, 96);
  for (let i = 0; i < 96; i++) {
    const angle = i / 96 * Math.PI * 2;
    dummy.position.set(Math.cos(angle) * 1.423, Math.sin(angle) * 1.423, -0.018);
    dummy.rotation.set(0, 0, angle);
    dummy.updateMatrix();
    ridges.setMatrixAt(i, dummy.matrix);
  }
  cover.add(ridges);
  cylinder(cover, 1.18, 0.018, new THREE.MeshPhysicalMaterial({ color: 0x28475d, roughness: 0.06, metalness: 0.12, envMapIntensity: 0.35, transparent: true, opacity: 0.09, clearcoat: 0.75, depthWrite: false }), 0, 0, 0.214);

  const lens = part('lens-module', '镜头与传感器', 'Lens & image sensor', [1.7, 0.38, 0.53], [3.6, 0.3, 1.85],
    '镜头将光线汇聚至影像传感器。公开光学参数来自 DJI；镜片组、传感器封装、排线与支架均为示意，不代表实际拆机结构。', '光学组件', 'schematic', [['影像传感器', '1/1.3 英寸 CMOS'], ['视场角 / 光圈', '155° / f/2.8'], ['镜片及封装', '示意']]);
  box(lens, 2.22, 2.24, 0.16, 0.06, mat.board, 0, 0, -0.42);
  box(lens, 1.67, 1.7, 0.12, 0.05, mat.silver, 0, 0, -0.29);
  cylinder(lens, 0.91, 1.25, mat.black, 0, 0, 0.34);
  ring(lens, 1.11, 0.89, 0.17, mat.ring, 0.92);
  cylinder(lens, 0.885, 0.095, mat.optic, 0, 0, 1.055);
  torus(lens, 0.83, 0.02, new THREE.MeshStandardMaterial({ color: 0x1d3c49, metalness: 0.62, roughness: 0.16, envMapIntensity: 0.3 }), 0, 0, 1.111);
  cylinder(lens, 0.65, 0.015, new THREE.MeshPhysicalMaterial({ color: 0x030912, metalness: 0.28, roughness: 0.09, envMapIntensity: 0.2, clearcoat: 0.75 }), 0, 0, 1.118);
  cylinder(lens, 0.43, 0.018, new THREE.MeshPhysicalMaterial({ color: 0x02040a, metalness: 0.2, roughness: 0.05, envMapIntensity: 0.15, clearcoat: 0.7 }), 0, 0, 1.133);
  const reflection = mesh(lens, new THREE.RingGeometry(0.5, 0.58, 48, 1, 0.3, 1.9), new THREE.MeshBasicMaterial({ color: 0x819faa, transparent: true, opacity: 0.4, depthWrite: false }), 0, 0, 1.145);
  reflection.scale.y = 0.76;
  const glint = mesh(lens, new THREE.CircleGeometry(0.14, 24), new THREE.MeshBasicMaterial({ color: 0xc3d8e2, transparent: true, opacity: 0.45 }), -0.3, 0.35, 1.151);
  glint.scale.set(1, 0.3, 1);

  function screenTexture(w, h) {
    return makeTexture(w, h, (ctx, width, height) => {
      const sky = ctx.createLinearGradient(0, 0, 0, height);
      sky.addColorStop(0, '#b1bdba');
      sky.addColorStop(0.47, '#e2d4b5');
      sky.addColorStop(1, '#596b62');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, height);
      const mountains = [
        { color: '#89948d', y: 0.44, amp: 0.18, freq: 2.4, phase: 0.8 },
        { color: '#596a63', y: 0.62, amp: 0.2, freq: 2.7, phase: 2.1 },
        { color: '#344d45', y: 0.8, amp: 0.23, freq: 3, phase: 4.2 },
      ];
      for (const mountain of mountains) {
        ctx.beginPath();
        ctx.moveTo(0, height);
        for (let x = 0; x <= width; x += width / 70) {
          const y = height * (mountain.y + Math.sin(x / width * mountain.freq * Math.PI + mountain.phase) * mountain.amp + Math.sin(x / width * 18 + mountain.phase) * 0.024);
          ctx.lineTo(x, y);
        }
        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fillStyle = mountain.color;
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.font = `500 ${Math.round(height * 0.045)}px Arial`;
      ctx.fillText('4K  60', width * 0.07, height * 0.91);
      ctx.textAlign = 'right';
      ctx.fillText('01:28', width * 0.93, height * 0.12);
      ctx.fillStyle = '#f17056';
      ctx.beginPath();
      ctx.arc(width * 0.08, height * 0.1, height * 0.015, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.5)';
      ctx.lineWidth = 1.5;
      const cx = width / 2, cy = height / 2;
      ctx.strokeRect(cx - height * 0.055, cy - height * 0.055, height * 0.11, height * 0.11);
    });
  }
  function screen(parent, width, height, map, rear = false) {
    box(parent, width, height, 0.16, 0.075, mat.black);
    const display = mesh(parent, new THREE.PlaneGeometry(width - 0.18, height - 0.18), new THREE.MeshBasicMaterial({ map, color: 0xbfc7c5 }), 0, 0, rear ? -0.088 : 0.088);
    if (rear) display.rotation.y = Math.PI;
    const glass = box(parent, width + 0.03, height + 0.03, 0.032, 0.015, new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.055, metalness: 0.1, roughness: 0.16, clearcoat: 1, depthWrite: false }), 0, 0, rear ? -0.096 : 0.096);
    glass.castShadow = false;
  }
  const frontScreen = part('front-screen', '前置触摸屏', 'Front touchscreen', [-1.605, 0.395, 1.285], [-4.0, 1.0, 3.3],
    '前置全彩触摸屏便于自拍取景和查看拍摄状态。显示尺寸依据官方规格，屏幕画面为程序生成的山景示意。', '显示组件', 'exterior', [['屏幕尺寸', '1.4 英寸'], ['分辨率', '320 × 320'], ['屏幕画面', '程序化示意']]);
  screen(frontScreen, 2.48, 2.49, screenTexture(512, 512));
  box(frontScreen, 0.42, 0.7, 0.045, 0.018, mat.gold, 0.25, -1.44, -0.12);

  const rear = part('rear-screen', '后置触摸屏', 'Rear touchscreen', [0, 0, -1.315], [-1.2, 0.1, -4.7],
    '后置大屏用于取景、回放与参数操作。尺寸和分辨率为官方公开信息；显示总成的厚度、排线和拆分方式为示意。', '显示组件', 'exterior', [['屏幕尺寸', '2.25 英寸'], ['分辨率', '360 × 640'], ['显示总成', '简化示意']]);
  box(rear, 6.92, 4.27, 0.14, 0.065, mat.front);
  screen(rear, 6.27, 3.62, screenTexture(768, 432), true);
  box(rear, 0.49, 1.05, 0.045, 0.02, mat.gold, -1.35, -1.27, 0.1);

  const board = part('motherboard', '主板与处理单元', 'Mainboard assembly', [0.15, 0, -0.85], [0.9, 0, -2.45],
    '示意主板展示芯片、连接器与电路之间的空间关系。芯片型号、元件数量、走线、屏蔽罩及真实主板形状尚未核实。', '电子组件', 'schematic', [['功能', '影像处理与系统控制'], ['电路布局', '示意'], ['芯片型号', '未作规格声明']]);
  box(board, 6.12, 3.52, 0.1, 0.04, mat.board);
  box(board, 1.72, 1.5, 0.18, 0.04, mat.chip, 0.7, 0.21, 0.13);
  box(board, 1.56, 1.28, 0.06, 0.025, mat.silver, 0.7, 0.21, 0.25);
  box(board, 0.86, 0.7, 0.13, 0.03, mat.chip, -1.12, 0.65, 0.12);
  box(board, 0.66, 1.04, 0.13, 0.03, mat.chip, -2.23, -0.2, 0.12);
  box(board, 0.6, 1.12, 0.12, 0.03, mat.silver, 2.34, -0.4, 0.12);
  label(board, 'IMAGE PROCESSING', 1.42, 0.3, 0.7, 0.21, 0.29, '#626b6e', '600', 39);
  const components = new THREE.InstancedMesh(new THREE.BoxGeometry(0.18, 0.1, 0.09), mat.gold, 28);
  for (let i = 0; i < 28; i++) {
    dummy.position.set(-2.6 + (i % 14) * 0.4, i < 14 ? -1.3 : 1.3, 0.1);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    components.setMatrixAt(i, dummy.matrix);
  }
  board.add(components);
  const traces = [];
  for (let i = 0; i < 13; i++) {
    const x = -2.4 + i * 0.38;
    traces.push(x, -1.13, 0.06, x, -0.8, 0.06, x, -0.8, 0.06, x + 0.18, -0.62, 0.06);
  }
  const traceGeometry = new THREE.BufferGeometry();
  traceGeometry.setAttribute('position', new THREE.Float32BufferAttribute(traces, 3));
  board.add(new THREE.LineSegments(traceGeometry, new THREE.LineBasicMaterial({ color: 0x8b9d61, transparent: true, opacity: 0.65 })));

  const battery = part('battery', '电池模组', 'Battery module', [-1.65, -0.05, 0.25], [-5.1, -0.5, -0.15],
    '可拆卸电池为相机供电，公开容量为 1770 mAh。为便于观察，电池仓盖与电池归为同一展示组；外壳厚度、触点位置和装配关系均为示意。', '电源组件', 'schematic', [['官方电池容量', '1770 mAh'], ['官方标称能量', '6.8 Wh'], ['装配关系', '示意']]);
  box(battery, 2.53, 3.42, 1.5, 0.13, mat.rubber);
  const door = box(battery, 0.065, 3.47, 2.12, 0.028, mat.front, -1.91, 0.02, -0.27);
  door.name = '电池仓外盖（示意分组）';
  box(battery, 0.08, 0.42, 0.76, 0.035, mat.rubber, -1.965, 1, -0.2);
  box(battery, 2.58, 0.23, 1.55, 0.07, mat.front, 0, 1.55, 0);
  label(battery, 'OSMO', 1.65, 0.5, 0, 0.6, 0.759, '#91999b', '600', 70);
  label(battery, 'BATTERY', 1.55, 0.4, 0, 0.13, 0.759, '#6e797d', '500', 48);
  label(battery, 'SCHEMATIC', 1.62, 0.3, 0, -0.85, 0.759, '#626d70', '400', 39);
  for (let i = 0; i < 4; i++) box(battery, 0.18, 0.035, 0.3, 0.01, mat.gold, -0.45 + i * 0.3, 1.685, -0.15);

  const buttons = part('buttons', '快门与快捷按键', 'Shutter & quick switch', [0, 0, 0], [0, 3.35, 0.15],
    '顶部快门/录像按键和侧面快捷切换按键提供直接操控。按键帽的安装结构与内部触点为示意。', '操控组件', 'exterior', [['顶部', '快门 / 录像'], ['侧面', '快捷切换'], ['按键内部', '示意']]);
  const shutter = cylinder(buttons, 0.43, 0.125, mat.rubber, 2.12, 2.245, 0.1, 48);
  shutter.rotation.x = 0;
  const shutterRing = torus(buttons, 0.295, 0.027, mat.red, 2.12, 2.315, 0.1);
  shutterRing.rotation.x = Math.PI / 2;
  const qs = box(buttons, 0.085, 0.72, 0.75, 0.035, mat.rubber, 3.64, 1.25, -0.1);
  qs.name = '快捷切换按键';

  const mount = part('quick-release', '磁吸快拆接口', 'Magnetic quick-release', [0, -2.28, -0.02], [0, -4.35, 0.5],
    '底部快拆接口用于与安装配件连接。本模型仅表现接口轮廓，磁体、锁扣和内部机构均为示意。', '连接组件', 'exterior', [['接口', '磁吸快拆'], ['内部机构', '示意']]);
  box(mount, 3.38, 0.18, 1.67, 0.07, mat.ring);
  box(mount, 2.15, 0.16, 1.13, 0.065, mat.rubber, 0, -0.15, 0);
  box(mount, 0.29, 0.22, 1.05, 0.05, mat.edge, -1.43, -0.1, 0);
  box(mount, 0.29, 0.22, 1.05, 0.05, mat.edge, 1.43, -0.1, 0);

  const extraction = {
    frame: [0, 0, 0],
    'front-cover': [0, 0, 3.65],
    'lens-cover': [1.7, 0.38, 5.2],
    'lens-module': [1.7, 0.38, 1.85],
    'front-screen': [-1.605, 0.395, 3.3],
    'rear-screen': [0, 0, -4.7],
    motherboard: [0.15, 0, -2.45],
    battery: [-5.1, -0.05, 0.25],
    buttons: [0, 3.35, 0],
    'quick-release': [0, -4.35, -0.02],
  };
  for (const item of parts) {
    // Shared two-phase motion: extract along the mounting axis for 0–45%, then
    // fan outward for 45–100%. It is an explanatory animation, not a repair order.
    item.extract = new THREE.Vector3(...extraction[item.id]);
    item.waypoints = [item.extract.clone()];
    item.group.traverse((child) => {
      child.userData.partId = item.id;
      if (child.isMesh) {
        child.castShadow = !child.material.transparent;
        child.receiveShadow = true;
      }
    });
  }
  return {
    group,
    parts,
    dispose() {
      const geometries = new Set();
      const materials = new Set();
      group.traverse((object) => {
        if (object.geometry) geometries.add(object.geometry);
        for (const material of (Array.isArray(object.material) ? object.material : [object.material])) {
          if (material) materials.add(material);
        }
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      textures.forEach((texture) => texture.dispose());
    },
  };
}
