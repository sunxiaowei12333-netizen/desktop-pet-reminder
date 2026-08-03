# 本地免费生成引擎协议

`休息时刻` 默认不绑定任何付费生图 API。桌面端会先自动尝试拉起本地生成服务，再通过 Electron 主进程调用它，避免把用户照片和密钥暴露给前端。

## 推荐架构

```text
Electron App
  ↓ photos + prompt plan
Local Generation Endpoint
  ↓
ComfyUI / FLUX / SDXL workflow
  ↓
Rembg / RMBG transparent PNG post-process
  ↓
5 views + 6 action sprites
```

## 方式一：自定义本地 HTTP 服务

启动 App 时传入：

```bash
PET_GENERATION_ENDPOINT_URL=http://127.0.0.1:8787/generate npm run desktop:dev
```

如果服务需要 token：

```bash
PET_GENERATION_ENDPOINT_TOKEN=your-local-token \
PET_GENERATION_ENDPOINT_URL=http://127.0.0.1:8787/generate \
npm run desktop:dev
```

### 请求格式

App 会发送：

```json
{
  "photos": [
    "data:image/png;base64,..."
  ],
  "plan": {
    "provider": "local-comfyui",
    "modelFamily": "FLUX / SDXL reference-image workflow",
    "referenceCount": 10,
    "outputContract": {
      "views": 5,
      "actions": 6,
      "format": "transparent PNG data URL or file URL"
    },
    "stages": [
      {
        "id": "identity-five-view",
        "output": "five transparent-background views of the same real pet cat",
        "prompt": "Use all uploaded reference photos to infer one consistent real cat identity..."
      },
      {
        "id": "action-set",
        "output": "six transparent-background desktop pet action sprites",
        "prompt": "Based on the generated five-view identity sheet..."
      }
    ]
  }
}
```

### 响应格式

服务必须返回 5 个视图和 6 个动作：

```json
{
  "provider": "local-comfyui",
  "providerLabel": "ComfyUI + FLUX",
  "profile": {
    "dominantColor": "#d8b48a",
    "bodyType": "比例均衡",
    "notes": "white-orange tabby cat, round face, amber eyes"
  },
  "views": [
    {
      "key": "front",
      "label": "正面视图",
      "src": "data:image/png;base64,..."
    },
    {
      "key": "left",
      "label": "左侧视图",
      "src": "data:image/png;base64,..."
    },
    {
      "key": "right",
      "label": "右侧视图",
      "src": "data:image/png;base64,..."
    },
    {
      "key": "calm",
      "label": "安静姿态",
      "src": "data:image/png;base64,..."
    },
    {
      "key": "stretch",
      "label": "动态姿态",
      "src": "data:image/png;base64,..."
    }
  ],
  "variants": [
    {
      "label": "挥手提醒",
      "src": "data:image/png;base64,..."
    },
    {
      "label": "趴下休息",
      "src": "data:image/png;base64,..."
    },
    {
      "label": "侧身看看",
      "src": "data:image/png;base64,..."
    },
    {
      "label": "伸懒腰",
      "src": "data:image/png;base64,..."
    },
    {
      "label": "安静陪伴",
      "src": "data:image/png;base64,..."
    },
    {
      "label": "眨眼提示",
      "src": "data:image/png;base64,..."
    }
  ],
  "primarySticker": "data:image/png;base64,..."
}
```

`src` 也可以是本地可访问的 `file://` 或 `http://127.0.0.1` URL，但打包分发时最稳的是 `data:image/png;base64,...`。

## 方式二：直接接本机 ComfyUI

默认地址：

```text
http://127.0.0.1:8188
```

当前 App 会自动检查并尝试启动 ComfyUI；真正执行工作流需要补一个适配层，把 ComfyUI 工作流的输出整理成上面的响应格式。

建议工作流：

1. 参考图输入：1-10 张猫咪照片。
2. 身份一致性：FLUX / SDXL + IP-Adapter / Redux / LoRA。
3. 阶段一：生成同一只猫的五视图。
4. 阶段二：基于五视图生成六个动作。
5. 后处理：rembg / RMBG 输出透明 PNG。
6. 返回：5 个 view + 6 个 variants。

## 透明背景说明

大多数生成模型不稳定支持 alpha 通道。推荐策略是：

- 生成时使用干净浅色背景或纯色背景；
- 本地后处理用 rembg / RMBG 抠出透明背景；
- 最终传给 App 的必须是透明 PNG。

## GitHub 分发原则

- 不提交用户照片。
- 不提交任何 API key。
- 不默认依赖付费云服务。
- 默认提示用户启动/配置本地生成服务。
