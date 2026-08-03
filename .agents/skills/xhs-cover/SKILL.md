---
name: xhs-cover
description: Generate sample-matched 3:4 Xiaohongshu cover images from a single video topic with bold Chinese hooks, expressive subjects, concrete scene evidence, and identity-preserving portrait references. Use when the user asks for a 小红书封面, 爆款封面, 标题大字报, or “小红书封面 skill”, while avoiding direct copying of people, brands, logos, or copyrighted elements.
---

# 小红书封面 skill

## Overview

Use this skill to turn one video topic into a 3:4 cover that feels like the sample set: bold Chinese hook text, strong human reaction, clear scene evidence, and dense layered composition.
When the user provides portrait references, treat them as the fixed on-screen identity and preserve the same face shape, hair silhouette, bangs, skin tone, and signature accessories across covers.
Use the built-in ImageGen workflow to render the final bitmap. Keep personal portrait references out of the skill package and out of Git repositories.

## Workflow

1. Read `references/style-rules.md` first.
2. From the topic, infer audience, promise, conflict, and the most legible scene.
3. Choose one cover archetype:
   - result-first
   - tutorial or steps
   - comparison or review
   - wow or reaction
4. Write one final image brief with:
   - main headline
   - subheadline or badge
   - subject
   - environment
   - prop or screen details
   - color and lighting
   - negative prompt
5. If the user only gives a topic, generate the cover directly in this style. If the user asks for options, provide 2-3 directions first, then render the strongest one.
6. If the user provides portrait references, anchor the subject to those images and vary only expression, pose, outfit styling, and scene props as needed for the topic.
7. Render the final image with ImageGen at an exact 3:4 aspect ratio. Use the supplied portrait references as identity inputs when available, then inspect the face, hands, title, and avoid-list items before delivering it.

## Rules

- Keep the canvas in vertical 3:4.
- Use one dominant hook line, usually 4-10 Chinese characters, sometimes with `AI`, `Codex`, `Skill`, `Agent`, or a number.
- Make the headline thick, high-contrast, and thumbnail-readable.
- Keep the composition busy but clear: one main subject, one core prop, one evidence layer, optional floating UI fragments.
- Prefer expressive, front-facing subjects and obvious hand gestures such as pointing, presenting, holding, or reacting.
- Use invented but believable devices, screens, apps, badges, labs, studios, or city/expo settings.
- For identity-preserve requests, match the user's face from the reference images instead of inventing a new model.
- Keep facial proportions, hairstyle, fringe, and jewelry cues stable; adapt expression and styling around them.
- When the user provides only a topic, do not stop at a prompt or brief: generate and deliver the cover image.
- Avoid copying real people, logos, brand marks, trademarked interfaces, or copyrighted characters.
- Avoid weak, vague, or generic cover language. Pick a clear promise.

## Output

Deliver the generated 3:4 cover image and its saved path. Include the final headline and a one-sentence art direction when useful; only expose the full generation prompt when the user asks for it.
