import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// A procedural exterior study of the original SU7. Internal packaging, joints
// and extraction paths explain relationships; they are not engineering data.
// Coordinates: front +Z, left/right X, roof +Y. No external model assets.
export function createSU7() {
  const group = new THREE.Group();
  group.name = '小米 SU7';
  const parts = [];
  const originalMaterials = new Set();
  const material = (properties, physical = false) => {
    const result = physical ? new THREE.MeshPhysicalMaterial(properties) : new THREE.MeshStandardMaterial(properties);
    originalMaterials.add(result);
    return result;
  };
  const mat = {
    paint: material({ color: 0x69b6bc, metalness: 0.58, roughness: 0.26, clearcoat: 1, clearcoatRoughness: 0.18, side: THREE.DoubleSide }, true),
    paintDark: material({ color: 0x377b83, metalness: 0.55, roughness: 0.32 }),
    glass: material({ color: 0x122d38, metalness: 0.5, roughness: 0.16, clearcoat: 1, side: THREE.DoubleSide }, true),
    rubber: material({ color: 0x151b1d, roughness: 0.86 }),
    black: material({ color: 0x172125, metalness: 0.3, roughness: 0.45 }),
    silver: material({ color: 0xb5c2c6, metalness: 0.88, roughness: 0.25 }),
    steel: material({ color: 0x59676b, metalness: 0.7, roughness: 0.45 }),
    brake: material({ color: 0xc6bda8, metalness: 0.65, roughness: 0.48 }),
    seat: material({ color: 0xb7ab92, roughness: 0.82 }),
    seatDark: material({ color: 0x736f62, roughness: 0.8 }),
    battery: material({ color: 0x2d4d5c, metalness: 0.5, roughness: 0.48 }),
    cell: material({ color: 0x83a9b5, metalness: 0.55, roughness: 0.35 }),
    orange: material({ color: 0xe18b39, roughness: 0.5 }),
    whiteLED: material({ color: 0xe9f8ff, emissive: 0xb7e5ff, emissiveIntensity: 1.9, roughness: 0.2 }),
    redLED: material({ color: 0xf43c44, emissive: 0xeb172c, emissiveIntensity: 1.2, roughness: 0.2 }),
    display: material({ color: 0x102632, emissive: 0x236278, emissiveIntensity: 0.35, roughness: 0.18 }),
  };

  function mesh(parent, geometry, surface, x = 0, y = 0, z = 0) {
    const object = new THREE.Mesh(geometry, surface);
    object.position.set(x, y, z);
    parent.add(object);
    return object;
  }
  function box(parent, width, height, depth, surface, x = 0, y = 0, z = 0, radius = 0.06) {
    return mesh(parent, new RoundedBoxGeometry(width, height, depth, 2, Math.min(radius, width / 2, height / 2, depth / 2)), surface, x, y, z);
  }
  function tube(parent, coordinates, radius, surface, closed = false) {
    const curve = new THREE.CatmullRomCurve3(coordinates.map(p => new THREE.Vector3(...p)), closed);
    return mesh(parent, new THREE.TubeGeometry(curve, Math.max(16, coordinates.length * 5), radius, 6, closed), surface);
  }
  function cylinder(parent, radius, length, surface, x, y, z) {
    const object = mesh(parent, new THREE.CylinderGeometry(radius, radius, length, 32), surface, x, y, z);
    object.rotation.z = Math.PI / 2;
    return object;
  }
  function part(id, name, enName, exploded, description, category, kind, specs) {
    const object = new THREE.Group();
    object.name = name;
    object.userData.partId = id;
    group.add(object);
    const entry = {
      id, name, enName, group: object,
      assembled: new THREE.Vector3(),
      exploded: new THREE.Vector3(...exploded),
      extract: new THREE.Vector3(...exploded).multiplyScalar(0.6),
      description, category, kind, specs,
    };
    parts.push(entry);
    return object;
  }
  // Smooth patches keep the long bonnet, shoulders and fastback roof legible.
  function patch(parent, pointAt, surface, uSegments = 20, vSegments = 8) {
    const vertices = [], indices = [];
    for (let v = 0; v <= vSegments; v++) for (let u = 0; u <= uSegments; u++) {
      vertices.push(...pointAt(u / uSegments, v / vSegments));
    }
    for (let v = 0; v < vSegments; v++) for (let u = 0; u < uSegments; u++) {
      const a = v * (uSegments + 1) + u;
      indices.push(a, a + 1, a + uSegments + 1, a + 1, a + uSegments + 2, a + uSegments + 1);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return mesh(parent, geometry, surface);
  }
  const widthAt = z => 1.94 - 0.26 * Math.pow(Math.abs(z) / 5, 4);
  const beltAt = z => 0.45 - 0.28 * Math.pow(Math.max(z, 0) / 5, 3) - 0.035 * Math.pow(Math.max(-z, 0) / 5, 2);
  const bottomAt = z => {
    let bottom = -1.01 + 0.24 * Math.pow(Math.abs(z) / 5, 5);
    for (const wheelZ of [-3.05, 3.05]) {
      const dz = z - wheelZ;
      if (Math.abs(dz) < 1.02) bottom = Math.max(bottom, -0.65 + Math.sqrt(1.02 ** 2 - dz ** 2));
    }
    return bottom;
  };
  function sidePanel(parent, side, start, end) {
    patch(parent, (u, v) => {
      const z = THREE.MathUtils.lerp(start, end, u);
      const y = THREE.MathUtils.lerp(bottomAt(z), beltAt(z), v);
      const x = side * (widthAt(z) - 0.10 * (1 - v) + 0.045 * Math.sin(v * Math.PI));
      return [x, y, z];
    }, mat.paint, 56, 10);
  }
  function deck(parent, start, end, roundEnd = 0) {
    patch(parent, (u, v) => {
      const cross = u * 2 - 1;
      const baseZ = THREE.MathUtils.lerp(start, end, v);
      const roundness = Math.sqrt(Math.max(0, 1 - cross * cross));
      const z = baseZ + roundEnd * 0.52 * roundness * Math.pow(roundEnd > 0 ? v : 1 - v, 5);
      // Curving the leading/trailing edge joins the end fascia continuously.
      const width = widthAt(baseZ);
      return [cross * width, beltAt(z) + 0.10 * (1 - cross * cross), z];
    }, mat.paint, 24, 22);
  }
  function endFascia(parent, direction) {
    const sideZ = direction * 4.45, sideWidth = widthAt(sideZ);
    patch(parent, (u, v) => {
      const cross = u * 2 - 1;
      const roundness = Math.sqrt(Math.max(0, 1 - cross * cross));
      const topZ = sideZ + direction * 0.52 * roundness;
      const top = beltAt(topZ) + 0.10 * (1 - cross * cross);
      return [cross * (sideWidth - 0.10 * (1 - v)), THREE.MathUtils.lerp(bottomAt(sideZ), top, v), topZ - direction * 0.10 * (1 - v) * roundness];
    }, mat.paint, 36, 14);
    const lower = [];
    for (let i = 0; i <= 24; i++) {
      const cross = i / 12 - 1;
      lower.push([cross * (sideWidth - 0.10), bottomAt(sideZ) + 0.018, sideZ + direction * 0.42 * Math.sqrt(Math.max(0, 1 - cross * cross))]);
    }
    tube(parent, lower, 0.035, mat.black);
  }

  const body = part('body-shell', '车身与翼子板', 'Body & fenders', [0, 0, 0],
    '低矮的车身、舒展的前舱和溜背轮廓参考初代小米 SU7。翼子板与保险杠合并展示；钣金厚度、加强件及连接方式均经过简化。', '车身结构', 'exterior', [['外观参考', '初代小米 SU7'], ['车身结构', '简化建模']]);
  for (const side of [-1, 1]) {
    sidePanel(body, side, -4.45, -2.48);
    sidePanel(body, side, 1.94, 4.45);
    box(body, 0.14, 0.12, 4.2, mat.paintDark, side * 1.86, -0.98, -0.2, 0.035);
    // Wheel-opening trim follows the cut-out rather than covering the tyres.
    for (const wheelZ of [-3.05, 3.05]) {
      const arch = [];
      for (let i = 0; i <= 24; i++) {
        const angle = -0.34 + i / 24 * (Math.PI + 0.68);
        const z = wheelZ + Math.cos(angle) * 1.025;
        arch.push([side * (widthAt(z) + 0.012), -0.65 + Math.sin(angle) * 1.025, z]);
      }
      tube(body, arch, 0.022, mat.paintDark);
    }
  }
  deck(body, -4.45, -3.05, -1);
  endFascia(body, 1); endFascia(body, -1);
  // Insets follow the rounded nose, avoiding a separate rectangular bumper.
  patch(body, (u, v) => {
    const x = (u * 2 - 1) * 1.23, y = THREE.MathUtils.lerp(-0.58, -0.36, v);
    const roundness = Math.sqrt(1 - (x / 1.72) ** 2);
    return [x, y, 4.45 + (0.52 - 0.10 * (0.28 - y) / 1.16) * roundness + 0.016];
  }, mat.black, 24, 2);
  for (const side of [-1, 1]) {
    const vent = box(body, 0.09, 0.25, 0.035, mat.black, side * 1.52, -0.26, 4.715, 0.025);
    vent.rotation.y = side * 0.65;
  }
  box(body, 0.85, 0.19, 0.045, mat.black, 0, -0.34, -4.945, 0.03);

  const hood = part('hood', '前舱盖', 'Front hood', [0, 2.6, 3.2],
    '长前舱盖与两侧隆起的翼子板形成运动轿车的前部轮廓。本展示将前舱盖整体向前上方移开，铰链和前舱内部没有按实车复刻。', '外覆盖件', 'exterior', [['位置', '车身前部'], ['开启路径', '展示示意']]);
  deck(hood, 1.97, 4.45, 1);
  // Small, restrained badge; no external texture is required.
  box(hood, 0.19, 0.015, 0.24, mat.silver, 0, 0.385, 4.27, 0.035);
  for (const side of [-1, 1]) tube(hood, [[side * 1.32, 0.47, 2.05], [side * 1.26, 0.43, 3.0], [side * 1.01, 0.31, 4.43]], 0.012, mat.paintDark);

  // Roof profile uses a smooth sampled curve from the rear deck to the cowl.
  const roofCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(1.70, 0.49, -3.06),
    new THREE.Vector3(1.48, 1.16, -2.12),
    new THREE.Vector3(1.36, 1.44, -1.20),
    new THREE.Vector3(1.37, 1.51, 0.43),
    new THREE.Vector3(1.48, 1.28, 1.10),
    new THREE.Vector3(1.75, 0.53, 1.94),
  ]);
  const glazing = part('glazing', '玻璃与车顶', 'Glazing & roof', [0, 5.2, -0.3],
    '前风挡、侧窗与弧形车顶共同勾勒溜背座舱。玻璃采用深色材质以突出轮廓；分层、密封件与车顶骨架为简化示意。', '座舱外部', 'exterior', [['组成', '风挡 / 侧窗 / 车顶'], ['玻璃与骨架', '简化示意']]);
  patch(glazing, (u, v) => {
    const p = roofCurve.getPoint(v), cross = u * 2 - 1;
    return [cross * p.x, p.y + 0.10 * (1 - cross * cross), p.z];
  }, mat.glass, 24, 42);
  for (const side of [-1, 1]) {
    patch(glazing, (u, v) => {
      const p = roofCurve.getPoint(u);
      const low = beltAt(p.z) + 0.015;
      return [side * THREE.MathUtils.lerp(widthAt(p.z) - 0.035, p.x, v), THREE.MathUtils.lerp(low, p.y, v), p.z];
    }, mat.glass, 42, 8);
    const edge = [], sill = [];
    for (let i = 0; i <= 40; i++) {
      const p = roofCurve.getPoint(i / 40);
      edge.push([side * p.x, p.y + 0.014, p.z]);
      sill.push([side * (widthAt(p.z) - 0.025), beltAt(p.z) + 0.026, p.z]);
    }
    tube(glazing, edge, 0.048, mat.paint);
    tube(glazing, sill, 0.028, mat.silver);
    tube(glazing, [[side * 1.916, 0.46, -0.48], [side * 1.63, 0.93, -0.48], [side * 1.362, 1.51, -0.48]], 0.058, mat.black);
  }
  for (const t of [0.29, 0.76]) {
    const p = roofCurve.getPoint(t);
    tube(glazing, [[-p.x, p.y + 0.01, p.z], [0, p.y + 0.11, p.z], [p.x, p.y + 0.01, p.z]], 0.025, mat.black);
  }

  for (const side of [-1, 1]) {
    const doors = part(side < 0 ? 'left-doors' : 'right-doors', side < 0 ? '左侧车门' : '右侧车门', side < 0 ? 'Left doors' : 'Right doors', [side * 4.0, 0.75, 0],
      '前后车门合并为一个展示组，保留平滑的侧面、门缝和把手。门内防撞梁、升降机构以及车门开启角度均未复刻。', '外覆盖件', 'exterior', [['展示分组', '同侧前后车门'], ['门内机构', '未作实物复刻']]);
    sidePanel(doors, side, -2.45, 1.91);
    for (const z of [-2.45, -0.47, 1.91]) {
      const coords = [];
      for (let i = 0; i <= 8; i++) {
        const v = i / 8;
        coords.push([side * (widthAt(z) - 0.10 * (1 - v) + 0.045 * Math.sin(v * Math.PI) + 0.005), THREE.MathUtils.lerp(bottomAt(z) + 0.025, beltAt(z), v), z]);
      }
      tube(doors, coords, 0.013, mat.black);
    }
    for (const z of [-1.92, 0.06]) box(doors, 0.045, 0.075, 0.39, mat.silver, side * 1.967, 0.21, z, 0.025);
    // Door mirrors travel with the front doors.
    box(doors, 0.38, 0.06, 0.13, mat.black, side * 1.99, 0.51, 1.53, 0.02);
    box(doors, 0.42, 0.20, 0.46, mat.paint, side * 2.14, 0.59, 1.47, 0.09);
    box(doors, 0.33, 0.12, 0.016, mat.glass, side * 2.15, 0.59, 1.23, 0.035);
  }

  const tyreGeometry = new THREE.TorusGeometry(0.64, 0.20, 12, 48);
  const lipGeometry = new THREE.TorusGeometry(0.56, 0.025, 6, 40);
  function wheel(parent, side, z) {
    const x = side * 1.84, y = -0.65;
    const tyre = mesh(parent, tyreGeometry, mat.rubber, x, y, z);
    tyre.rotation.y = Math.PI / 2;
    cylinder(parent, 0.59, 0.30, mat.black, x, y, z);
    cylinder(parent, 0.46, 0.035, mat.brake, x + side * 0.13, y, z);
    box(parent, 0.11, 0.35, 0.16, mat.steel, x + side * 0.17, y, z + 0.33, 0.035);
    const lip = mesh(parent, lipGeometry, mat.silver, x + side * 0.21, y, z);
    lip.rotation.y = Math.PI / 2;
    // One instanced mesh per wheel provides the paired sculpted spokes.
    const spokes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.055, 0.48, 0.065), mat.silver, 10);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 10; i++) {
      const angle = Math.floor(i / 2) / 5 * Math.PI * 2 + (i % 2 ? 0.10 : -0.10);
      dummy.position.set(x + side * 0.22, y + Math.cos(angle) * 0.31, z + Math.sin(angle) * 0.31);
      dummy.rotation.set(angle, 0, 0);
      dummy.updateMatrix(); spokes.setMatrixAt(i, dummy.matrix);
    }
    parent.add(spokes);
    cylinder(parent, 0.15, 0.075, mat.silver, x + side * 0.23, y, z);
    cylinder(parent, 0.073, 0.08, mat.black, x + side * 0.24, y, z);
    // Sidewall rings give the tyres a readable profile without heavy textures.
    const sidewall = mesh(parent, new THREE.TorusGeometry(0.70, 0.009, 4, 40), mat.steel, x + side * 0.185, y, z);
    sidewall.rotation.y = Math.PI / 2;
  }
  const frontWheels = part('front-wheels', '前轮与制动', 'Front wheels & brakes', [0, -0.2, 4.1],
    '前轮、轮圈与制动盘合并展示。轮辐、制动卡钳和胎面均为外观示意，未对应某一种选装轮圈或制动规格。', '行走组件', 'exterior', [['组成', '轮胎 / 轮圈 / 制动盘'], ['轮圈样式', '简化示意']]);
  const rearWheels = part('rear-wheels', '后轮与制动', 'Rear wheels & brakes', [0, -0.2, -4.1],
    '后轮承担车辆支撑与驱动力传递。本组将左右后轮同步移开以露出底盘关系，实际连接件和制动结构经过简化。', '行走组件', 'exterior', [['组成', '轮胎 / 轮圈 / 制动盘'], ['连接结构', '示意']]);
  for (const side of [-1, 1]) { wheel(frontWheels, side, 3.05); wheel(rearWheels, side, -3.05); }

  const cabin = part('cabin', '座椅与驾驶舱', 'Seats & cockpit', [-3.5, 2.8, -2.0],
    '座椅、中控屏、方向盘与中控台展示乘员舱的空间关系。座椅骨架、电子器件和内饰固定结构为示意，不代表实车装配细节。', '座舱组件', 'schematic', [['组成', '座椅 / 仪表台 / 中控台'], ['内部构造', '示意']]);
  box(cabin, 3.1, 0.11, 4.9, mat.black, 0, -0.42, -0.38);
  for (const x of [-0.82, 0.82]) {
    box(cabin, 1.05, 0.21, 1.05, mat.seat, x, -0.08, 0.22, 0.10);
    const back = box(cabin, 1.02, 1.12, 0.24, mat.seat, x, 0.49, -0.29, 0.11); back.rotation.x = -0.16;
    box(cabin, 0.57, 0.32, 0.24, mat.seat, x, 1.13, -0.39, 0.10);
    box(cabin, 0.74, 0.70, 0.045, mat.seatDark, x, 0.49, -0.142, 0.02).rotation.x = -0.16;
  }
  box(cabin, 2.75, 0.28, 0.96, mat.seat, 0, -0.02, -1.72, 0.11);
  box(cabin, 2.77, 0.93, 0.24, mat.seat, 0, 0.46, -2.12, 0.10).rotation.x = -0.16;
  for (const x of [-0.85, 0, 0.85]) box(cabin, 0.48, 0.25, 0.22, mat.seat, x, 1.01, -2.21, 0.07);
  box(cabin, 3.02, 0.28, 0.62, mat.black, 0, 0.38, 1.48, 0.11);
  box(cabin, 0.47, 0.30, 1.51, mat.seatDark, 0, -0.04, 0.39, 0.09);
  box(cabin, 1.0, 0.66, 0.08, mat.black, 0.19, 0.73, 1.20, 0.045);
  box(cabin, 0.90, 0.55, 0.012, mat.display, 0.19, 0.73, 1.151, 0.025);
  const steering = mesh(cabin, new THREE.TorusGeometry(0.29, 0.036, 8, 32), mat.black, -0.85, 0.64, 0.98);
  steering.rotation.x = -0.25;
  box(cabin, 0.39, 0.08, 0.06, mat.black, -0.85, 0.64, 0.98, 0.025);
  box(cabin, 0.14, 0.17, 0.07, mat.black, -0.85, 0.60, 0.98, 0.035);

  const chassis = part('chassis', '底盘与悬架', 'Chassis & suspension', [0, -1.85, 0],
    '底盘承托车身、电池与行走组件。示意梁架、悬架连杆和连接点帮助理解上下层关系，不代表真实底盘拓扑、尺寸或制造方式。', '底盘结构', 'schematic', [['功能', '承载 / 连接 / 支撑'], ['结构布局', '示意']]);
  for (const x of [-1.47, 1.47]) box(chassis, 0.15, 0.22, 7.6, mat.steel, x, -0.82, 0);
  for (const z of [-3.05, -1.6, 1.5, 3.05]) box(chassis, 3.1, 0.18, 0.18, mat.steel, 0, -0.82, z);
  for (const z of [-3.05, 3.05]) {
    cylinder(chassis, 0.08, 3.4, mat.steel, 0, -0.65, z);
    for (const side of [-1, 1]) {
      tube(chassis, [[side * 0.9, -0.78, z - 0.47], [side * 1.66, -0.65, z], [side * 0.9, -0.78, z + 0.47]], 0.055, mat.silver);
      tube(chassis, [[side * 1.40, -0.79, z], [side * 1.47, -0.05, z]], 0.075, mat.black);
    }
  }

  const battery = part('battery-pack', '动力电池包', 'Traction battery pack', [0, -4.0, 0.1],
    '扁平电池包位于乘员舱下方，为整车提供能量。为便于观察，本模型用规则模组展示内部层次；电芯数量、排列与冷却结构均为示意。', '能源组件', 'schematic', [['位置', '乘员舱下方'], ['电芯与冷却布局', '示意']]);
  box(battery, 2.83, 0.23, 4.90, mat.battery, 0, -0.81, -0.1, 0.09);
  box(battery, 2.68, 0.05, 4.72, mat.black, 0, -0.666, -0.1, 0.035);
  const cells = new THREE.InstancedMesh(new THREE.BoxGeometry(0.72, 0.14, 0.63), mat.cell, 18);
  const cellDummy = new THREE.Object3D();
  for (let row = 0; row < 6; row++) for (let col = 0; col < 3; col++) {
    cellDummy.position.set((col - 1) * 0.83, -0.57, -2.03 + row * 0.76);
    cellDummy.updateMatrix(); cells.setMatrixAt(row * 3 + col, cellDummy.matrix);
  }
  battery.add(cells);
  tube(battery, [[1.16, -0.53, -2.23], [1.28, -0.53, -2.48], [1.28, -0.53, -2.83]], 0.035, mat.orange);

  const drive = part('rear-drive', '后电驱总成', 'Rear electric drive', [3.9, -1.4, -2.45],
    '以初代 SU7 标准版的后轮驱动布局作参考，电机通过传动机构驱动车轮。电机外壳、逆变器、半轴和线束的形状与连接均为示意。', '动力组件', 'schematic', [['布局参考', '标准版后轮驱动'], ['内部构造', '示意']]);
  cylinder(drive, 0.39, 1.30, mat.silver, 0, -0.47, -3.02);
  cylinder(drive, 0.29, 0.18, mat.steel, -0.74, -0.47, -3.02);
  cylinder(drive, 0.09, 2.70, mat.steel, 0, -0.47, -3.02);
  box(drive, 0.91, 0.28, 0.69, mat.steel, 0.15, -0.02, -3.02, 0.055);
  for (let i = 0; i < 7; i++) box(drive, 0.022, 0.055, 0.56, mat.silver, -0.13 + i * 0.09, 0.145, -3.02, 0.006);
  tube(drive, [[0.5, 0.02, -2.72], [0.95, -0.1, -2.56], [1.25, -0.46, -2.56]], 0.038, mat.orange);

  const lighting = part('lighting', '前后灯组', 'Headlights & rear light bar', [0, 1.7, 0],
    '水滴轮廓的前灯与贯穿式尾灯是 SU7 的外观识别特征。前后灯组合并展示，发光元件、透镜、密封结构与光学参数均为示意。', '照明组件', 'exterior', [['前部', '水滴轮廓灯组'], ['后部', '贯穿式灯带']]);
  for (const side of [-1, 1]) {
    const shape = new THREE.Shape();
    shape.moveTo(-0.27, -0.38);
    shape.bezierCurveTo(-0.42, -0.14, -0.31, 0.31, 0.04, 0.54);
    shape.bezierCurveTo(0.36, 0.31, 0.37, -0.17, 0.24, -0.38);
    shape.quadraticCurveTo(0, -0.52, -0.27, -0.38);
    const lampPoint = (x, y, lift = 0) => {
      const worldX = side * 1.40 + x, z = 4.17 - y;
      return [worldX, beltAt(z) + 0.1 * (1 - (worldX / widthAt(z)) ** 2) + 0.024 + lift, z];
    };
    const lampGeometry = new THREE.ShapeGeometry(shape, 20);
    const positions = lampGeometry.attributes.position;
    for (let i = 0; i < positions.count; i++) positions.setXYZ(i, ...lampPoint(positions.getX(i), positions.getY(i)));
    lampGeometry.computeVertexNormals();
    mesh(lighting, lampGeometry, mat.black);
    const borderPoints = shape.getPoints(40).map(p => lampPoint(p.x, p.y, 0.014));
    tube(lighting, borderPoints, 0.026, mat.whiteLED, true);
    for (const y of [-0.15, 0.09]) tube(lighting, [-0.23, 0, 0.23].map(x => lampPoint(x, y, 0.02)), 0.022, mat.whiteLED);
  }
  tube(lighting, [[-1.68, 0.17, -4.79], [-1.38, 0.19, -4.97], [0, 0.20, -5.00], [1.38, 0.19, -4.97], [1.68, 0.17, -4.79]], 0.055, mat.black);
  tube(lighting, [[-1.68, 0.18, -4.83], [-1.37, 0.20, -5.015], [0, 0.21, -5.045], [1.37, 0.20, -5.015], [1.68, 0.18, -4.83]], 0.025, mat.redLED);

  for (const item of parts) {
    item.group.traverse(object => {
      object.userData.partId = item.id;
      if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; }
    });
  }
  return {
    group,
    parts,
    dispose() {
      const geometries = new Set();
      const materials = new Set(originalMaterials);
      group.traverse(object => {
        // InstancedMesh owns per-instance GPU buffers beyond its geometry.
        if (object.isInstancedMesh) object.dispose();
        if (object.geometry) geometries.add(object.geometry);
        for (const surface of Array.isArray(object.material) ? object.material : [object.material]) {
          if (surface) materials.add(surface);
        }
      });
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(surface => surface.dispose());
    },
  };
}
