# Plan — generalize the pattern-transform tool to any control point

Branch: `sympix-orbifold2`. Status of the precursor (per-image boundary
display) below, then the plan for the interactive tool.

---

## Done so far — per-image texture boundaries (read-only)

When the **pattern transform** tool is active you now see, in addition to the
solid global pattern box + corner handles + pivot:

- one **dashed orange box** per image in the pattern, drawn at
  `center + scale·R(angle)·u`, `u ∈ [±1,±1]` (buffer/pattern space), then
  through the global pattern transform, then to screen — with a dot at the
  image's centre.

Wiring (all additive, backward-compatible):

| file | change |
|---|---|
| `apps/sympix/js/PatternImage.js` | `+ getTransform()` → `{centerX,centerY,scale,angle}` live from config |
| `apps/sympix/js/PatternImageArray.js` | `+ getImageBoxes()` → one descriptor per child |
| `lib/symhublib/PatternTransformRenderer.js` | `+ params.getExtraBoxes` optional; `+ drawImageBox()`; draws the secondary boxes |
| `lib/symhublib/SymRenderer.js` | passes `getExtraBoxes: () => mPattern.getImageBoxes?.()` into the renderer |

If a pattern has no `getImageBoxes` (every non-array app) `getExtraBoxes`
returns `null` and nothing extra is drawn — zero behaviour change elsewhere.

Known limitation: boxes are drawn for **all** images in the array, not
filtered to the visualization layer's `imageId` set. Step E below fixes that.

---

## Goal

One interactive tool that hit-tests across a **set of transform targets** —
the global pattern box **plus** every shown image box — and manipulates
whichever control point the pointer grabbed:

- **corner** → rotate + scale
- **body / edge** → translate
- **pivot** (pattern target only, or a tool-local pivot) → move pivot

## Current shape (what we're generalizing)

- `PatternTransformHandler` is bound to exactly one `mConfig`
  `{centerX,centerY,scale,angle,pivotX,pivotY}`. Hit-tests: pivot (12 px), 4
  corners (12 px → `rotateScale`), inside-box → `translate`; Ctrl+click sets
  pivot. `applyRotationAndScale` / `applyTranslation` mutate `mConfig` then
  call `mOnChanged()`.
- `PatternTransformRenderer` draws one box from the same `mConfig` (now also
  the read-only secondary boxes).
- `SymRenderer.setTool(TOOL_PATTERN_TRANSFORM)` builds one handler + one
  renderer against `mConfig.patternTransConfig`; `activeTool` renders in the
  overlay pass, `mActiveTools = [handler, navigator]` gets pointer events.

## Design — a TransformTarget list

### 1. Target descriptor (uniform interface)

```
{
  id,            // 'pattern' | image id
  kind,          // 'pattern' | 'image'
  hasPivot,      // pattern: true;  image: false (rotate/scale about centre)
  getConfig(),   // -> {centerX,centerY,scale,angle,pivotX?,pivotY?}
  setConfig(partial),          // write back (mutates patternTransConfig / PatternImage config)
  localToWorld(patternPt),     // this box's local space -> world
  worldToLocal(worldPt),       // inverse
}
```

- **pattern target**: `localToWorld` = today's `patternToWorld(patternTransConfig)`.
- **image target**: `localToWorld = globalPatternToWorld( imgToBuffer(p) )` where
  `imgToBuffer(u) = imgCenter + imgScale · R(imgAngle) · u`.
  `worldToLocal = imgFromBuffer( globalWorldToPattern(w) )`.

### 2. Provider (`SymRenderer`)

Build the list per interaction:
1. always: `patternTarget` wrapping `mConfig.patternTransConfig`.
2. if `mPattern.getTransformTargets` exists: append its entries.
   `PatternImageArray.getTransformTargets()` returns one per child, each
   wrapping that `PatternImage` via `getTransform()` / new `setTransform()`.
3. filter image targets to the active `VisualizationImage` layer's `imageId`
   set so "editable" == "shown" (Step E).

### 3. Handler generalization (`PatternTransformHandler` → shared, fallback-safe)

- `getInteractionTarget(px,py)` iterates **all** targets:
  pivots first, then corners (`target.localToWorld(corner)` → `world2screen`,
  12 px), then body (point-in-box via `target.worldToLocal`, innermost/last
  wins so a small image box on top of the pattern box grabs the image).
  Returns `{ targetIndex, mode }`.
- `pointerdown`: capture `mActiveTarget`, `mDragMode`, `mOldPointer`.
- Drag math unchanged in form, but reads/writes `mActiveTarget.getConfig()` /
  `setConfig()` and uses `mActiveTarget.worldToLocal` for pointer deltas:
  - **translate**: world delta → `mActiveTarget` local delta → add to
    `centerX/centerY`.
  - **rotate/scale**:
    - pattern target: about `pivot` (existing `applyRotationAndScale`, which
      also relocates centre to keep the pivot fixed).
    - image target: about the box **centre** — add angle delta to `angle`,
      multiply `scale` by radius ratio, leave centre fixed (simpler; no
      centre relocation).
- Ctrl+click: set pivot on the pattern target only (or a tool-local pivot
  usable for image targets too — nice-to-have).
- If no provider → list is just `[patternTarget]` → behaviour identical to
  today.

### 4. Renderer

Already draws pattern box + dashed secondary boxes. Add:
- `handler.getActiveTargetId()`; draw the **active** target's corners as the
  filled interactive handles, dim the rest.
- optional hover highlight (thicken the box under the pointer).

### 5. Selection affordance (recommended)

Dropdown in the tool params: `editing: pattern | img1 | img2 …`. Pins the
active target so you don't have to grab a tiny box; direct grab still works
and updates the dropdown.

### 6. Coordinate-correctness checklist (the subtle part)

- Image box in pattern/buffer space: `center + scale·R(angle)·u`, verified by
  the boundary display already shipped.
- Image translate: convert world delta → pattern space (÷ global scale,
  un-rotate by global angle) → that is the delta for image `centerX/centerY`
  (image centre lives in the same space the global transform consumes).
- Image rotate/scale about centre: `angle += Δθ`, `scale *= r2/r1`, centre
  fixed.
- `flipX/flipY`: not in the gizmo — menu toggles; they don't move the box.

### 7. Blast radius / modularity

- `PatternTransformHandler` + `PatternTransformRenderer` (`lib/symhublib/`)
  become target-list driven. Backward-compatible: no provider ⇒ single
  pattern target ⇒ today's behaviour byte-for-byte.
- `PatternImage`: `+ setTransform(partial)` (additive).
- `PatternImageArray`: `+ getTransformTargets()` (additive; supersedes
  `getImageBoxes` — renderer can derive boxes from targets).
- `SymRenderer`: build + pass the target list in the `TOOL_PATTERN_TRANSFORM`
  case (small change).
- Fully-local alternative (orbifold-only `MultiTransformTool` replacing
  `activeTool`) still needs a new `SymRenderer` hook to inject an app tool —
  comparable shared change, more duplicated geometry code. Prefer the
  generalization-with-fallback.

### 8. Increments

- **(shipped)** read-only per-image boundary display.
- **A** — hover hit-test across all targets; highlight the one under the
  pointer (no drag).
- **B** — translate the hovered/selected image box.
- **C** — rotate/scale the hovered/selected image box about its centre.
- **D** — `editing:` dropdown + active-target handle rendering.
- **E** — filter image targets to the layer's `imageId` (shown == editable);
  pattern target always present.
