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
    edition: '002', modelLabel: '2024 · ELECTRIC SEDAN', wordmark: 'SU7',
    subtitle: ['流线之下，探索电动。', '从车身到电驱，逐层看见设计。'],
    overview: {
      title: '流线之下，自有天地。', enName: 'XIAOMI SU7 · 2024 STANDARD',
      description: '以 2024 款小米 SU7 标准版为外观与参数参考，探索车身、座舱与底盘电驱之间的关系。内部构造与展开路径为简化示意。',
      specs: [['车型参考', '2024 款标准版'], ['长 × 宽 × 高', '4997 × 1963 × 1455 mm'], ['轴距', '3000 mm'], ['驱动形式', '后置单电机 · 后轮驱动']],
    },
    view: [14, 8, 17], fitPadding: 1.24, frontLabel: '车头', rearLabel: '车尾',
    modelNotes: '本模型以 2024 款小米 SU7 标准版为参考，使用 Three.js 程序化几何构建。车身轮廓、海湾蓝配色、车灯和玻璃座舱均为简化表达；公开参数参考小米首发官方配置表，不混用 Pro、Max、Ultra 或后续改款配置。',
    schematicNotes: '车身分件、座椅、底盘、电池包与电驱内部布局、连接方式及展开路径均为教学示意，未按实车拆解验证，不代表真实维修拆装流程。轮组与灯组作为组合部件展示，模型不能用于工程测量。',
    sources: [
      { label: '小米 SU7 · 2024 首发官方配置表（PDF）', url: 'https://s1.xiaomiev.com/activity-outer-assets/0328/env/SU7%E5%8F%82%E6%95%B0%E9%85%8D%E7%BD%AE%E8%A1%A8328.pdf' },
      { label: '小米汽车 · 官方网站（当前车型）', url: 'https://www.xiaomiev.com/' },
    ],
  },
};
