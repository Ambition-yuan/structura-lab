# STRUCTURA LAB · DJI Osmo Action 4

使用 Three.js、原生 HTML/CSS/JavaScript 制作的产品结构探索网页。第一款产品为 DJI Osmo Action 4，提供 10 组可选择部件、鼠标/触摸旋转缩放、展开滑杆、一键拆解与复原，以及部件列表和详情的同步选择。适配桌面和手机；WebGL 不可用时显示提示。

## 启动与构建

建议使用 Node.js 18 或更新版本；本项目的本地服务与构建脚本也兼容 Node.js 14。

```sh
npm install
npm start
```

访问 <http://localhost:5173>。请通过 HTTP 服务打开，不能直接双击 `index.html`。`npm run dev` 与 `npm start` 等效；可用环境变量 `PORT` 修改端口。

```sh
npm run build
```

构建结果位于 `dist/`，可以交给任意静态 HTTP 服务托管。构建时将 Three.js 复制到 `dist/vendor/three/`，网页从同源加载依赖，不依赖运行时 CDN。

唯一应用依赖是 **Three.js 0.180.0**，包括其 OrbitControls、RoundedBoxGeometry 等附加模块。模型由基础几何体组合，纹理由 Canvas 程序生成；没有外部模型、图片、字体、服务密钥或后端。首次安装依赖需要网络。

## 模型与资料范围

10 组部件：机身框架、前面板、镜头保护盖、镜头模组、前屏、后屏、主板、电池、按键、磁吸快拆接口。

已核对的公开参数包括机身 70.5 × 44.2 × 32.8 mm、重量 145 g、1/1.3 英寸 CMOS、f/2.8 光圈、155° 视场角、1.4 英寸前屏、2.25 英寸后屏，以及 1770 mAh / 6.8 Wh 电池。页面按需展示这些参数，不能用模型几何尺寸进行真实测量。

资料来源：

- [DJI 官方规格](https://www.dji.com/osmo-action-4/specs)
- [DJI 官方 FAQ](https://www.dji.com/osmo-action-4/faq)
- [DJI 官方用户手册 v1.2](https://dl.djicdn.com/downloads/DJI_Osmo_Action_4/UM/20230906/DJI_Osmo_Action_4_User_Manual_v1.2_en.pdf)，第 5 页为外观与部件说明。

**这是一份结构展示示意，不是维修指南或工程复刻。** 外观轮廓、圆角、材质和部件厚度经过简化；主板形状、芯片与走线分布、镜头内部、触点、紧固件、密封与磁吸机构没有实物拆解验证。按键组合成一个展示组，电池与电池仓盖也组合为一组。屏幕山景为程序生成的示例画面。装配位置、抽出路径及展开位置用于解释部件关系，不代表真实拆机顺序或机械公差。

## 接入下一款产品

产品入口位于 `src/products/registry.js`。新增产品模块并在注册表中提供 `name`、`create` 和 `sources`。工厂函数返回：

```js
{
  group, // THREE.Group，完整产品
  parts: [{
    id, name, enName, group, // 部件 THREE.Group
    assembled, // THREE.Vector3：组装位置
    extract,   // THREE.Vector3：第一段抽出位置，可选
    exploded,  // THREE.Vector3：完全展开位置
    description, category,
    kind,      // 'exterior' 或 'schematic'
    specs,     // [标签, 值] 的数组
  }],
  dispose, // 可选的资源释放函数
}
```

部件分组应挂在产品根组下，网格的 `userData.partId` 对应部件 `id`。有 `extract` 时，动画先抽出，再移动到展开位置。请为新产品检查路径、间距、相机取景和移动端性能。

注册表提供复用基础；接入新产品时仍需补充产品选择器选项、产品标题/说明/公开参数和相关界面内容。目前只包含 Action 4，不提供尚未实现的产品选项。

## 验收记录

2026-11-13 已在本机 Chrome 通过 `qa/acceptance.cjs` 和 `qa/edge-cases.cjs` 实际验收（桌面 1440×1000、手机模拟 390×844）：

- 页面加载正常，10 组部件与目录完整，没有运行时异常或资源加载错误。
- 鼠标拖动旋转、滚轮缩放、自动旋转、正反面切换正常。
- 一键全部展开、逐部件选择、模型点击与列表同步正常；复原后所有部件坐标归位。
- 滑杆原生键盘操作有效，资料与帮助弹窗正常。
- 手机模拟无横向溢出，单指旋转、双指缩放、部件选择正常；完整展开后各部件边界都在视野内。
- 对手机展开动画连续采样 133 帧，最大归一化视口边界为 0.961（1 为画面边缘），未飞出视野。
- 模拟 WebGL 不可用时显示明确提示，并结束加载状态。
- 最终 `dist/` 静态产物经独立加载与展开检查通过，仅打包 Three.js 必需模块。

截图与自动结果保存在本地 `qa/`（已从 Git 忽略）。测试脚本使用 Node 22+ 原生 WebSocket 与本机 Chrome DevTools Protocol，不引入应用测试依赖；测试服务器默认 `http://127.0.0.1:5174`，调试端口为 9222。正常开发仍使用 `npm start` 的 5173 端口。

`window.__structura.state()` 和 `window.__structura.bounds()` 是只读诊断接口，供验收读取动画状态、相机、部件位置与投影边界；不改变模型，也不收集用户信息。手机视口模拟不等同于真机测试，程序化模型也尚未与实物拆解逐件核验。
