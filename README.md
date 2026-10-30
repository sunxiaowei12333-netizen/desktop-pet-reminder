# 休息时刻

一个 macOS 菜单栏休息提醒 App，当前版本为 **0.1.14**。内置同一只猫咪的六个透明动作，可设置提醒时段、间隔和正文。

0.1.14将六动作改为固定贴图与受控网格动画。联合检查覆盖每个动作完整循环的288个时刻、循环接缝、纹理连续性、网格折叠、尺寸、透明边缘及六播放器并行性能。详见 [本版检查记录](docs/fixed-rig-review-20261030.md)；[0.1.13未通过的历史检查](docs/animation-review-20261030.md)保留用于追踪原因。

## 当前行为

- 自动提醒、手动测试和“稍后”共用六动作轮换，重启后继续轮换。
- 后台仅有一个待触发计时器；暂停会真正取消计时，恢复后重新排定。
- “下一次提醒”显示后台真实时间；保存正文不会重置间隔，修改时段或间隔才重新排定。
- “稍后（15分钟）”替换当前待触发时间，触发后恢复设置的正常间隔。
- 遵守提醒时段，支持跨夜；休眠后最多补发一次，避免集中弹出。
- 猫咪与卡片分为两个透明置顶窗口，可拖动任一窗口整体移动，垂直居中并限制在屏幕内。
- 卡片234px宽、四角统一为14px CSS圆角（随90%内容缩放）；背景与窗口等宽，避免右侧圆角被裁切。猫咪窗口183×199px，与卡片间隔13px，按可见轮廓对齐。
- 六个动作每轮4.8秒，每个动作只使用一张固定透明猫咪贴图。眯眼、挥爪、歪头、侧头和伸展由连续网格控制，毛纹随同一块表面移动，不切换生成姿态、不混合两只爪子，也不对整只猫逐帧缩放。
- 动作是小幅度的二维活动：挥爪从已举起的前爪开始，伸展从伸展姿态开始；不包含站起、趴下或大幅三维转身。
- App随显示器刷新率连续绘制；隐藏或离屏暂停。无WebGL时播放同一套动作导出的GIF。
- GIF从生产渲染器以25fps取样，4.8秒/120个时间点；相同静止帧可能合并，时长不变。固定调色板、关闭抖色、每帧清除，避免GIF自身产生杂点和拖影。
- App 使用云朵 Logo；macOS 15 的传统 ICNS 已包含连续圆角与透明留白，1024px画布内可见主体为824px。本地状态保存在 Electron 的 userData 目录，触发历史保留最近200条。

手动测试不会改变自动提醒时间。“开始时间”与“结束时间”相同表示全天；结束时间不包含在提醒时段内。

## 本地运行与验证

```bash
npm ci
npm test
npm run build
npm run verify:build
npm run verify:animation
npm run dev
```

网页预览为 `http://127.0.0.1:4173/`；桌面窗口、菜单栏和提醒计时用 `npm run desktop:dev`。

联合检查需要Playwright和Chrome，可用 `PLAYWRIGHT_MODULE`、`CHROME_PATH` 指定路径，`RIG_OUTPUT` 指定报告目录。输出 `joint-audit.json` 和六张完整循环对照图。自动检查不能替代完整动作的视觉审查，尤其是动作自然度；合格报告必须与实际版本对应。

## 导出与重建动作

```bash
npm run export:gifs -- /path/to/output
```

直接复制内置六个透明GIF，它们与App使用同一套固定贴图和动作曲线；GIF为25fps且只有256色，App为连续刷新率、完整颜色。白底MP4更适合发布。

修改 `src/pet-rig.js` 后，用同一生产渲染器重新导出：

```bash
RIG_OUTPUT=/path/to/review npm run build:pet-rig
python3 -m pip install -r scripts/requirements-assets.txt
python3 scripts/export-pet-rig.py /path/to/review/frames /path/to/output --update-assets
npm test
npm run build
npm run verify:build
RIG_OUTPUT=/path/to/review npm run verify:animation
```

第一次导出时，如果旧GIF与新动作周期不一致，联合检查会在写完帧图后对回退项报错；完成编码后必须重新运行全部检查。导出脚本会回读所有GIF时间点，对照渲染帧验证透明轮廓完全一致，并检查调色板误差。MP4编码使用macOS AVFoundation。

`src/assets/nailao/rig/manifest.json` 记录固定贴图与GIF的SHA-256、原始姿态来源、周期与导出帧率。不要重新从导出的GIF提取固定贴图。

## 打包与图标

```bash
npm run build:icon
npm run desktop:build
```

输出在 `release/`。macOS打包使用 `ditto` 保留framework符号链接，并验证本地ad-hoc签名；尚未完成Apple公证。
构建生成 `dist/pet-actions.json` 和 `dist/pet-rig.json`，分别映射GIF与固定贴图，测试核对源文件哈希。

## 项目结构

- `src/SmoothPet.jsx`、`src/pet-animation.js`：生命周期、可见区域对齐和自定义GIF回退。
- `src/pet-rig.js`、`src/pet-rig-renderer.js`：固定材质网格、动作曲线与单纹理WebGL绘制。
- `src/assets/nailao/rig/`：六张固定透明贴图与来源清单。
- `scripts/verify-pet-rig.cjs`、`scripts/export-pet-rig.py`：联合检查与同源导出。
- `electron/main.cjs`、`electron/reminder-runtime.cjs`：窗口、提醒计时、动作轮换与持久化。
- `assets/RestMoment.png`、`assets/RestMoment.icns`：云朵图标及macOS尺寸/圆角。

旧 `pet-motion-*` 源码、位移图、`assets/pet-motion-v2` 和 `legacy:*` 命令仅保留作历史参考，当前App不打包、不调用光流渲染器。旧生成流程会覆盖当前GIF，请勿用于本版构建。
