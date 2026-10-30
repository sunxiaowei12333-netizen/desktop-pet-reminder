# 休息时刻

一个 macOS 菜单栏休息提醒 App，当前版本为 **0.1.9**。内置同一只猫咪的六个透明动作，可设置提醒时段、间隔和正文。

## 当前行为

- 自动提醒、手动测试和“稍后”共用六动作轮换，重启后继续轮换。
- 后台仅有一个待触发计时器；暂停会真正取消计时，恢复后重新排定。
- “下一次提醒”显示后台真实时间；保存正文不会重置间隔，修改时段或间隔才重新排定。
- “稍后（15分钟）”替换当前待触发时间，触发后恢复设置的正常间隔。
- 遵守提醒时段，支持跨夜；休眠后最多补发一次，避免集中弹出。
- 猫咪与卡片分为两个透明置顶窗口，可拖动任一窗口整体移动，垂直居中并限制在屏幕内。
- 卡片234px宽、四角统一为14px CSS圆角（随90%内容缩放）；背景与窗口等宽，避免右侧圆角被裁切。猫咪窗口183×199px，与卡片间隔13px，按可见轮廓对齐。
- 六个动作均使用重制的16帧透明 GIF，完整循环3.2秒。播放器与导出直接读取同一份 GIF，不叠加前后帧，不做光流混合，也不单独裁切趴下动作。
- 素材从真实 Alpha 帧图提取完整主体，不用绿幕抠图；六动作共用同一构建规则，保留至少24px透明安全边距，每个动作使用固定全局调色板。
- App 使用云朵 Logo；macOS 15 的传统 ICNS 已包含连续圆角与透明留白，1024px画布内可见主体为824px。本地状态保存在 Electron 的 userData 目录，触发历史保留最近200条。

手动测试不会改变自动提醒时间。“开始时间”与“结束时间”相同表示全天；结束时间不包含在提醒时段内。

## 本地运行与验证

```bash
npm ci
npm test
npm run build
npm run verify:build
npm run dev
```

网页预览地址为 `http://127.0.0.1:4173/`。后台计时、系统置顶和菜单栏入口由桌面端提供：

```bash
npm run desktop:dev
```

当前界面使用内置猫咪素材；仓库仍保留可选的图像服务桥接与开发文档，运行提醒功能不需要API Key。

## 打包 macOS App

```bash
npm run desktop:build
```

输出位于 `release/`。打包会验证本地 ad-hoc 签名，并通过 macOS `ditto` 保留 framework 符号链接；不要将这些链接展开为重复目录。构建为本地签名，尚未完成 Apple 公证。

构建时生成的 `dist/pet-actions.json` 将六个动作映射到本次构建的资源文件名，避免重新构建后因哈希变化而找不到动作。

## 导出六个透明 GIF

```bash
npm run export:gifs
# 也可指定输出目录
npm run export:gifs -- /path/to/output
```

默认输出到 `release/pet-gifs/`，包括挥手提醒、趴下休息、侧身看看、伸懒腰、安静陪伴、眨眼提示。

## 维护素材与图标

原始透明帧图保存在 `assets/pet-motion-v2/`。构建时按 Alpha 连通主体提取16只猫，避免生成帧越过网格边界时被固定切格误裁；发现主体触及整张帧图外缘会报错，必须修复源图。

```bash
python3 -m pip install -r scripts/requirements-assets.txt
npm run build:pet-assets
npm run build:icon # macOS，使用系统 iconutil
npm test
```

`assets/pet-motion-v2/validation.json` 记录帧数、循环时长、逐帧边界、绿色杂色检查和最终 GIF 的 SHA-256。自动检查不代替动作连贯性与完整解剖轮廓的人工视觉检查。

## 项目结构

- `src/main.jsx`：设置界面、素材预览。
- `src/PetOverlay.jsx`：分离的提醒卡片和猫咪视图。
- `src/SmoothPet.jsx`、`src/pet-animation.js`：透明原始帧播放和可见区域对齐。
- `electron/main.cjs`：原生窗口、IPC、菜单栏和构建资源解析。
- `electron/reminder-runtime.cjs`：动作轮换、计时、暂停、稍后、持久化和触发历史。
- `assets/logo.png`、`assets/RestMoment.png`、`assets/RestMoment.icns`：云朵原图、带透明留白的图标与macOS图标。
- `assets/pet-motion-v2/`：六个重制动作的透明帧图与构建验证记录。
- `tests/`：计时、动作轮换、窗口同步、透明帧清除和macOS归档回归验证。
- `docs/`：可选的图像生成服务协议。
