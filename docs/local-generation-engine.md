# 本地免费生成引擎协议

`休息时刻` 默认不绑定任何付费生图 API。桌面端会先自动尝试拉起本地生成服务，再通过 Electron 主进程调用它，避免把用户照片和密钥暴露给前端。

当前内置适配器使用 OpenAI GPT Image 2 的 `/v1/images/edits` 接口。在设置页填入 OpenAI API Key 即可调用；Key 只在本次运行中传给桌面端主进程，不写入 GitHub，也不会持久化到浏览器 localStorage。

## 推荐架构

```text
Electron App
  ↓ photos + prompt plan
Local Generation Endpoint
  ↓
GPT Image 2 image-edit identity workflow
  ↓
GPT Image 2 image-edit action workflow
  ↓
Rembg / RMBG transparent PNG post-process
  ↓
5 views + 6 action sprites
```

## 方式一：自定义本地 HTTP 服务

启动 App 时传入（也可以直接在设置页填写 API Key）：

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
    "provider": "gpt-image-2",
    "modelFamily": "OpenAI GPT Image 2 image editing",
    "referenceCount": 10,
    "outputContract": {
      "views": 5,
      "actions": 6,
      "format": "transparent PNG data URL or file URL"
    },
    "stages": [
      {
        "id": "gpt-image-2-identity-views",
        "type": "image-edit",
        "input": "all-reference-photos",
        "output": "five new transparent-background views of the same real cat",
        "prompt": "Use all uploaded photos as identity references for the same real cat. Generate five new transparent-background views..."
      },
      {
        "id": "gpt-image-2-action-set",
        "type": "image-edit",
        "input": "generated-five-view-renders",
        "output": "six transparent-background desktop pet action sprites",
        "prompt": "Use the generated five-view identity images as references and create six distinct transparent-background realistic desktop pet actions..."
      }
    ],
    "constraints": [
      "must-return-five-new-views",
      "must-return-six-new-actions",
      "no-source-photo-as-final-output",
      "transparent-png-output"
    ]
  }
}
```

### 响应格式

服务必须返回 5 个全新视图和 6 个全新动作。缺少任一组结果时，App 会拒绝结果，不会把原图抠图当作动作素材：

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

当前 App 会优先调用 GPT Image 2 适配器；如果未填 API Key，才回退到检查 ComfyUI / 自定义端点。GPT Image 2 不支持 `background: transparent`，所以适配器要求模型返回纯绿幕图，再由本地后处理转成透明 PNG。

建议工作流：

1. 参考图输入：1-10 张猫咪照片，全部送入同一个任务。
2. GPT Image 2：将 1-10 张照片作为身份参考，生成 5 张全新的绿幕五视图，再由本地后处理转透明。
3. GPT Image 2：将这 5 张新视图作为第二阶段参考，生成 6 个不同动作；不能回到原图做抠图、镜像或仿射变形。
4. 后处理：rembg / RMBG 输出透明 PNG。
5. 返回：5 个 views + 6 个 variants。

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
