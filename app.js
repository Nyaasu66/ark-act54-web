import { sceneData } from "./scene-data.js";
import { evaluateScalar, evaluateVector, quaternionZDegrees } from "./curve-runtime.js";

const stage = document.querySelector("#stage");
const scaler = document.querySelector("#stage-scaler");
const loading = document.querySelector("#loading");
const controls = document.querySelector("#controls");
const playButton = document.querySelector("#play");
const replayButton = document.querySelector("#replay");
const frameBackButton = document.querySelector("#frame-back");
const frameForwardButton = document.querySelector("#frame-forward");
const timeline = document.querySelector("#timeline");
const timeLabel = document.querySelector("#time-label");
const referenceHud = document.querySelector("#reference-hud");
const query = new URLSearchParams(location.search);
const REFERENCE_VIEWPORT = [1280, 720];
const OUTPUT_SCALE = sceneData.viewport[0] / REFERENCE_VIEWPORT[0];

const nodes = new Map();
const imagePromises = [];
let nextNodeId = 0;
let currentTime = 0;
let playing = false;
let startedAt = 0;
let animationFrame = 0;
let loop = query.get("loop") === "1";

const CIRCLE_MATERIAL_PATHS = new Set([
  "panel_front_ui/group_left/btn_card/bg",
  "root_bg/char_mask_c1",
  "root_bg/group_bkg_1/circle_blue_c1",
  "root_bg/group_bkg_1/circle_blue_c1/circle_blue_c3",
  "root_bg/group_bkg_1/group_bg/moon_mask_c2",
  "root_bg/group_bkg_1/group_bg/circle_tiny/circle_mask",
  "root_bg/bg_cover/light_1",
  "root_bg/bg_cover/light_2",
  "root_bg/group_bkg_2/bg1_col_c6",
  "root_bg/group_bkg_2/circle_outline_1",
  "root_bg/group_bkg_2/large_mask/trans_bg_cover_c5",
  "root_bg/group_bkg_2/large_mask/bg_mask_c4",
  "root_bg/group_bkg_2/bg1_col_c7",
  "root_bg/group_bkg_2/circle_outline_2",
  "root_bg/group_bkg_2/bg_2_back/bg_2_c4",
  "root_bg/group_bkg_2/bg_2/bg_2_copy",
  "root_bg/group_bkg_2/bg_2/light_1_c4",
  "root_bg/group_bkg_2/bg_2/light_2_c4",
  "root_bg/group_bkg_2/circle_m",
  "root_bg/group_bkg_2/circle_outline_return",
  "root_bg/group_bkg_2/circle_s",
  "root_bg/circle_m_c2/mask",
  "root_bg/circle_m_c2/circle",
  "root_bg/circle_s_c2/mask",
  "root_bg/circle_s_c2/circle",
  "panel_entry_anim/entry_mask_c5",
  "panel_entry_anim/entry_mask_c6",
  "panel_entry_anim/entry_mask_c7",
  "panel_circle_part/root/mask_c7",
  "panel_circle_part/root/mask_c7_copy",
  "panel_circle_part/root/mask_c6",
  "panel_circle_part/root/circle_1",
  "panel_circle_part/root/circle_1_c8_copy",
  "panel_circle_part/root/circle_2",
  "panel_circle_part/root/circle_2_c8_copy",
  "panel_circle_part/root/circle_3",
  "panel_circle_part/root/circle_4",
  "panel_circle_part/root/moon_c7",
  "panel_circle_part/root/moon_c6",
]);

const HIDDEN_STENCIL_WRITERS = new Set([
  "root_bg/group_bkg_1/circle_blue_c1/circle_blue_c3",
  "root_bg/group_bkg_1/group_bg/moon_mask_c2",
  "root_bg/group_bkg_1/group_bg/circle_tiny/circle_mask",
  "root_bg/circle_m_c2/mask",
  "root_bg/circle_s_c2/mask",
  "panel_entry_anim/entry_mask_c5",
  "panel_circle_part/root/mask_c8",
  "panel_circle_part/root/mask_c7",
  "panel_circle_part/root/mask_c7_copy",
  "panel_circle_part/root/mask_c6",
]);

const STENCIL_RULES = [
  ["root_bg/char_mask_c1", "root_bg/group_bkg_1/white_c1", "inside"],
  ["root_bg/char_mask_c1", "root_bg/group_bkg_1/circle_blue_c1", "inside"],
  ["root_bg/char_mask_c1", "root_bg/bg_cover", "outside"],
  ["root_bg/char_mask_c1", "root_bg/root_char_main/makoto_c1_color", "inside"],
  ["root_bg/char_mask_c1", "root_bg/root_char_main/makoto_c1", "inside"],
  ["root_bg/char_mask_c1", "root_bg/root_char_main/makoto_copy", "outside"],
  ["root_bg/group_bkg_1/group_bg/moon_mask_c2", "root_bg/group_bkg_1/group_bg/char_left_s_c2", "inside"],
  ["root_bg/group_bkg_1/circle_blue_c1/circle_blue_c3", "root_bg/group_bkg_1/group_bg/circle_s/circle_1_c3", "inside"],
  ["root_bg/group_bkg_1/circle_blue_c1/circle_blue_c3", "root_bg/group_bkg_1/group_bg/circle_s/circle_2_c3", "outside"],
  ["root_bg/group_bkg_1/group_bg/circle_tiny/circle_mask", "root_bg/group_bkg_1/group_bg/circle_tiny/circle_copy", "outside"],
  ["root_bg/circle_m_c2/mask", "root_bg/circle_m_c2/circle", "inside"],
  ["root_bg/circle_s_c2/mask", "root_bg/circle_s_c2/circle", "inside"],
  ["panel_entry_anim/entry_mask_c5", "panel_entry_anim/entry_bg_2_c5", "inside"],
  ["panel_entry_anim/entry_mask_c5", "panel_entry_anim/scale_1/text_1_c5", "inside"],
  ["panel_entry_anim/entry_mask_c5", "panel_entry_anim/scale_1/text_2_c5", "inside"],
  ["panel_entry_anim/entry_mask_c5", "panel_entry_anim/scale_1/scale_2/root_1/char_makoto_c5", "inside"],
  ["panel_entry_anim/entry_mask_c5", "panel_entry_anim/entry_main_text_3_c5", "inside"],
  ["panel_entry_anim/entry_mask_c6", "panel_entry_anim/entry_main_text_2_c6", "outside"],
  ["panel_entry_anim/entry_mask_c7", "panel_entry_anim/scale_1_copy/text_1_c7", "inside"],
  ["panel_entry_anim/entry_mask_c7", "panel_entry_anim/scale_1_copy/text_2_c7", "inside"],
  ["panel_entry_anim/entry_mask_c7", "panel_entry_anim/scale_1_copy/scale_2_copy/root_1/char_makoto_c7", "inside"],
  ["panel_entry_anim/entry_bg_5_c8", "panel_entry_anim/scale_4/text_1", "outside"],
  ["panel_entry_anim/entry_bg_5_c8", "panel_entry_anim/scale_4/text_2", "outside"],
  ["panel_entry_anim/entry_bg_5_c8", "panel_entry_anim/scale_4/text_1_copy", "inside"],
  ["panel_entry_anim/entry_bg_5_c8", "panel_entry_anim/scale_4/text_2_copy", "inside"],
  ["panel_entry_anim/entry_bg_5_c8", "panel_entry_anim/names", "outside"],
  ["panel_entry_anim/entry_bg_5_c8", "panel_entry_anim/entry_main_text_4_c8", "outside"],
  ["panel_entry_anim/entry_bg_5_c8", "panel_entry_anim/entry_main_text_5_c8", "inside"],
  ["panel_entry_anim/entry_bg_6_c1", "panel_entry_anim/entry_main_text_c1", "inside"],
  ["panel_entry_anim/entry_bg_7_c2", "panel_entry_anim/entry_main_text_c2", "inside"],
  ["panel_circle_part/root/mask_c8", "panel_circle_part/root/circle_1_c8_copy", "outside"],
  ["panel_circle_part/root/mask_c8", "panel_circle_part/root/circle_2_c8_copy", "outside"],
  [["panel_circle_part/root/mask_c7", "panel_circle_part/root/mask_c7_copy"], "panel_circle_part/root/moon_c7", "outside"],
  ["panel_circle_part/root/mask_c6", "panel_circle_part/root/moon_c6", "inside"],
];

for (let index = 1; index <= 6; index += 1) {
  const waterFrame = String(index).padStart(2, "0");
  STENCIL_RULES.push(
    ["root_bg/char_mask_c1", `root_bg/bg_cover/water_anim_1/${waterFrame}`, "outside"],
  );
}

for (const path of [
  "root_bg/bg_cover/light_1",
  "root_bg/bg_cover/light_2",
  "root_bg/bg_cover/scale/desc",
  "root_bg/bg_cover/right_copy/root_char_right/char_2",
]) {
  STENCIL_RULES.push(["root_bg/char_mask_c1", path, "outside"]);
}

for (let index = 1; index <= 5; index += 1) {
  STENCIL_RULES.push(
    ["panel_entry_anim/entry_mask_c6", `panel_entry_anim/group_water/part_1/water_${index}`, "inside"],
  );
}

for (let index = 1; index <= 5; index += 1) {
  STENCIL_RULES.push(
    ["panel_entry_anim/entry_bg_5_c8", `panel_entry_anim/scale_3/char_${index}`, "outside"],
    ["panel_entry_anim/entry_bg_5_c8", `panel_entry_anim/scale_3/char_${index}/char_${index}_copy`, "inside"],
  );
}

function cloneArray(value) {
  return value ? [...value] : value;
}

function rgba(color, alpha = 1) {
  return `rgba(${Math.round(color[0] * 255)}, ${Math.round(color[1] * 255)}, ${Math.round(color[2] * 255)}, ${color[3] * alpha})`;
}

function createGraphic(node, element) {
  if (!node.graphic) return null;

  const layer = document.createElement("div");
  layer.className = "unity-graphic";
  const sprite = node.graphic.sprite;
  let image = null;
  let tint = null;

  if (sprite) {
    image = document.createElement("img");
    image.className = "unity-sprite";
    image.alt = "";
    image.draggable = false;
    image.src = encodeURI(sprite.url);
    const [textureWidth, textureHeight] = sprite.textureSize;
    const [x, y, width, height] = sprite.rect;
    image.style.width = `${(textureWidth / width) * 100}%`;
    image.style.height = `${(textureHeight / height) * 100}%`;
    image.style.left = `${(-x / width) * 100}%`;
    image.style.top = `${(-(textureHeight - y - height) / height) * 100}%`;
    tint = document.createElement("span");
    tint.className = "unity-tint";
    tint.style.width = image.style.width;
    tint.style.height = image.style.height;
    tint.style.left = image.style.left;
    tint.style.top = image.style.top;
    tint.style.maskImage = `url("${image.src}")`;
    tint.style.maskSize = "100% 100%";
    tint.style.maskRepeat = "no-repeat";
    imagePromises.push(
      image.decode().catch(() => {
        console.warn(`Unable to decode ${sprite.url}`);
      }),
    );
    layer.append(image);
    layer.append(tint);
    if (sprite.name === "sprite_white") {
      image.hidden = true;
      tint.hidden = true;
      layer.classList.add("is-solid-sprite");
    }
  }

  element.append(layer);
  return { layer, image, tint };
}

function createNode(node, parentElement) {
  const id = ++nextNodeId;
  const element = document.createElement("div");
  element.className = "unity-node";
  element.dataset.path = node.path;
  element.dataset.name = node.name;

  if (node.graphic && /circle|round_wire|moon/i.test(node.name)) element.classList.add("is-round");
  if (CIRCLE_MATERIAL_PATHS.has(node.path)) element.classList.add("is-material-circle");
  if (node.name === "mask" && /circle/i.test(node.path)) element.classList.add("is-round");
  if (/outline|round_wire|\bline\b/i.test(node.name)) element.classList.add("is-outline");
  if (/^title_main_glass/.test(node.name)) {
    element.classList.add("is-title-glass");
    element.style.maskImage = `url("${encodeURI("[uc]act54side/title_main_mask.png")}")`;
    element.style.maskSize = "100% 100%";
    element.style.maskRepeat = "no-repeat";
  }
  if (node.mask) {
    element.classList.add("is-mask");
    if (node.mask.kind === "graphic") element.classList.add("is-graphic-mask");
  }

  const visual = createGraphic(node, element);
  let textElement = null;
  if (node.text?.value) {
    textElement = document.createElement("span");
    textElement.className = "unity-text";
    textElement.textContent = node.text.value;
    textElement.style.fontSize = `${node.text.fontSize}px`;
    textElement.style.color = rgba(node.text.color);
    element.append(textElement);
  }

  parentElement.append(element);

  const runtime = {
    source: node,
    element,
    visual,
    textElement,
    position: cloneArray(node.transform.position),
    size: cloneArray(node.transform.size),
    scale: cloneArray(node.transform.scale),
    rotation: cloneArray(node.transform.rotation),
    active: node.active,
    alpha: node.group?.alpha ?? 1,
    color: cloneArray(node.graphic?.color ?? [1, 1, 1, 1]),
    fillAmount: node.graphic?.fillAmount ?? 1,
    fillOrigin: node.graphic?.fillOrigin ?? 0,
    rect: null,
    children: [],
  };
  nodes.set(node.path, runtime);

  for (const child of node.children) {
    runtime.children.push(createNode(child, element));
  }

  if (node.mask?.kind === "graphic" && node.graphic?.sprite) {
    element.style.maskImage = `url("${encodeURI(node.graphic.sprite.url)}")`;
    element.style.maskSize = "100% 100%";
    element.style.maskRepeat = "no-repeat";
  }

  if (node.mask && !node.mask.showGraphic && visual) visual.layer.hidden = true;
  return runtime;
}

function resetRuntime(runtime) {
  const node = runtime.source;
  runtime.position[0] = node.transform.position[0];
  runtime.position[1] = node.transform.position[1];
  runtime.size[0] = node.transform.size[0];
  runtime.size[1] = node.transform.size[1];
  runtime.scale[0] = node.transform.scale[0];
  runtime.scale[1] = node.transform.scale[1];
  runtime.scale[2] = node.transform.scale[2];
  runtime.rotation = cloneArray(node.transform.rotation);
  runtime.active = node.active;
  runtime.alpha = node.group?.alpha ?? 1;
  runtime.color = cloneArray(node.graphic?.color ?? [1, 1, 1, 1]);
  runtime.fillAmount = node.graphic?.fillAmount ?? 1;
  runtime.fillOrigin = node.graphic?.fillOrigin ?? 0;
}

function applyFloatCurve(runtime, property, value) {
  switch (property) {
    case "m_AnchoredPosition.x":
      runtime.position[0] = value;
      break;
    case "m_AnchoredPosition.y":
      runtime.position[1] = value;
      break;
    case "m_SizeDelta.x":
      runtime.size[0] = value;
      break;
    case "m_SizeDelta.y":
      runtime.size[1] = value;
      break;
    case "m_Alpha":
      runtime.alpha = value;
      break;
    case "m_Color.r":
      runtime.color[0] = value;
      break;
    case "m_Color.g":
      runtime.color[1] = value;
      break;
    case "m_Color.b":
      runtime.color[2] = value;
      break;
    case "m_Color.a":
      runtime.color[3] = value;
      break;
    case "m_FillAmount":
      runtime.fillAmount = value;
      break;
    case "m_FillOrigin":
      runtime.fillOrigin = value;
      break;
    case "m_IsActive":
      runtime.active = value >= 0.5;
      break;
    case "_floatProperty1.floatValue":
      runtime.element.style.setProperty("--shader-value-1", value);
      break;
    case "_floatProperty2.floatValue":
      runtime.element.style.setProperty("--shader-value-2", value);
      break;
  }
}

function updateFill(runtime) {
  const graphic = runtime.source.graphic;
  const layer = runtime.visual?.layer;
  if (!graphic || !layer) return;
  const amount = Math.max(0, Math.min(1, runtime.fillAmount));

  layer.style.clipPath = "";
  layer.style.maskImage = "";
  if (amount >= 0.9999) return;

  if (graphic.fillMethod === 0) {
    const hidden = (1 - amount) * 100;
    layer.style.clipPath = runtime.fillOrigin === 1
      ? `inset(0 0 0 ${hidden}%)`
      : `inset(0 ${hidden}% 0 0)`;
  } else if (graphic.fillMethod === 1) {
    const hidden = (1 - amount) * 100;
    layer.style.clipPath = runtime.fillOrigin === 1
      ? `inset(0 0 ${hidden}% 0)`
      : `inset(${hidden}% 0 0 0)`;
  } else {
    const sweep = amount * 360;
    const origin = [180, 90, 0, 270][runtime.fillOrigin % 4];
    const start = graphic.fillClockwise ? origin : origin - sweep;
    layer.style.maskImage = `conic-gradient(from ${start}deg, #000 0deg ${amount * 360}deg, transparent ${amount * 360}deg 360deg)`;
  }
}

function updateVisual(runtime) {
  const { source, element, visual, color } = runtime;
  element.style.display = runtime.active ? "block" : "none";
  element.style.opacity = String(Math.max(0, runtime.alpha));
  if (!visual) return;

  const enabled = source.graphic.enabled && color[3] > 0.0001;
  visual.layer.style.display = enabled ? "block" : "none";
  visual.layer.style.opacity = String(Math.max(0, color[3]));

  // These RGB channels encode dissolve thresholds, not a vertex tint.
  if (source.path === "root_bg/root_char_main/makoto_c1") {
    visual.layer.style.opacity = String(Math.max(0, color[3] * (1 - color[2])));
  }
  if (["group_title/flash", "group_title/flash_copy", "group_title/title_main_copy"].includes(source.path)) {
    visual.layer.style.opacity = String(Math.max(0, color[3] * (1 - color[1])));
  }

  if (visual.image && !visual.image.hidden) {
    const shaderControlled =
      source.path === "root_bg/root_char_main/makoto_c1" ||
      (source.path.startsWith("group_title/") && source.path !== "group_title/title_main");
    const flatTinted =
      source.path.startsWith("panel_entry_anim/") ||
      source.path.startsWith("panel_circle_part/") ||
      source.path.startsWith("root_bg/root_char_main/") ||
      source.path === "group_title/title_main";
    visual.tint.hidden = shaderControlled;
    visual.image.style.visibility = flatTinted && !shaderControlled ? "hidden" : "visible";
    if (!shaderControlled) {
      const tintColor = source.path === "root_bg/root_char_main/makoto_c1_color"
        ? [0.03, 0.25 + color[1] * 0.45, 0.85 + color[1] * 0.15]
        : source.path === "group_title/title_main"
          ? [0, 0.95, 0.91]
          : color.slice(0, 3);
      const channels = tintColor.map((value) => Math.round(value * 255)).join(" ");
      visual.tint.style.backgroundColor = `rgb(${channels})`;
      visual.tint.style.mixBlendMode = flatTinted ? "normal" : "multiply";
    }
  } else {
    if (element.classList.contains("is-title-glass")) {
      visual.layer.style.opacity = String(Math.max(0, color[3] * 0.04));
      visual.layer.style.background = "linear-gradient(105deg, transparent 24%, white 48%, transparent 70%)";
    } else {
      visual.layer.style.background = rgba([color[0], color[1], color[2], 1]);
    }
    if (element.classList.contains("is-outline")) {
      visual.layer.style.background = "transparent";
      visual.layer.style.border = `${Math.max(1, Number(element.style.getPropertyValue("--shader-value-1")) || 2)}px solid ${rgba(color)}`;
    }
  }

  updateFill(runtime);
}

function setStencilMask(target, mask) {
  // Unity's stencil comparison belongs to the current Graphic renderer. Applying
  // it to the RectTransform would also clip child renderers, including the
  // inverse-stencil copies nested under several entry character/text nodes.
  const surface = target.visual?.layer ?? target.element;
  surface.style.maskImage = mask;
  surface.style.webkitMaskImage = mask;
  surface.style.maskRepeat = "no-repeat";
  surface.style.webkitMaskRepeat = "no-repeat";
}

function multiplyMatrix(left, right) {
  return [
    left[0] * right[0] + left[2] * right[1],
    left[1] * right[0] + left[3] * right[1],
    left[0] * right[2] + left[2] * right[3],
    left[1] * right[2] + left[3] * right[3],
    left[0] * right[4] + left[2] * right[5] + left[4],
    left[1] * right[4] + left[3] * right[5] + left[5],
  ];
}

function invertMatrix(matrix) {
  const [a, b, c, d, e, f] = matrix;
  const determinant = a * d - b * c;
  if (Math.abs(determinant) < 1e-8) return null;
  return [
    d / determinant,
    -b / determinant,
    -c / determinant,
    a / determinant,
    (c * f - d * e) / determinant,
    (b * e - a * f) / determinant,
  ];
}

function transformPoint(matrix, x, y) {
  return [
    matrix[0] * x + matrix[2] * y + matrix[4],
    matrix[1] * x + matrix[3] * y + matrix[5],
  ];
}

function stencilPolygon(writer, target) {
  const inverseTarget = invertMatrix(target.worldMatrix);
  if (!inverseTarget) return [];
  const graphic = writer.source.graphic;
  const width = writer.rect.width;
  const height = writer.rect.height;
  let left = 0;
  let right = width;

  let localPoints;
  if (graphic?.type === 3 && graphic.fillMethod === 4 && writer.fillAmount < 0.9999) {
    // Radial360 is a sector of a rectangular UI mesh, not an ellipse. Keep the
    // missing wedge when this mesh writes stencil (the turntable highlight).
    const amount = Math.max(0, Math.min(1, writer.fillAmount));
    const start = [180, 90, 0, 270][writer.fillOrigin % 4];
    const direction = graphic.fillClockwise ? 1 : -1;
    const steps = Math.max(1, Math.ceil(amount * 360 / 4));
    localPoints = [[width / 2, height / 2]];
    for (let index = 0; index <= steps; index += 1) {
      const radians = (start + direction * amount * 360 * index / steps) * Math.PI / 180;
      const dx = Math.sin(radians);
      const dy = -Math.cos(radians);
      const distance = Math.min(
        Math.abs(dx) < 1e-8 ? Infinity : width / 2 / Math.abs(dx),
        Math.abs(dy) < 1e-8 ? Infinity : height / 2 / Math.abs(dy),
      );
      localPoints.push([width / 2 + dx * distance, height / 2 + dy * distance]);
    }
  } else if (graphic?.type === 3 && graphic.fillMethod === 0) {
    const amount = Math.max(0, Math.min(1, writer.fillAmount));
    if (writer.fillOrigin === 1) left = width * (1 - amount);
    else right = width * amount;
  }

  return (localPoints ?? [
    [left, 0],
    [right, 0],
    [right, height],
    [left, height],
  ]).map(([x, y]) => {
    const world = transformPoint(writer.worldMatrix, x, y);
    return transformPoint(inverseTarget, world[0], world[1]);
  });
}

function polygonMask(target, points, mode) {
  if (points.length < 3) return mode === "inside" ? "linear-gradient(transparent, transparent)" : "none";
  const width = Math.max(1, target.rect.width);
  const height = Math.max(1, target.rect.height);
  const polygon = points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`).join("") + "Z";
  const path = mode === "inside"
    ? polygon
    : `M0 0H${width.toFixed(2)}V${height.toFixed(2)}H0Z${polygon}`;
  const fillRule = mode === "outside" ? ' fill-rule="evenodd"' : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"><path${fillRule} fill="white" d="${path}"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

function stencilEllipse(writer, target) {
  const inverseTarget = invertMatrix(target.worldMatrix);
  if (!inverseTarget) return null;
  const centerWorld = transformPoint(writer.worldMatrix, writer.rect.width / 2, writer.rect.height / 2);
  const xWorld = transformPoint(writer.worldMatrix, writer.rect.width, writer.rect.height / 2);
  const yWorld = transformPoint(writer.worldMatrix, writer.rect.width / 2, writer.rect.height);
  const center = transformPoint(inverseTarget, centerWorld[0], centerWorld[1]);
  const xEdge = transformPoint(inverseTarget, xWorld[0], xWorld[1]);
  const yEdge = transformPoint(inverseTarget, yWorld[0], yWorld[1]);
  return {
    centerX: center[0],
    centerY: center[1],
    radiusX: Math.hypot(xEdge[0] - center[0], xEdge[1] - center[1]) * 0.98,
    radiusY: Math.hypot(yEdge[0] - center[0], yEdge[1] - center[1]) * 0.98,
  };
}

function applyStencilUnion(writerPaths, targetPath, mode) {
  const target = nodes.get(targetPath);
  if (!target) return;
  const ellipses = writerPaths
    .map((path) => nodes.get(path))
    .filter((writer) => writer?.active && writer.rect.width > 0.01)
    .map((writer) => stencilEllipse(writer, target))
    .filter(Boolean);
  if (ellipses.length === 0) {
    setStencilMask(target, mode === "inside" ? "linear-gradient(transparent, transparent)" : "none");
    return;
  }
  const width = Math.max(1, target.rect.width);
  const height = Math.max(1, target.rect.height);
  const background = mode === "outside" ? "white" : "black";
  const foreground = mode === "outside" ? "black" : "white";
  const shapes = ellipses.map(({ centerX, centerY, radiusX, radiusY }) =>
    `<ellipse fill="${foreground}" cx="${centerX}" cy="${centerY}" rx="${radiusX}" ry="${radiusY}"/>`,
  ).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"><defs><mask id="stencil" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${background}"/>${shapes}</mask></defs><rect width="100%" height="100%" fill="white" mask="url(#stencil)"/></svg>`;
  setStencilMask(target, `url("data:image/svg+xml,${encodeURIComponent(svg)}")`);
}

function applyStencil(writerPath, targetPath, mode) {
  const writer = nodes.get(writerPath);
  const target = nodes.get(targetPath);
  if (!writer || !target) return;

  if (!writer.active || writer.rect.width < 0.01 || target.rect.width < 0.01) {
    setStencilMask(target, mode === "inside" ? "linear-gradient(transparent, transparent)" : "none");
    return;
  }

  const writerGraphic = writer.source.graphic;
  if (writerGraphic?.type === 3 && writerGraphic.fillAmount !== undefined && writer.fillAmount < 0.0001) {
    setStencilMask(target, mode === "inside" ? "linear-gradient(transparent, transparent)" : "none");
    return;
  }

  if (!CIRCLE_MATERIAL_PATHS.has(writerPath)) {
    setStencilMask(target, polygonMask(target, stencilPolygon(writer, target), mode));
    return;
  }

  const ellipse = stencilEllipse(writer, target);
  if (!ellipse) return;
  const { centerX, centerY, radiusX, radiusY } = ellipse;
  const edge = 1.5;
  const mask = mode === "inside"
    ? `radial-gradient(ellipse ${radiusX}px ${radiusY}px at ${centerX}px ${centerY}px, #000 0, #000 calc(100% - ${edge}px), transparent 100%)`
    : `radial-gradient(ellipse ${radiusX}px ${radiusY}px at ${centerX}px ${centerY}px, transparent 0, transparent calc(100% - ${edge}px), #000 100%)`;
  setStencilMask(target, mask);
}

function applyStencils() {
  for (const path of HIDDEN_STENCIL_WRITERS) {
    const writer = nodes.get(path);
    if (writer?.visual) writer.visual.layer.style.visibility = "hidden";
  }
  for (const [writer, target, mode] of STENCIL_RULES) {
    if (Array.isArray(writer)) applyStencilUnion(writer, target, mode);
    else applyStencil(writer, target, mode);
  }
}

function layoutNode(runtime, parentRect, parentWorldMatrix = [1, 0, 0, 1, 0, 0]) {
  const { transform } = runtime.source;
  const isRoot = runtime.source.path === "";
  const width =
    (transform.anchorMax[0] - transform.anchorMin[0]) * parentRect.width + runtime.size[0];
  const height =
    (transform.anchorMax[1] - transform.anchorMin[1]) * parentRect.height + runtime.size[1];
  const pivotX =
    (transform.anchorMin[0] +
      (transform.anchorMax[0] - transform.anchorMin[0]) * transform.pivot[0]) *
      parentRect.width +
    runtime.position[0];
  const pivotY =
    (transform.anchorMin[1] +
      (transform.anchorMax[1] - transform.anchorMin[1]) * transform.pivot[1]) *
      parentRect.height +
    runtime.position[1];
  const left = pivotX - transform.pivot[0] * width;
  const bottom = pivotY - transform.pivot[1] * height;
  const top = parentRect.height - bottom - height;
  const angle = -quaternionZDegrees(runtime.rotation);
  const radians = angle * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const originX = isRoot ? 0 : transform.pivot[0] * width;
  const originY = isRoot ? 0 : (1 - transform.pivot[1]) * height;
  const scaleX = runtime.scale[0] * (isRoot ? OUTPUT_SCALE : 1);
  const scaleY = runtime.scale[1] * (isRoot ? OUTPUT_SCALE : 1);
  const a = cosine * scaleX;
  const b = sine * scaleX;
  const c = -sine * scaleY;
  const d = cosine * scaleY;
  const localMatrix = [
    a,
    b,
    c,
    d,
    left + originX - a * originX - c * originY,
    top + originY - b * originX - d * originY,
  ];

  runtime.rect = { width, height };
  runtime.worldMatrix = multiplyMatrix(parentWorldMatrix, localMatrix);
  runtime.element.style.left = `${left}px`;
  runtime.element.style.top = `${top}px`;
  runtime.element.style.width = `${width}px`;
  runtime.element.style.height = `${height}px`;
  runtime.element.style.transformOrigin = isRoot
    ? "0 0"
    : `${transform.pivot[0] * 100}% ${(1 - transform.pivot[1]) * 100}%`;
  runtime.element.style.transform = `rotate(${angle}deg) scale(${scaleX}, ${scaleY})`;
  updateVisual(runtime);

  for (const child of runtime.children) layoutNode(child, runtime.rect, runtime.worldMatrix);
}

function render(time) {
  currentTime = Math.max(0, Math.min(sceneData.duration, time));
  nodes.forEach(resetRuntime);

  for (const curve of sceneData.curves) {
    const runtime = nodes.get(curve.path);
    if (!runtime) continue;
    if (curve.kind === "float") {
      applyFloatCurve(runtime, curve.property, evaluateScalar(curve.keys, currentTime));
    } else if (curve.kind === "scale") {
      runtime.scale = evaluateVector(curve.keys, currentTime);
    } else if (curve.kind === "rotation") {
      runtime.rotation = evaluateVector(curve.keys, currentTime);
    }
  }

  layoutNode(nodes.get(""), { width: REFERENCE_VIEWPORT[0], height: REFERENCE_VIEWPORT[1] });
  applyStencils();
  referenceHud.style.opacity = String(Math.max(0, Math.min(1, (currentTime - 3.9) / 0.25)));
  const frame = Math.round(currentTime * sceneData.frameRate);
  timeline.value = String(frame);
  timeLabel.textContent = `${frame.toString().padStart(3, "0")} / ${sceneData.frameCount} · ${currentTime.toFixed(2)}s`;
  stage.dataset.frame = String(frame);
  stage.dataset.time = currentTime.toFixed(6);
}

function tick(now) {
  if (!playing) return;
  let time = (now - startedAt) / 1000;
  if (time >= sceneData.duration) {
    if (loop) {
      startedAt = now;
      time = 0;
    } else {
      time = sceneData.duration;
      playing = false;
    }
  }
  render(time);
  updatePlayButton();
  if (playing) animationFrame = requestAnimationFrame(tick);
}

function updatePlayButton() {
  playButton.textContent = playing ? "暂停" : "播放";
  playButton.setAttribute("aria-label", playing ? "暂停动画" : "播放动画");
}

function play() {
  if (currentTime >= sceneData.duration) currentTime = 0;
  playing = true;
  startedAt = performance.now() - currentTime * 1000;
  cancelAnimationFrame(animationFrame);
  animationFrame = requestAnimationFrame(tick);
  updatePlayButton();
}

function pause() {
  playing = false;
  cancelAnimationFrame(animationFrame);
  updatePlayButton();
}

function seek(time) {
  pause();
  render(time);
}

function setFrame(frame) {
  seek(frame / sceneData.frameRate);
}

function fitStage() {
  const viewport = window.visualViewport;
  const width = viewport?.width ?? innerWidth;
  const height = viewport?.height ?? innerHeight;
  const offsetLeft = viewport?.offsetLeft ?? 0;
  const offsetTop = viewport?.offsetTop ?? 0;
  const portrait = height > width;
  const [sceneWidth, sceneHeight] = sceneData.viewport;
  const scale = portrait
    ? Math.min(width / sceneHeight, height / sceneWidth)
    : Math.min(width / sceneWidth, height / sceneHeight);

  document.documentElement.style.setProperty("--viewport-width", `${width}px`);
  document.documentElement.style.setProperty("--viewport-center-x", `${offsetLeft + width / 2}px`);
  document.documentElement.style.setProperty("--viewport-bottom", `${offsetTop + height}px`);
  scaler.style.setProperty("--stage-scale", scale);
  scaler.style.setProperty("--stage-rotation", portrait ? "90deg" : "0deg");
  scaler.style.left = `${offsetLeft + width / 2}px`;
  scaler.style.top = `${offsetTop + height / 2}px`;
  scaler.dataset.orientation = portrait ? "portrait" : "landscape";
}

createNode(sceneData.root, stage);
timeline.max = String(sceneData.frameCount);
timeline.step = "1";
timeline.addEventListener("input", () => setFrame(Number(timeline.value)));
playButton.addEventListener("click", () => (playing ? pause() : play()));
replayButton.addEventListener("click", () => {
  currentTime = 0;
  render(0);
  play();
});
frameBackButton.addEventListener("click", () => setFrame(Math.round(currentTime * 60) - 1));
frameForwardButton.addEventListener("click", () => setFrame(Math.round(currentTime * 60) + 1));
addEventListener("resize", fitStage);
addEventListener("orientationchange", fitStage);
window.visualViewport?.addEventListener("resize", fitStage);
window.visualViewport?.addEventListener("scroll", fitStage);
addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
    playing ? pause() : play();
  } else if (event.key === "ArrowLeft") setFrame(Math.round(currentTime * 60) - 1);
  else if (event.key === "ArrowRight") setFrame(Math.round(currentTime * 60) + 1);
  else if (event.key.toLowerCase() === "r") {
    currentTime = 0;
    play();
  } else if (event.key.toLowerCase() === "h") controls.classList.toggle("is-hidden");
});

fitStage();
render(0);

window.act54Animation = {
  play,
  pause,
  seek,
  setFrame,
  setLoop(value) {
    loop = Boolean(value);
  },
  getState() {
    return {
      clip: sceneData.clip,
      time: currentTime,
      frame: Math.round(currentTime * sceneData.frameRate),
      playing,
      loop,
    };
  },
};

Promise.all(imagePromises).finally(() => {
  loading.classList.add("is-ready");
  setTimeout(() => loading.remove(), 450);
  if (query.get("autoplay") !== "0") play();
});
