import { createAction4 } from './action4.js';
import { createSU7 } from './su7.js';

// Add products here; each factory returns the same group + parts contract.
export const products = {
  'action-4': {
    name: 'DJI Osmo Action 4',
    create: createAction4,
    title: ['Osmo Action ', '4'], category: '运动相机', brand: 'DJI',
    edition: '001', modelLabel: '2023 · ACTION CAMERA', wordmark: 'ACTION 4',
    subtitle: ['小巧机身，逐层探索。', '看见每一个部件的巧思。'],
    overview: {
      title: '小机身，大世界。', enName: 'DJI OSMO ACTION 4',
      description: '从完整机身到内部层次，换一个角度认识这台运动相机。点击部件，或展开结构开始探索。',
      specs: [['传感器', '1/1.3 英寸 CMOS'], ['影像规格', '4K / 120fps'], ['机身重量', '145 g']],
    },
    view: [11, 7.5, 16], frontLabel: '正面', rearLabel: '背面',
    modelNotes: '本模型使用 Three.js 基础几何体和程序化纹理构建，未使用外部 3D 模型。外形比例、公开参数与标志性外观参考 DJI 官方资料。',
    schematicNotes: '主板布局、内部支架、连接方式、材质细节及部件拆解路径均为简化示意，不代表真实工程结构，也不能作为维修拆机指导。模型中的显示画面为程序化绘制。',
    sources: [
      { label: 'DJI Osmo Action 4 · 官方规格', url: 'https://www.dji.com/osmo-action-4/specs' },
      { label: 'DJI Osmo Action 4 · 官方 FAQ', url: 'https://www.dji.com/osmo-action-4/faq' },
      { label: 'DJI Osmo Action 4 · 用户手册', url: 'https://dl.djicdn.com/downloads/DJI_Osmo_Action_4/UM/20230906/DJI_Osmo_Action_4_User_Manual_v1.2_en.pdf' },
    ],
  },
  'xiaomi-su7': {
    name: '小米 SU7', create: createSU7,
    title: ['小米 ', 'SU7'], category: '纯电轿车', brand: 'xiaomi',
    edition: '002', modelLabel: 'SU7 · EXTERIOR STUDY', wordmark: 'SU7',
    subtitle: ['流线之下，探索细节。', '从车身到座舱，逐层看见设计。'],
    modelMethod: '精细外观模型', structureNote: '分组与展开为示意',
    sourceSummary: '外观模型来源与分组说明',
    overview: {
      title: '流线之下，自有天地。', enName: 'XIAOMI SU7 · EXTERIOR STUDY',
      description: '探索小米 SU7 的车身曲面、四扇车门、玻璃、灯组与座舱细节。外观采用新的精细模型，按原模型网格分组展开，不代表实车拆装流程。',
      specs: [['产品系列', '小米 SU7'], ['探索范围', '外观 / 车门 / 座舱'], ['展示分组', '12 组模型部件'], ['车型配置', '源模型未标注具体版本']],
    },
    view: [14, 8, 17], fitPadding: 1.24, frontLabel: '车头', rearLabel: '车尾',
    modelNotes: '外观模型《SU7》由 s1657270997 制作，来自 Sketchfab，文件元数据标注 CC BY 4.0 许可。保留原模型几何、材质与内嵌贴图；本页面调整展示朝向、比例与部件分组，并添加展开动画。源文件未注明具体年款或配置，不据此外观推断标准版、Pro 或 Max。',
    schematicNotes: '12 组展示部件依据源模型已有网格整理。四扇车门可分别展开；车壳、座舱及轮组保留原模型组合。未添加电池、底盘电驱等未经验证的内部结构。展开路径仅用于观察，不代表真实拆装步骤，模型不能用于工程测量。',
    sources: [
      { label: '外观模型《SU7》 · s1657270997 / Sketchfab', url: 'https://sketchfab.com/3d-models/su7-7296a91633d74c6eb113010e2ed75eda' },
      { label: '模型作者 · s1657270997', url: 'https://sketchfab.com/s1657270997' },
      { label: '模型许可 · Creative Commons BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
      { label: '小米 SU7 · 2024 首发官方配置表（PDF）', url: 'https://s1.xiaomiev.com/activity-outer-assets/0328/env/SU7%E5%8F%82%E6%95%B0%E9%85%8D%E7%BD%AE%E8%A1%A8328.pdf' },
      { label: '小米汽车 · 官方网站（当前车型）', url: 'https://www.xiaomiev.com/' },
    ],
  },
};
