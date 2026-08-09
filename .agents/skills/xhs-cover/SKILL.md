---
name: xhs-cover
description: Generate personalized 3:4 Xiaohongshu cover images with bold Chinese hooks, expressive subjects, concrete scene evidence, and a mandatory owner-identity lock whenever a woman or host appears. Use when the user asks for a 小红书封面, 爆款封面, 标题大字报, or “小红书封面 skill”, including from-scratch generation that must still use the owner's portrait references.
---

# 小红书封面 skill

## Overview

Use this skill to turn one video topic into a 3:4 cover that feels like the sample set: bold Chinese hook text, strong human reaction, clear scene evidence, and dense layered composition.
Treat the workspace owner's portrait references as the fixed on-screen identity whenever a woman or host appears. “From scratch” means generating a new poster composition; it does not remove the portrait-reference requirement.
Use the built-in ImageGen workflow to render the final bitmap. Keep personal portrait references out of the skill package and out of Git repositories.

## Workflow

1. Read `references/style-rules.md` first.
2. If the cover includes a woman or host, read `references/owner-identity.md`, verify its local portrait files exist, and load the selected files as actual image inputs to an identity-capable generation or edit tool.
3. From the topic, infer audience, promise, conflict, and the most legible scene.
4. Choose one cover archetype:
   - result-first
   - tutorial or steps
   - comparison or review
   - wow or reaction
5. Write one final image brief for the preview set with:
   - main headline
   - subheadline or badge
   - subject
   - environment
   - prop or screen details
   - color and lighting
   - negative prompt
6. If the user only gives a topic, generate four separate preview covers first instead of a single cover. If the user asks for options, still render the four separate covers as the first delivery.
7. Generate four separate exact 3:4 cover files, verify each file's dimensions, and deliver the four images individually in order. Do not add numbers to the artwork and do not force them into a collage unless the user explicitly asks for a 2x2 sheet.
8. Keep the four candidates on the same topic, but make them visibly different creative directions, not four near-identical templates. Vary:
   - headline expression
   - subject expression
   - composition
   - background atmosphere
   - color pairing
   so the options feel meaningfully different.
9. Keep the preview layout clean and close to the preferred single-cover style: big headline on top, fewer supporting words, stronger negative space, and less decorative clutter.
10. Treat headline typography as a first-pass deliverable. Every one of the four preview panels must already have a polished, thumbnail-readable title layout with deliberate hierarchy, spacing, line breaks, color pairing, and placement. Do not use the preview to postpone title design until the refinement pass.
11. Anchor the subject to the actual portrait inputs. In preview mode, vary only the allowed creative controls: headline expression, facial expression, face angle, subject placement/composition, gesture when needed, scene props, and background atmosphere. Use clearly different emotions such as surprise, concentration, delight, or confident explanation; do not repeat the same facial expression and angle in all four panels.
12. Keep preview candidates as directional drafts: they need a convincing title, clear subject, and readable topic evidence, but they do not need the full density, micro-details, or final polish required of the selected single cover.
13. After the user picks a number, generate a single refined final cover based on that chosen direction, adding the full background richness, detailed evidence layer, and final polish then.
14. Render at an exact 3:4 aspect ratio, then inspect the face against the canonical close-ups, plus the hands, title, clothing, and avoid-list items before delivering it.

## Rules

- Keep the canvas in vertical 3:4.
- Every preview deliverable must be a separately generated and dimension-verified full 3:4 cover, never a cropped or stretched thumbnail. If a 2x2 sheet is explicitly requested later, assemble the four verified files mechanically; never rely on a single collage-generation prompt to preserve panel ratios.
- The preview title is part of the selection quality bar: all four panels must show finished, attractive title typography before the user chooses one.
- Use one dominant hook line, usually 4-10 Chinese characters, sometimes with `AI`, `Codex`, `Skill`, `Agent`, or a number.
- Make the headline thick, high-impact, high-contrast, and thumbnail-readable without relying on a black outline. Follow the owner typography rules in `references/style-rules.md`.
- Keep the composition busy but clear: one main subject, one core prop, one evidence layer, optional floating UI fragments.
- Prefer expressive, front-facing subjects and obvious hand gestures such as pointing, presenting, holding, or reacting.
- For mobile-first Xiaohongshu covers, the subject must be a half-body or mid-torso crop ending at the waist; never show hips, thighs, legs, a full body, or unnecessary lower-body area. The waist must be fully covered with no exposed midriff or side-waist skin. Keep the title and topic evidence visually dominant at thumbnail size. Subject size is flexible rather than a rigid percentage.
- Use the owner's approved single-cover reference `/Users/sunjianwei/Desktop/call_99ceJMbZn4VDsb6vcYVm7G9n.png` as a loose visual guide for balance, not a fixed size formula. Keep a readable half-body/mid-torso crop ending around the waist, fully cover the waist with clothing, and leave breathing room around the subject. The subject may be smaller or larger depending on the title and evidence layout, but must not be clipped, pressed against the edge, or expose the midriff.
- Use invented but believable devices, screens, apps, badges, labs, studios, or city/expo settings.
- Lock the owner's wardrobe in every preview and final cover: use the same blue fitted denim short-sleeve collared dress/set from the supplied outfit references. Do not change garment type, sleeve length, color, fabric, neckline, or waist coverage.
- Lock headline colors to clean white and bright yellow. Do not substitute red, green, purple, cyan, or other colors for headline text. Background colors may vary.
- The person must be the workspace owner, not merely a similar-looking young woman.
- Pass actual portrait files to the model. A textual description of the owner's face is never a substitute for image inputs.
- Keep facial proportions, eye spacing, brows, nose/mouth proportions, jawline, hairstyle, fringe, skin tone, and jewelry cues stable; adapt expression and styling around them.
- Render the face with a clean, high-quality portrait finish: natural even skin texture, subtle pores, no visible grain, speckling, compression noise, or synthetic roughness. Do not over-smooth into plastic skin.
- If the available generation route cannot accept portrait inputs, or the portrait-input request fails, stop and report the limitation. Never silently switch to text-only generation, a generic face, HTML/CSS compositing, or a pasted photo frame.
- Reject and retry any output that is not recognizably the same person. Do not describe an approximate or generic face as identity-preserved.
- When the user provides only a topic, do not stop at a prompt or brief: generate and deliver the four-panel preview first.
- Deliver the four preview files in a clear ordered sequence so the user can choose by position; do not add visible numbers unless requested.
- In preview mode, prefer a cleaner single-cover look over a busy comparison board: fewer labels, less small text, and stronger top-title hierarchy.
- Preview mode is for comparing directions, not final production detail. Prioritize distinct creative choices and legibility over dense micro UI or fully finished background rendering.
- After the user picks a number, generate the refined single-cover final from that direction.
- Use only the owner's authorized portrait references for identity. Avoid unauthorized real people, celebrities, logos, brand marks, trademarked interfaces, or copyrighted characters.
- Avoid weak, vague, or generic cover language. Pick a clear promise.

## Output

For the first pass, deliver four separate complete 3:4 cover options plus their saved paths. For the second pass after user selection, deliver the refined single 3:4 cover that passes identity, title, clothing, hands, and layout checks, plus its saved path. If identity-capable generation is unavailable, deliver no substitute image; explain the blocker instead.
