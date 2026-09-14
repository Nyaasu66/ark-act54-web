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
const filterDefinitions = document.querySelector("#tint-filters");
const query = new URLSearchParams(location.search);

const nodes = new Map();
const imagePromises = [];
let nextNodeId = 0;
let currentTime = 0;
let playing = false;
let startedAt = 0;
let animationFrame = 0;
let loop = query.get("loop") === "1";

const FINAL_SCENE_START = 3.7166666984558105;
const FINAL_SCENE_GRAY_MASK = "root_bg/circle_m_c2/mask";
const FINAL_SCENE_HERO = "root_bg/root_char_main/makoto_c1";

function cloneArray(value) {
  return value ? [...value] : value;
}

function rgba(color, alpha = 1) {
  return `rgba(${Math.round(color[0] * 255)}, ${Math.round(color[1] * 255)}, ${Math.round(color[2] * 255)}, ${color[3] * alpha})`;
}

function createTintFilter(id) {
  const filter = document.createElementNS("http://www.w3.org/2000/svg", "filter");
  filter.id = id;
  filter.setAttribute("color-interpolation-filters", "sRGB");
  const matrix = document.createElementNS("http://www.w3.org/2000/svg", "feColorMatrix");
  matrix.setAttribute("type", "matrix");
  filter.append(matrix);
  filterDefinitions.append(filter);
  return matrix;
}

function createGraphic(node, element, id) {
  if (!node.graphic) return null;

  const layer = document.createElement("div");
  layer.className = "unity-graphic";
  const sprite = node.graphic.sprite;
  let image = null;
  let tintMatrix = null;

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
    const filterId = `unity-tint-${id}`;
    tintMatrix = createTintFilter(filterId);
    image.style.filter = `url(#${filterId})`;
    imagePromises.push(
      image.decode().catch(() => {
        console.warn(`Unable to decode ${sprite.url}`);
      }),
    );
    layer.append(image);
    if (sprite.name === "sprite_white") {
      image.hidden = true;
      layer.classList.add("is-solid-sprite");
    }
  }

  element.append(layer);
  return { layer, image, tintMatrix };
}

function createNode(node, parentElement) {
  const id = ++nextNodeId;
  const element = document.createElement("div");
  element.className = "unity-node";
  element.dataset.path = node.path;
  element.dataset.name = node.name;

  if (/circle|round_wire|moon/i.test(node.name)) element.classList.add("is-round");
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

  const visual = createGraphic(node, element, id);
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

function applyFinalSceneOverrides(time) {
  if (time < FINAL_SCENE_START) return;

  const grayMask = nodes.get(FINAL_SCENE_GRAY_MASK);
  if (grayMask) grayMask.active = false;

  const hero = nodes.get(FINAL_SCENE_HERO);
  if (hero) hero.color = [1, 1, 1, hero.color[3]];
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
    layer.style.clipPath = graphic.fillOrigin === 1
      ? `inset(0 0 0 ${hidden}%)`
      : `inset(0 ${hidden}% 0 0)`;
  } else if (graphic.fillMethod === 1) {
    const hidden = (1 - amount) * 100;
    layer.style.clipPath = graphic.fillOrigin === 1
      ? `inset(0 0 ${hidden}% 0)`
      : `inset(${hidden}% 0 0 0)`;
  } else {
    const direction = graphic.fillClockwise ? "clockwise" : "counterclockwise";
    const start = [0, 90, 180, 270][runtime.fillOrigin % 4];
    layer.style.maskImage = `conic-gradient(from ${start}deg, #000 0deg ${amount * 360}deg, transparent ${amount * 360}deg 360deg)`;
    layer.style.setProperty("--fill-direction", direction);
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

  if (visual.image && !visual.image.hidden) {
    visual.tintMatrix.setAttribute(
      "values",
      `${color[0]} 0 0 0 0  0 ${color[1]} 0 0 0  0 0 ${color[2]} 0 0  0 0 0 1 0`,
    );
  } else {
    visual.layer.style.background = rgba([color[0], color[1], color[2], 1]);
    if (element.classList.contains("is-outline")) {
      visual.layer.style.background = "transparent";
      visual.layer.style.border = `${Math.max(1, Number(element.style.getPropertyValue("--shader-value-1")) || 2)}px solid ${rgba(color)}`;
    }
  }

  updateFill(runtime);
}

function layoutNode(runtime, parentRect) {
  const { transform } = runtime.source;
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

  runtime.rect = { width, height };
  runtime.element.style.left = `${left}px`;
  runtime.element.style.top = `${top}px`;
  runtime.element.style.width = `${width}px`;
  runtime.element.style.height = `${height}px`;
  runtime.element.style.transformOrigin = `${transform.pivot[0] * 100}% ${(1 - transform.pivot[1]) * 100}%`;
  runtime.element.style.transform = `scale(${runtime.scale[0]}, ${runtime.scale[1]}) rotate(${angle}deg)`;
  updateVisual(runtime);

  for (const child of runtime.children) layoutNode(child, runtime.rect);
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

  applyFinalSceneOverrides(currentTime);

  layoutNode(nodes.get(""), { width: sceneData.viewport[0], height: sceneData.viewport[1] });
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
  const scale = Math.min(innerWidth / sceneData.viewport[0], innerHeight / sceneData.viewport[1]);
  scaler.style.setProperty("--stage-scale", scale);
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
