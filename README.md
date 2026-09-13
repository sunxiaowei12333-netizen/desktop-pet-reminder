# 休息时刻

一个 macOS 菜单栏桌面宠物提醒工具。用户可以设置休息提醒、上传最多 10 张宠物参考照，并通过本地免费生成引擎生成桌面小宠物素材。

## 当前能力

- macOS 菜单栏入口：点击顶部图标打开小设置窗。
- 提醒设置：提醒间隔、休息时长、提醒正文。
- 桌面宠物提醒：透明置顶窗口、小猫 + 气泡，支持“已完成”和“稍后”。
- 形象设置：上传最多 10 张参考照片。
- 生成架构：启动时自动尝试拉起本地 ComfyUI / 自定义本地生成服务，不把 API key 暴露到前端。

## 本地运行

```bash
npm install
npm run dev
```

打开：

```text
http://127.0.0.1:4173/
```

运行桌面开发版：

```bash
npm run desktop:dev
```

## 打包 macOS App

```bash
npm run desktop:build
```

输出目录：

```text
release/
```

## 本地免费生成引擎

这个项目不会在前端假装生成猫咪动作。真正的流程是：

```text
10 张参考照
→ GPT Image 2 综合 1-10 张照片生成同一只猫的 5 张全新视图
→ GPT Image 2 基于五视图再次生成 6 个动作
→ 输出透明 PNG
→ App 保存并用于桌面提醒
```

默认会自动尝试连接并拉起本机 ComfyUI：

```text
http://127.0.0.1:8188
```

也可以自己提供一个本地 HTTP 生成服务：

```bash
PET_GENERATION_ENDPOINT_URL=http://127.0.0.1:8787/generate npm run desktop:dev
```

生成服务的输入/输出协议见：

- [docs/local-generation-engine.md](./docs/local-generation-engine.md)
- [docs/pet-generation-pipeline.md](./docs/pet-generation-pipeline.md)

## 为什么不用固定云模型？

为了方便公开到 GitHub，让更多人能自己跑，这里优先支持本地免费工作流。云端模型可以后续作为 Provider 插件接入，但不应该是默认依赖。

推荐方向：

- OpenAI GPT Image 2 `/v1/images/edits` 工作流
- 第二阶段 GPT Image 2 动作工作流（只接收第一阶段生成的五视图）
- IP-Adapter / Redux / LoRA 作为身份一致性辅助
- rembg / RMBG 做透明背景输出

## 项目结构

- [src/main.jsx](./src/main.jsx)：React 设置页、提醒预览、生成状态 UI。
- [electron/main.cjs](./electron/main.cjs)：macOS 桌面壳、Tray、透明宠物窗口、本地生成服务桥接。
- [electron/preload.cjs](./electron/preload.cjs)：安全暴露桌面端 API。
- [docs/](./docs)：生成管线和本地引擎协议。
