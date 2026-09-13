const defaultModel = "gpt-image-2";
import sharp from "sharp";

const viewSpecs = [
  ["front", "正面视图", "front-facing, standing naturally and looking toward the camera"],
  ["left", "左侧视图", "full left-side profile, standing naturally"],
  ["right", "右侧视图", "full right-side profile, standing naturally"],
  ["calm", "安静姿态", "relaxed lying-down resting pose"],
  ["stretch", "动态姿态", "natural full-body stretching pose"],
];

const actionSpecs = [
  ["挥手提醒", "raising one front paw to get attention"],
  ["趴下休息", "lying down comfortably with the full body visible"],
  ["侧身看看", "turning its body sideways and looking back"],
  ["伸懒腰", "doing a long natural cat stretch"],
  ["安静陪伴", "sitting calmly and looking gently toward the viewer"],
  ["眨眼提示", "sitting and giving a gentle slow blink"],
];

function parseImageDataUrl(source) {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s.exec(source || "");
  if (!match) throw new Error("参考图不是有效的 JPG/PNG data URL");
  return { mimeType: match[1], bytes: Buffer.from(match[2], "base64") };
}

async function generateOne({ apiKey, model, prompt, references }) {
  const form = new FormData();
  form.set("model", model);
  form.set("prompt", prompt);
  form.set("size", "1024x1024");
  form.set("quality", "medium");
  form.set("output_format", "png");
  for (const [index, reference] of references.entries()) {
    const image = parseImageDataUrl(reference);
    const extension = image.mimeType.includes("jpeg") ? "jpg" : image.mimeType.split("/")[1] || "png";
    form.append("image[]", new Blob([image.bytes], { type: image.mimeType }), `reference-${index + 1}.${extension}`);
  }

  const response = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error?.message || `OpenAI Image API HTTP ${response.status}`);
  }

  const image = payload?.data?.[0]?.b64_json;
  if (!image) throw new Error("图像生成服务没有返回图片");
  return removeGreenBackground(`data:image/png;base64,${image}`);
}

async function removeGreenBackground(source) {
  const parsed = parseImageDataUrl(source);
  const { data, info } = await sharp(parsed.bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let index = 0; index < data.length; index += 4) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const greenDominance = green - Math.max(red, blue);
    const alpha = Math.max(0, Math.min(255, 255 - Math.max(0, greenDominance - 18) * 5));
    if (alpha < 255) {
      const keep = alpha / 255;
      data[index] = Math.round(red * keep);
      data[index + 1] = Math.round(Math.min(green, Math.max(red, blue) + 8) * keep);
      data[index + 2] = Math.round(blue * keep);
      data[index + 3] = Math.min(data[index + 3], alpha);
    }
  }
  const png = await sharp(data, { raw: info }).png().toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

export async function generatePetAssetsWithImage2({ photos, apiKey, model = defaultModel }) {
  const sources = Array.isArray(photos) ? photos.filter(Boolean).slice(0, 10) : [];
  if (!apiKey) throw new Error("缺少 OpenAI API Key");
  if (!sources.length) throw new Error("请至少上传 1 张参考图");

  const identityRules = [
    "All attached photos show the same real pet cat and are identity references, not output candidates.",
    "Study all references together and preserve this exact cat's face shape, eye color, ear shape, fur color, unique markings, body proportions, paws and tail.",
    "Gently clean visible eye discharge/crust from the inner and outer corners of both eyes. Keep the natural eye shape, eyelids, catchlights and surrounding fur; do not apply beauty-filter smoothing or change identity.",
    "Create a completely new photorealistic full-body image. Do not copy, crop, cut out, mirror, rotate, warp or reuse any source photo.",
    "No props, no cup, no clothing, no text, no frame, no floor and no scenery.",
    "Place the isolated cat on a perfectly flat solid #00ff00 chroma-key background with no shadow, gradient, texture, floor, scenery or reflection. Do not use #00ff00 anywhere on the cat. Center the whole body with generous padding.",
  ].join(" ");

  const views = [];
  for (const [key, label, pose] of viewSpecs) {
    const src = await generateOne({
      apiKey,
      model,
      references: sources,
      prompt: `${identityRules} Required view: ${pose}.`,
    });
    views.push({ key, label, src, note: "由全部参考图共同生成" });
  }

  const generatedViewSources = views.map((view) => view.src);
  const actionRules = [
    "The attached images are five newly generated identity views of the same real cat.",
    "Use them together to keep exactly the same cat identity, facial features, fur markings, colors, body proportions and tail.",
    "For every generated cat, gently clean visible eye discharge/crust from both eye corners while preserving natural eyes, eyelids and fur detail; no over-retouching.",
    "Generate a completely new photorealistic full-body pose. Do not return or directly transform an attached image.",
    "No props, no cup, no clothing, no text, no frame, no floor and no scenery.",
    "Place the isolated cat on a perfectly flat solid #00ff00 chroma-key background with no shadow, gradient, texture, floor, scenery or reflection. Do not use #00ff00 anywhere on the cat. Center the whole body with generous padding for a macOS desktop pet sprite.",
  ].join(" ");

  const variants = [];
  for (const [label, pose] of actionSpecs) {
    const src = await generateOne({
      apiKey,
      model,
      references: generatedViewSources,
      prompt: `${actionRules} Required action: ${pose}.`,
    });
    variants.push({ label, src });
  }

  return {
    ok: true,
    provider: model,
    providerLabel: `OpenAI ${model}`,
    imageModel: model,
    profile: { references: sources.length, generator: `OpenAI ${model}`, views },
    views,
    variants,
    primarySticker: variants[0]?.src || views[0]?.src || null,
  };
}

export function getImage2DefaultModel() {
  return defaultModel;
}
