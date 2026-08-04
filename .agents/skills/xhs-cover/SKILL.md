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
6. If the user only gives a topic, generate a four-panel preview first instead of a single cover. If the user asks for options, still render the four-panel preview as the first delivery.
7. In the preview, create four different complete 3:4 cover candidates in a 2x2 grid, each clearly numbered `1`, `2`, `3`, `4`. The 2x2 sheet is only a presentation container: every individual panel must retain an exact 3:4 aspect ratio and must not be cropped, stretched, or redesigned as a shorter thumbnail.
8. Keep the four candidates on the same topic, but vary:
   - headline expression
   - subject expression
   - composition
   - background atmosphere
   - color pairing
   so the options feel meaningfully different.
9. Keep the preview layout clean and close to the preferred single-cover style: big headline on top, fewer supporting words, stronger negative space, and less decorative clutter.
10. Treat headline typography as a first-pass deliverable. Every one of the four preview panels must already have a polished, thumbnail-readable title layout with deliberate hierarchy, spacing, line breaks, color pairing, and placement. Do not use the preview to postpone title design until the refinement pass.
11. Anchor the subject to the actual portrait inputs. Vary only expression, pose, outfit styling, and scene props as needed for the topic.
12. After the user picks a number, generate a single refined final cover based on that chosen direction.
13. Render at an exact 3:4 aspect ratio, then inspect the face against the canonical close-ups, plus the hands, title, clothing, and avoid-list items before delivering it.

## Rules

- Keep the canvas in vertical 3:4.
- For the preview grid, each panel must itself be a full 3:4 cover, not a cropped thumbnail.
- The preview title is part of the selection quality bar: all four panels must show finished, attractive title typography before the user chooses one.
- Use one dominant hook line, usually 4-10 Chinese characters, sometimes with `AI`, `Codex`, `Skill`, `Agent`, or a number.
- Make the headline thick, high-impact, high-contrast, and thumbnail-readable without relying on a black outline. Follow the owner typography rules in `references/style-rules.md`.
- Keep the composition busy but clear: one main subject, one core prop, one evidence layer, optional floating UI fragments.
- Prefer expressive, front-facing subjects and obvious hand gestures such as pointing, presenting, holding, or reacting.
- For mobile-first Xiaohongshu covers, default to a readable half-body or mid-torso subject placed to one side; do not make the person fill the whole canvas or reveal unnecessary body area. The title and topic evidence must remain visually dominant at thumbnail size.
- Use the owner's approved single-cover reference as the canonical subject scale: `/Users/sunjianwei/Desktop/call_99ceJMbZn4VDsb6vcYVm7G9n.png`. Match its visual relationship between title, comparison cards, and person: a larger readable half-body/mid-torso subject occupying roughly the right third to two-fifths of the canvas, with the upper torso and both expressive hands visible when the gesture is part of the concept. Keep a clear right-side breathing margin; the subject may be enlarged, but must not be clipped or pressed against the edge. Do not expose a full body or unnecessary skin.
- Use invented but believable devices, screens, apps, badges, labs, studios, or city/expo settings.
- The person must be the workspace owner, not merely a similar-looking young woman.
- Pass actual portrait files to the model. A textual description of the owner's face is never a substitute for image inputs.
- Keep facial proportions, eye spacing, brows, nose/mouth proportions, jawline, hairstyle, fringe, skin tone, and jewelry cues stable; adapt expression and styling around them.
- If the available generation route cannot accept portrait inputs, or the portrait-input request fails, stop and report the limitation. Never silently switch to text-only generation, a generic face, HTML/CSS compositing, or a pasted photo frame.
- Reject and retry any output that is not recognizably the same person. Do not describe an approximate or generic face as identity-preserved.
- When the user provides only a topic, do not stop at a prompt or brief: generate and deliver the four-panel preview first.
- Put a visible `1` `2` `3` `4` number on each preview panel so the user can pick quickly.
- In preview mode, prefer a cleaner single-cover look over a busy comparison board: fewer labels, less small text, and stronger top-title hierarchy.
- After the user picks a number, generate the refined single-cover final from that direction.
- Use only the owner's authorized portrait references for identity. Avoid unauthorized real people, celebrities, logos, brand marks, trademarked interfaces, or copyrighted characters.
- Avoid weak, vague, or generic cover language. Pick a clear promise.

## Output

For the first pass, deliver a generated 2x2 four-panel preview with four complete 3:4 cover options plus its saved path. For the second pass after user selection, deliver the refined single 3:4 cover that passes identity, title, clothing, hands, and layout checks, plus its saved path. If identity-capable generation is unavailable, deliver no substitute image; explain the blocker instead.
