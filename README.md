# 休息时刻

一个 macOS 菜单栏休息提醒 App，当前版本 **0.1.15**。可设置提醒时段、间隔和正文，内置同一只猫咪的六个透明动作。

本版恢复六动作的完整姿态序列，替换 0.1.14 幅度不足的单贴图网格动作：举爪从落地到脸旁、转头从正面到侧面、伸展从站立到下压再返回；卧着眯眼、歪头和坐着眨眼也使用完整序列。详见[本版联合检查](docs/sequence-review-20261102.md)。[0.1.14 幅度复查](docs/motion-amplitude-review-20261030.md)保留为历史记录。

## 当前行为

- 自动提醒、手动测试和“稍后”共用六动作轮换，重启后继续轮换。
- 后台只有一个待触发计时器；暂停取消计时，恢复后重新排定。
- “下一次提醒”显示后台真实时间。保存正文不重置间隔，修改时段或间隔才重新排定。
- “稍后（15分钟）”替换待触发时间，触发后恢复正常间隔；休眠后最多补发一次。
- 遵守提醒时段，支持跨夜。开始与结束相同表示全天；结束时间不包含在时段内。
- 猫咪与卡片为两个透明置顶窗口，垂直居中，可拖动任一窗口整体移动。
- 卡片234px宽，四角统一14px CSS圆角（内容缩放90%）。猫咪窗口183×199px，间隔13px，按可见轮廓对齐。
- 内置动作以30fps制作，使用完整RGBA帧的无损动画WebP；浏览器原生解码，无运行时变形、叠帧或逐帧整猫缩放。静止帧会合并保留时长。
- 不动区域锁定毛纹；眯眼时身体轮廓不变。伸展与歪头校正了原素材的头部尺寸漂移，保留姿态位移。
- 云朵Logo采用824px可见主体、1024px画布、透明留白与连续圆角，适配传统macOS ICNS。

手动测试不会改变自动提醒时间。本地设置保存在 Electron userData 目录，触发历史保留最近200条。

## 本地运行与验证

```bash
npm ci
npm test
npm run verify:animation
npm run build
npm run verify:build
npm run dev
```

网页预览为 `http://127.0.0.1:4173/`；桌面窗口、菜单栏和提醒计时用 `npm run desktop:dev`。

联合检查解码实际发货的六个WebP，检查静止像素、透明边界、绿色污染、首尾衔接、连续帧变化、眼睛闭合、举爪离地、头部转向、伸展位移和头部比例。可用 `SEQUENCE_REPORT=/path/report.json npm run verify:animation` 输出报告。完整动作的视觉审查仍必需；通过数字阈值不能单独证明自然度。

## 导出与重建动作

```bash
npm run export:gifs -- /path/to/output
```

六个透明GIF与App来自同一套帧和时序。GIF有256色及二值透明限制；App中的WebP保留完整颜色和半透明毛发边缘。GIF并不是另一套动作。离线序列构建、模型来源与逐帧导出检查见 [scripts/sequences](scripts/sequences/README.md)。正常运行和打包不需要下载模型。

## 打包

```bash
npm run desktop:build
```

输出到 `release/`。macOS ZIP使用 `ditto` 保留framework符号链接，并验证本地ad-hoc签名；尚未完成Apple公证。构建生成 `dist/pet-actions.json` 映射六个WebP，测试核对源文件哈希。

## 项目结构

- `src/SmoothPet.jsx`、`src/pet-sequence-assets.js`：原生序列播放、固定可见区域布局与旧内置资源URL兼容。
- `src/assets/nailao/sequences/`：生产WebP、同源GIF与哈希清单。
- `assets/sequence-keyframes/`、`scripts/sequences/`：不可变原始关键帧和离线构建。
- `scripts/inspect-pet-sequences.mjs`：六动作联合检查。
- `electron/main.cjs`、`electron/reminder-runtime.cjs`：窗口、提醒计时、轮换和持久化。
- `assets/RestMoment.png`、`assets/RestMoment.icns`：云朵图标。

旧rig、pet-motion代码和 `legacy:*` 命令保留作历史参考，不用于本版内置动作播放或导出。自定义图片仍沿用原有解码支持。
