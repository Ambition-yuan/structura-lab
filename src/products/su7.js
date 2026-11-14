import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// SU7 by s1657270997, CC BY 4.0. The downloaded GLB is kept unchanged.
// https://sketchfab.com/3d-models/su7-7296a91633d74c6eb113010e2ed75eda
// Only the scene orientation, display scale and explanatory grouping change.
const modelURL = new URL('../assets/su7-detail.glb', import.meta.url);

export async function createSU7() {
  const gltf = await new GLTFLoader().loadAsync(modelURL.href);
  const source = gltf.scene;
  const group = new THREE.Group();
  group.name = '小米 SU7 · 下载外观模型';
  const parts = [];
  const originalMaterials = new Set();
  source.traverse(object => {
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (material) originalMaterials.add(material);
    }
  });

  let disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true;
    const geometries = new Set(), materials = new Set(originalMaterials), textures = new Set(), images = new Set();
    for (const root of [group, source]) root.traverse(object => {
      if (object.isInstancedMesh) object.dispose();
      if (object.geometry) geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (material) materials.add(material);
      }
    });
    for (const material of materials) {
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
      material.dispose();
    }
    for (const texture of textures) {
      const data = texture.source?.data;
      for (const image of Array.isArray(data) ? data : [data]) if (image) images.add(image);
      texture.dispose();
    }
    for (const image of images) image.close?.();
    for (const geometry of geometries) geometry.dispose();
  }

  try {
    // The supplied scene has +X forward and +Y up. Rotate the entire hierarchy
    // before grouping so materials, normals and the artist's transforms survive.
    const normalized = new THREE.Group();
    normalized.add(source);
    normalized.rotation.y = -Math.PI / 2;
    group.add(normalized);
    group.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(normalized);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    if (!Number.isFinite(size.z) || size.z <= 0) throw new Error('SU7 模型尺寸无效');
    const scale = 10 / size.z;
    normalized.scale.setScalar(scale);
    normalized.position.copy(center).multiplyScalar(-scale);
    group.updateMatrixWorld(true);

    const nodes = new Map();
    source.traverse(object => nodes.set(object.userData.name || object.name, object));

    function part(id, name, enName, names, offset, description, specs) {
      const selectedNodes = names.map(nodeName => {
        const node = nodes.get(nodeName);
        if (!node) throw new Error(`SU7 模型缺少节点：${nodeName}`);
        return node;
      });
      const partBounds = new THREE.Box3();
      for (const node of selectedNodes) partBounds.expandByObject(node);
      const assembled = partBounds.getCenter(new THREE.Vector3());
      const partGroup = new THREE.Group();
      partGroup.name = name;
      partGroup.position.copy(assembled);
      group.add(partGroup);
      group.updateMatrixWorld(true);
      // attach() preserves each imported node's complete world transform.
      for (const node of selectedNodes) partGroup.attach(node);
      partGroup.traverse(object => {
        object.userData.partId = id;
        if (object.isMesh) {
          object.castShadow = false;
          object.receiveShadow = false;
        }
      });
      parts.push({
        id, name, enName, group: partGroup, assembled,
        exploded: assembled.clone().add(new THREE.Vector3(...offset)),
        description, category: '模型部件', kind: 'model',
        specs: [...specs, ['分件与路径', '模型分组 · 展开示意']],
      });
    }

    part('body-shell', '车身外壳', 'Body shell', ['Object_18'], [0, 0, 0],
      '保留下载模型的车身曲面与蓝色车漆。前舱盖、翼子板、车顶及尾部在源文件中属于同一网格，因此作为整体展示；外观不用于核实具体配置版本。',
      [['模型内容', '车身整体曲面'], ['材质', '原模型车漆']]);
    part('body-trim', '车身内衬与饰件', 'Body lining & trim', ['Object_19', 'Object_20', 'polySurface116_7', 'mesh_7_694.nr_5'], [0, -1.8, -0.4],
      '来自源模型的黑色车身饰件、内侧表面与局部支撑外形。它们按显示关系组合，不代表经过实车拆解验证的底盘或承载结构。',
      [['模型内容', '饰件 / 内侧表面']]);
    part('glazing', '风挡与车顶玻璃', 'Windscreen & roof glazing', ['Object_21'], [0, 3.4, -0.25],
      '保留源模型的风挡、车顶玻璃及透明材质。四扇车门的侧窗仍随各自车门移动，避免把不同部件的玻璃强行合并。',
      [['模型内容', '风挡 / 车顶玻璃'], ['侧窗', '归属各车门']]);
    part('left-front-door', '左前车门', 'Left front door', ['DOOR1_8'], [3.6, 0.4, 1.2],
      '直接使用源模型中独立的左前车门组，包含外面板、侧窗、后视镜与门内饰。向外平移用于观察模型层次，不模拟真实铰链开启过程。',
      [['模型内容', '车门 / 侧窗 / 后视镜']]);
    part('left-rear-door', '左后车门', 'Left rear door', ['DOOR2_9'], [3.6, 0.4, -1.2],
      '源模型中的左后车门保留车漆、玻璃和内饰贴图。展开时整组移出，便于观察后排座舱及车门之间的关系。',
      [['模型内容', '后车门 / 侧窗 / 内饰']]);
    part('right-front-door', '右前车门', 'Right front door', ['DOOR3_10'], [-3.6, 0.4, 1.2],
      '直接使用源模型中独立的右前车门组，保留侧窗、后视镜及内饰。部件移动距离仅为展示设置，不对应实车尺寸或装配公差。',
      [['模型内容', '车门 / 侧窗 / 后视镜']]);
    part('right-rear-door', '右后车门', 'Right rear door', ['DOOR4_11'], [-3.6, 0.4, -1.2],
      '源模型中的右后车门与玻璃、内饰作为整体展示。与其他门组分别选择，能够从不同角度观察原模型的细节。',
      [['模型内容', '后车门 / 侧窗 / 内饰']]);
    part('cabin', '座舱与内饰', 'Cabin & interior', ['-119-126_0', '-125-365_1', '-128-864_2', 'INSIDE_3'], [0, 1.7, -0.2],
      '组合源模型自带的座椅、仪表台及其他座舱网格，保留原始内饰贴图。这里展示的是作者提供的模型内容，不是补绘的电池或动力系统。',
      [['模型内容', '原模型座舱'], ['纹理', '内嵌贴图']]);
    part('wheels', '轮胎与轮毂', 'Wheels & tyres', ['Wheel1.001_12'], [0, -3.5, 0],
      '源文件将四个车轮合并为一个网格。保留轮胎、轮毂和法线贴图，并作为完整轮组向下移开；未人为推断制动或悬架内部结构。',
      [['模型分组', '四轮合并'], ['材质', '原始颜色 / 法线贴图']]);
    part('lighting', '前后灯组', 'Front & rear lighting', ['Object_22', 'Object_23', 'Object_24'], [0, 1.2, 2.8],
      '组合源模型中的前灯、尾灯和灯罩，保留原有发光与透明材质。灯组整体移开用于辨识外形，不代表灯具真实拆装路径。',
      [['模型内容', '前灯 / 尾灯 / 灯罩']]);
    part('badges', '标识与号牌', 'Badges & plates', ['logo3_4'], [0, 3.0, -2.4],
      '来自源模型的车身标识、尾部文字与号牌网格。名称及商标归其权利人所有，模型由独立作者制作。',
      [['模型内容', '车标 / 文字 / 号牌']]);
    part('radar', '传感器外饰', 'Sensor exterior details', ['Object_25'], [0, 2.5, 2.3],
      '源文件名为 Car_radar 的传感器外观网格，保留其原始形状与位置。模型的配置版本尚未核实，不能据此推断传感器规格或辅助驾驶能力。',
      [['来源分组', 'Car_radar'], ['配置版本', '未核实']]);

    // Catch future asset replacements whose node layout no longer matches this
    // adapter instead of silently dropping visible meshes from the car.
    let unassigned = 0;
    normalized.traverse(object => { if (object.isMesh) unassigned++; });
    if (unassigned) throw new Error(`SU7 模型有 ${unassigned} 个未分组网格`);
    group.remove(normalized);
    return { group, parts, dispose, modelAsset: 'su7-detail.glb' };
  } catch (error) {
    dispose();
    throw error;
  }
}
