const canvas = document.getElementById("viewer");
const ctx = canvas.getContext("2d");
const fileInput = document.getElementById("fileInput");
const emptyState = document.getElementById("emptyState");
const activeToolLabel = document.getElementById("activeTool");
const toolHint = document.getElementById("toolHint");
const pendingPoints = document.getElementById("pendingPoints");
const measurementsEl = document.getElementById("measurements");
const zoomLabel = document.getElementById("zoomLabel");
const calibrationSizeInput = document.getElementById("calibrationSize");
const calibrationStatus = document.getElementById("calibrationStatus");
const lineThicknessInput = document.getElementById("lineThickness");
const lineDivisionsInput = document.getElementById("lineDivisions");
const extendLinesToggle = document.getElementById("extendLinesToggle");
const autoAnglesToggle = document.getElementById("autoAnglesToggle");
const lineControlStatus = document.getElementById("lineControlStatus");
const lineControlButtons = Array.from(document.querySelectorAll("[data-line-move]"));
const nudgeStepInput = document.getElementById("nudgeStep");
const rotationStepInput = document.getElementById("rotationStep");
const brightnessInput = document.getElementById("brightnessInput");
const contrastInput = document.getElementById("contrastInput");
const invertImageToggle = document.getElementById("invertImageToggle");
const colorSwatches = Array.from(document.querySelectorAll(".color-swatch"));
const referenceTabs = Array.from(document.querySelectorAll("[data-reference-tab]"));
const annotationTextInput = document.getElementById("annotationText");

const articularAngleMeta = {
  ldfa: {
    label: "mLDFA (ângulo femoral distal lateral mecânico)",
    normal: "referência usual: cerca de 87,5 +/- 2,5",
    guide: "Avalia a orientação distal do fêmur no plano frontal."
  },
  mpta: {
    label: "MPTA (ângulo tibial proximal medial)",
    normal: "referência usual: cerca de 87 +/- 2,5",
    guide: "Avalia a orientação proximal da tíbia no plano frontal."
  },
  apdfa: {
    label: "aPDFA (ângulo femoral distal posterior anatômico)",
    normal: "referência usual: cerca de 83 +/- 4",
    guide: "Avalia a orientação distal do fêmur na radiografia em perfil."
  },
  ppta: {
    label: "PPTA (ângulo tibial proximal posterior)",
    normal: "referência usual: cerca de 81 +/- 4",
    guide: "Avalia a inclinação posterior da tíbia proximal na radiografia em perfil."
  },
  adta: {
    label: "ADTA (ângulo tibial distal anterior)",
    normal: "referência usual: cerca de 80 +/- 3",
    guide: "Avalia a orientação distal da tíbia na radiografia em perfil."
  }
};

function isArticularAngleTool(tool) {
  return Object.prototype.hasOwnProperty.call(articularAngleMeta, tool);
}

const measurementGuides = {
  zoom: "Use zoom alto para posicionar pontos finos sobre córtex, centro articular e marcadores. No tablet, use dois dedos em pinça para aproximar ou afastar. A roda do mouse também aproxima e afasta.",
  pan: "Use para deslocar a radiografia ampliada sem mover os pontos já marcados.",
  calibrate: "Use um marcador radiográfico de tamanho conhecido. A calibração converte medidas lineares de pixels para milímetros.",
  annotation: "Use para registrar referências visuais ou observações curtas sem misturar com os cálculos.",
  fragment: "Contorne um segmento ósseo e use rotação para simular correção. Função educativa; não substitui planejamento cirúrgico validado.",
  pivot: "Define o ponto em torno do qual o fragmento mais recente será rotacionado.",
  ruler: "Serve para distâncias lineares e discrepância. Com escala calibrada, o resultado aparece em milímetros.",
  line: "Linha independente de 2 pontos. Selecione e arraste a linha inteira, ajuste as pontas ou pressione Delete para apagar.",
  angle3: "Use quando o ângulo depende de um vértice anatômico claro. O segundo ponto é o vértice.",
  lineAngle: "Use para comparar duas linhas independentes, como eixo e linha articular.",
  mechanicalAxis: "Eixo mecânico do membro inferior: centro da cabeça femoral ao centro do tornozelo. Use como referência para analisar o desvio no joelho.",
  mad: "MAD (desvio do eixo mecânico): mede o desvio do centro do joelho em relação ao eixo mecânico global.",
  cora: "CORA (centro de rotação da angulação): localiza a interseção entre eixo proximal e eixo distal.",
  ldfa: "mLDFA (ângulo femoral distal lateral mecânico): avalia a orientação distal do fêmur no plano frontal.",
  mpta: "MPTA (ângulo tibial proximal medial): avalia a orientação proximal da tíbia no plano frontal.",
  apdfa: "aPDFA (ângulo femoral distal posterior anatômico): avalia a orientação distal do fêmur no plano sagital.",
  ppta: "PPTA (ângulo tibial proximal posterior): avalia a inclinação posterior da tíbia proximal no plano sagital.",
  adta: "ADTA (ângulo tibial distal anterior): avalia a orientação distal da tíbia no plano sagital."
};

const toolSpecs = {
  select: { label: "Selecionar", points: 0, hint: "Arraste um ponto para ajustar a medida." },
  zoom: { label: "Zoom", points: 0, hint: "Clique para aproximar. No tablet, use pinça com dois dedos." },
  pan: { label: "Mover", points: 0, hint: "Arraste a radiografia ampliada sem alterar os pontos." },
  line: { label: "Linha", points: 2, hint: "Clique em 2 pontos para desenhar uma linha independente." },
  angle3: { label: "Ângulo 3 pontos", points: 3, hint: "Marque A, vértice, B." },
  lineAngle: { label: "Ângulo entre linhas", points: 4, hint: "Marque dois pontos da primeira linha e dois da segunda." },
  ruler: { label: "Régua", points: 2, hint: "Marque dois pontos para medir distância." },
  calibrate: { label: "Calibrar escala", points: 2, hint: "Marque as bordas do marcador e informe o tamanho real em mm." },
  annotation: { label: "Anotação", points: 1, hint: "Digite o texto na lateral e clique no ponto em que ele deve aparecer." },
  fragment: { label: "Fragmento", points: null, hint: "Clique ao redor do osso. Depois use Fechar fragmento." },
  pivot: { label: "Pivô", points: 1, hint: "Clique onde o último fragmento deve girar." },
  mechanicalAxis: { label: "Eixo mecânico", points: 2, hint: "Marque centro da cabeça femoral e centro do tornozelo." },
  mad: { label: "MAD (desvio do eixo mecânico)", points: 3, hint: "Marque centro femoral, centro do tornozelo e centro do joelho." },
  cora: { label: "CORA (centro de rotação da angulação)", points: 4, hint: "Marque dois pontos do eixo proximal e dois pontos do eixo distal." },
  ldfa: { label: "mLDFA (ângulo femoral distal lateral mecânico)", points: 4, hint: "Marque centro femoral, centro do joelho e dois pontos da linha articular distal femoral." },
  mpta: { label: "MPTA (ângulo tibial proximal medial)", points: 4, hint: "Marque centro do joelho, centro do tornozelo e dois pontos da linha articular proximal tibial." },
  apdfa: { label: "aPDFA (ângulo femoral distal posterior anatômico)", points: 4, hint: "No perfil, marque dois pontos do eixo anatômico femoral e dois pontos da linha articular distal femoral." },
  ppta: { label: "PPTA (ângulo tibial proximal posterior)", points: 4, hint: "No perfil, marque dois pontos do eixo anatômico tibial e dois pontos da linha articular proximal tibial." },
  adta: { label: "ADTA (ângulo tibial distal anterior)", points: 4, hint: "No perfil, marque dois pontos do eixo anatômico tibial e dois pontos da linha articular distal tibial." }
};

let image = null;
let activeTool = "select";
let pending = [];
let measurements = [];
let scale = 1;
let pan = { x: 0, y: 0 };
let draggingPoint = null;
let isPanning = false;
let lastMouse = null;
let calibration = { pixelsPerMm: null, markerMm: null };
let lineThickness = Number(lineThicknessInput.value);
let lineDivisions = Number(lineDivisionsInput.value);
let extendLines = extendLinesToggle.checked;
let autoAngles = autoAnglesToggle.checked;
let nudgeStep = Number(nudgeStepInput.value);
let rotationStep = Number(rotationStepInput.value);
let imageBrightness = Number(brightnessInput.value);
let imageContrast = Number(contrastInput.value);
let invertImage = invertImageToggle.checked;
let currentColor = "#66d9c4";
let redoStack = [];
let renderState = null;
let draggingLine = null;
let draggingFragment = null;
let selectedLine = null;
let selectedFragment = null;
let filteredImageCache = null;
let activePointers = new Map();
let pinchGesture = null;

function activeCtx() {
  return renderState ? renderState.ctx : ctx;
}

function activeWidth() {
  return renderState ? renderState.width : canvas.width;
}

function activeHeight() {
  return renderState ? renderState.height : canvas.height;
}

function activeScale() {
  return renderState ? renderState.scale : scale;
}

function activePan() {
  return renderState ? renderState.pan : pan;
}

function resizeCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = Math.max(900, Math.floor(rect.width * window.devicePixelRatio));
  canvas.height = Math.max(620, Math.floor(rect.height * window.devicePixelRatio));
  canvas.style.width = rect.width + "px";
  canvas.style.height = rect.height + "px";
  draw();
}

function imageToScreen(point) {
  const localScale = activeScale();
  const localPan = activePan();
  return { x: point.x * localScale + localPan.x, y: point.y * localScale + localPan.y };
}

function screenToImage(point) {
  return { x: (point.x - pan.x) / scale, y: (point.y - pan.y) / scale };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function polygonCentroid(points) {
  const total = points.reduce(function(acc, point) {
    return { x: acc.x + point.x, y: acc.y + point.y };
  }, { x: 0, y: 0 });
  return { x: total.x / points.length, y: total.y / points.length };
}

function rotatePoint(point, pivot, degrees) {
  const rad = degrees * Math.PI / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = point.x - pivot.x;
  const dy = point.y - pivot.y;
  return {
    x: pivot.x + dx * cos - dy * sin,
    y: pivot.y + dx * sin + dy * cos
  };
}

function angleBetweenVectors(v1, v2) {
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
  if (!mag) return 0;
  const rad = Math.acos(Math.max(-1, Math.min(1, dot / mag)));
  return rad * 180 / Math.PI;
}

function lineAngle(a, b, c, d) {
  const angle = angleBetweenVectors({ x: b.x - a.x, y: b.y - a.y }, { x: d.x - c.x, y: d.y - c.y });
  return angle > 90 ? 180 - angle : angle;
}

function lineDirection(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  if (!length) return { x: 0, y: 0, length: 0 };
  return { x: dx / length, y: dy / length, length: length };
}

function pointOnLineProjection(point, a, b) {
  const dir = lineDirection(a, b);
  if (!dir.length) return { x: a.x, y: a.y };
  const ap = { x: point.x - a.x, y: point.y - a.y };
  const t = ap.x * dir.x + ap.y * dir.y;
  return { x: a.x + dir.x * t, y: a.y + dir.y * t };
}

function lineIntersection(a, b, c, d) {
  const denominator = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
  if (Math.abs(denominator) < 0.000001) return null;
  const left = a.x * b.y - a.y * b.x;
  const right = c.x * d.y - c.y * d.x;
  return {
    x: (left * (c.x - d.x) - (a.x - b.x) * right) / denominator,
    y: (left * (c.y - d.y) - (a.y - b.y) * right) / denominator
  };
}

function angleDiff(from, to) {
  const full = Math.PI * 2;
  return ((to - from) % full + full) % full;
}

function lineSegmentsForMeasurement(measure) {
  if (measure.tool === "line" || measure.tool === "ruler") {
    return [{ key: "0", indexes: [0, 1], color: measure.color }];
  }
  if (measure.tool === "lineAngle") {
    return [
      { key: "0", indexes: [0, 1], color: measure.color },
      { key: "1", indexes: [2, 3], color: measure.color || "#7aa7ff" }
    ];
  }
  if (measure.tool === "mechanicalAxis") {
    return [
      { key: "0", indexes: [0, 1], color: measure.color || "#f2c14e" }
    ];
  }
  if (measure.tool === "mad") {
    return [
      { key: "0", indexes: [0, 1], color: measure.color || "#f2c14e" }
    ];
  }
  if (measure.tool === "cora") {
    return [
      { key: "0", indexes: [0, 1], color: measure.color },
      { key: "1", indexes: [2, 3], color: "#7aa7ff" }
    ];
  }
  if (isArticularAngleTool(measure.tool)) {
    return [
      { key: "0", indexes: [0, 1], color: measure.color },
      { key: "1", indexes: [2, 3], color: "#7aa7ff" }
    ];
  }
  return [];
}

function isSegmentDeleted(measure, segmentKey) {
  return measure.deletedSegments && measure.deletedSegments.includes(segmentKey);
}

function setSelectedLine(line) {
  selectedLine = line;
  if (line) selectedFragment = null;
  if (line && activeTool !== "select") activeTool = "select";
  updateLineControls();
}

function setSelectedFragment(fragment) {
  selectedFragment = fragment;
  if (fragment) setSelectedLine(null);
  renderMeasurements();
}

function segmentName(measure, segmentKey) {
  if (measure.tool === "line" || measure.tool === "ruler" || measure.tool === "mechanicalAxis" || measure.tool === "mad") return "linha";
  if (measure.tool === "lineAngle") return segmentKey === "0" ? "linha 1" : "linha 2";
  if (measure.tool === "cora") return segmentKey === "0" ? "eixo proximal" : "eixo distal";
  if (isArticularAngleTool(measure.tool)) return segmentKey === "0" ? "eixo" : "linha articular";
  return "linha";
}

function selectedLineLabel() {
  if (!selectedLine) return "";
  return segmentName(selectedLine.measure, selectedLine.segmentKey);
}

function updateLineControls() {
  const enabled = Boolean(selectedLine);
  if (lineControlStatus) lineControlStatus.textContent = enabled ? selectedLineLabel() + " selecionada. Arraste na imagem ou use os botões." : "Selecione uma linha.";
  lineControlButtons.forEach(function(button) { button.disabled = !enabled; });
}

function selectLineSegment(measure, segmentKey) {
  const segment = lineSegmentsForMeasurement(measure).find(function(item) { return item.key === segmentKey; });
  if (!segment || isSegmentDeleted(measure, segment.key) || measure.hidden || measure.locked) {
    setSelectedLine(null);
    return;
  }
  activeTool = "select";
  document.querySelectorAll(".tool").forEach(function(button) {
    button.classList.toggle("is-active", button.dataset.tool === "select");
  });
  activeToolLabel.textContent = toolSpecs.select.label;
  toolHint.textContent = "Linha selecionada. Arraste a linha inteira, ajuste as pontas ou use os botões de ajuste fino.";
  pending = [];
  selectedLine = { measure: measure, segmentKey: segment.key, indexes: segment.indexes, distance: 0 };
  updateLineControls();
  updatePending();
  renderMeasurements();
  draw();
}

function visiblePointIndexes(measure) {
  const hidden = new Set();
  lineSegmentsForMeasurement(measure).forEach(function(segment) {
    if (!isSegmentDeleted(measure, segment.key)) return;
    segment.indexes.forEach(function(index) { hidden.add(index); });
  });
  return measure.points.map(function(_, index) { return index; }).filter(function(index) { return !hidden.has(index); });
}

function pointLineSignedDistance(point, a, b) {
  const numerator = (b.x - a.x) * (a.y - point.y) - (a.x - point.x) * (b.y - a.y);
  const denominator = distance(a, b);
  return denominator ? numerator / denominator : 0;
}

function pxToMm(value) {
  return calibration.pixelsPerMm ? value / calibration.pixelsPerMm : value;
}

function lengthResult(valuePx) {
  if (calibration.pixelsPerMm) return { value: pxToMm(valuePx), unit: "mm" };
  return { value: valuePx, unit: "px", note: "Calibre a escala para converter em mm." };
}

function classifyMeasurement(tool, pts, measurement) {
  if (tool === "calibrate") {
    const markerMm = measurement && measurement.markerMm ? measurement.markerMm : calibration.markerMm;
    return { label: "Calibração", value: markerMm || distance(pts[0], pts[1]), unit: markerMm ? "mm" : "px", note: markerMm ? "Escala aplicada. Os pontos de calibração ficam ocultos para não poluir a radiografia." : "Escala ainda não aplicada." };
  }
  if (tool === "ruler") {
    const result = lengthResult(distance(pts[0], pts[1]));
    return { label: "Distância", value: result.value, unit: result.unit, note: result.note };
  }
  if (tool === "line") {
    const result = lengthResult(distance(pts[0], pts[1]));
    return { label: "Linha", value: result.value, unit: result.unit, note: "Linha independente selecionável, móvel e apagável." + (result.note ? " " + result.note : "") };
  }
  if (tool === "annotation") {
    return { label: "Anotação", value: 0, unit: "", note: measurement && measurement.text ? measurement.text : "Observação" };
  }
  if (tool === "fragment") {
    return { label: "Fragmento", value: measurement && measurement.rotation ? measurement.rotation : 0, unit: "graus", note: "Rotação simulada do fragmento em torno do pivô." };
  }
  if (tool === "angle3") {
    const a = pts[0], vertex = pts[1], b = pts[2];
    return { label: "Ângulo 3 pontos", value: angleBetweenVectors({ x: a.x - vertex.x, y: a.y - vertex.y }, { x: b.x - vertex.x, y: b.y - vertex.y }), unit: "graus" };
  }
  if (tool === "lineAngle") {
    if (measurement && (isSegmentDeleted(measurement, "0") || isSegmentDeleted(measurement, "1"))) {
      return { label: "Ângulo entre linhas", value: 0, unit: "graus", note: "Uma das linhas foi removida." };
    }
    return { label: "Ângulo entre linhas", value: lineAngle(pts[0], pts[1], pts[2], pts[3]), unit: "graus" };
  }
  if (tool === "mechanicalAxis") {
    if (measurement && isSegmentDeleted(measurement, "0")) {
      return { label: "Eixo mecânico", value: 0, unit: "", note: "Linha removida." };
    }
    const result = lengthResult(distance(pts[0], pts[1]));
    return { label: "Eixo mecânico", value: result.value, unit: result.unit, note: "Centro da cabeça femoral ao centro do tornozelo." + (result.note ? " " + result.note : "") };
  }
  if (tool === "mad") {
    if (measurement && isSegmentDeleted(measurement, "0")) return { label: "MAD (desvio do eixo mecânico)", value: 0, unit: "", note: "Eixo removido." };
    const valuePx = pointLineSignedDistance(pts[2], pts[0], pts[1]);
    const result = lengthResult(Math.abs(valuePx));
    const side = valuePx < 0 ? "lado negativo do eixo marcado" : "lado positivo do eixo marcado";
    return { label: "MAD (desvio do eixo mecânico)", value: result.value, unit: result.unit, note: (result.note ? result.note + " | " : "") + side + ". Interpretar medial/lateral conforme lado e orientação da radiografia." };
  }
  if (tool === "cora") {
    if (measurement && (isSegmentDeleted(measurement, "0") || isSegmentDeleted(measurement, "1"))) return { label: "CORA (centro de rotação da angulação)", value: 0, unit: "", note: "Um dos eixos foi removido." };
    const center = lineIntersection(pts[0], pts[1], pts[2], pts[3]);
    return { label: "CORA (centro de rotação da angulação)", value: lineAngle(pts[0], pts[1], pts[2], pts[3]), unit: "graus", note: center ? "Interseção dos eixos proximal e distal." : "Eixos paralelos ou sem interseção numérica estável." };
  }
  if (isArticularAngleTool(tool)) {
    const meta = articularAngleMeta[tool];
    if (measurement && (isSegmentDeleted(measurement, "0") || isSegmentDeleted(measurement, "1"))) return { label: meta.label, value: 0, unit: "", note: "Uma das linhas foi removida." };
    return { label: meta.label, value: lineAngle(pts[0], pts[1], pts[2], pts[3]), unit: "graus", normal: meta.normal, note: meta.guide };
  }
  return { label: toolSpecs[tool].label, value: 0, unit: "" };
}

function fitImage() {
  if (!image) return;
  const padding = 60 * window.devicePixelRatio;
  scale = Math.min((canvas.width - padding) / image.width, (canvas.height - padding) / image.height);
  pan = { x: (canvas.width - image.width * scale) / 2, y: (canvas.height - image.height * scale) / 2 };
  updateZoomLabel();
  draw();
}

function drawPoint(point, label, color) {
  const target = activeCtx();
  const p = imageToScreen(point);
  const radius = 6 * window.devicePixelRatio;
  target.beginPath();
  target.arc(p.x, p.y, radius, 0, Math.PI * 2);
  target.fillStyle = color || "#66d9c4";
  target.fill();
  target.lineWidth = 2 * window.devicePixelRatio;
  target.strokeStyle = "#101412";
  target.stroke();
  if (!label) return;
  target.fillStyle = "#f2f4ef";
  target.font = 12 * window.devicePixelRatio + "px sans-serif";
  target.fillText(label, p.x + 9 * window.devicePixelRatio, p.y - 9 * window.devicePixelRatio);
}

function drawLine(a, b, color) {
  const target = activeCtx();
  const p1 = imageToScreen(a);
  const p2 = imageToScreen(b);
  target.beginPath();
  target.moveTo(p1.x, p1.y);
  target.lineTo(p2.x, p2.y);
  target.lineWidth = lineThickness * window.devicePixelRatio;
  target.strokeStyle = color || "#66d9c4";
  target.stroke();
}

function extendedScreenEndpoints(a, b) {
  const p1 = imageToScreen(a);
  const p2 = imageToScreen(b);
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const length = Math.hypot(dx, dy);
  if (!length) return null;
  const margin = 40 * window.devicePixelRatio;
  const t = (Math.max(activeWidth(), activeHeight()) + margin) / length;
  return {
    start: { x: p1.x - dx * t, y: p1.y - dy * t },
    end: { x: p1.x + dx * t, y: p1.y + dy * t }
  };
}

function drawAxisLine(a, b, color) {
  if (!extendLines) {
    drawLine(a, b, color);
    return;
  }
  const endpoints = extendedScreenEndpoints(a, b);
  if (!endpoints) return;
  const target = activeCtx();
  target.save();
  target.beginPath();
  target.rect(0, 0, activeWidth(), activeHeight());
  target.clip();
  target.beginPath();
  target.moveTo(endpoints.start.x, endpoints.start.y);
  target.lineTo(endpoints.end.x, endpoints.end.y);
  target.lineWidth = lineThickness * window.devicePixelRatio;
  target.strokeStyle = color || "#66d9c4";
  target.stroke();
  target.restore();
}

function drawLineDivisions(a, b, divisions, color) {
  if (!divisions || divisions <= 1) return;
  const target = activeCtx();
  const dir = lineDirection(a, b);
  if (!dir.length) return;
  const normal = { x: -dir.y, y: dir.x };
  const tick = 8 / activeScale();
  target.save();
  target.lineWidth = Math.max(1.5, lineThickness - 1) * window.devicePixelRatio;
  target.strokeStyle = color || "#f2f4ef";
  for (let index = 1; index < divisions; index += 1) {
    const ratio = index / divisions;
    const point = { x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio };
    const start = imageToScreen({ x: point.x - normal.x * tick, y: point.y - normal.y * tick });
    const end = imageToScreen({ x: point.x + normal.x * tick, y: point.y + normal.y * tick });
    target.beginPath();
    target.moveTo(start.x, start.y);
    target.lineTo(end.x, end.y);
    target.stroke();
  }
  target.restore();
}

function drawHighlightedLine(a, b, color) {
  const target = activeCtx();
  const endpoints = extendLines ? extendedScreenEndpoints(a, b) : null;
  const p1 = endpoints ? endpoints.start : imageToScreen(a);
  const p2 = endpoints ? endpoints.end : imageToScreen(b);
  target.save();
  target.beginPath();
  target.moveTo(p1.x, p1.y);
  target.lineTo(p2.x, p2.y);
  target.lineWidth = (lineThickness + 6) * window.devicePixelRatio;
  target.strokeStyle = "rgba(242, 244, 239, 0.28)";
  target.stroke();
  target.restore();
  if (extendLines) drawAxisLine(a, b, color);
  else drawLine(a, b, color);
}

function drawText(point, value, color) {
  const target = activeCtx();
  const p = imageToScreen(point);
  target.font = 14 * window.devicePixelRatio + "px sans-serif";
  const padding = 6 * window.devicePixelRatio;
  const metrics = target.measureText(value);
  const width = metrics.width + padding * 2;
  const height = 24 * window.devicePixelRatio;
  target.fillStyle = "rgba(16, 20, 18, 0.82)";
  target.fillRect(p.x, p.y - height, width, height);
  target.strokeStyle = color || "#66d9c4";
  target.lineWidth = 1.5 * window.devicePixelRatio;
  target.strokeRect(p.x, p.y - height, width, height);
  target.fillStyle = color || "#f2f4ef";
  target.fillText(value, p.x + padding, p.y - 8 * window.devicePixelRatio);
}

function drawAngleLabel(point, value, color) {
  const target = activeCtx();
  const p = imageToScreen(point);
  const text = value.toFixed(1) + "°";
  target.font = 12 * window.devicePixelRatio + "px sans-serif";
  const padding = 5 * window.devicePixelRatio;
  const width = target.measureText(text).width + padding * 2;
  const height = 20 * window.devicePixelRatio;
  target.fillStyle = "rgba(16, 20, 18, 0.86)";
  target.fillRect(p.x - width / 2, p.y - height / 2, width, height);
  target.strokeStyle = color || "#f2c14e";
  target.lineWidth = 1 * window.devicePixelRatio;
  target.strokeRect(p.x - width / 2, p.y - height / 2, width, height);
  target.fillStyle = color || "#f2c14e";
  target.fillText(text, p.x - width / 2 + padding, p.y + 4 * window.devicePixelRatio);
}

function isPointInsideActiveCanvas(point, margin) {
  const p = imageToScreen(point);
  const localMargin = margin || 0;
  return p.x >= -localMargin && p.y >= -localMargin && p.x <= activeWidth() + localMargin && p.y <= activeHeight() + localMargin;
}

function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function fallbackAngleLabelPoint(a, b, c, d) {
  const first = midpoint(a, b);
  const second = midpoint(c, d);
  return midpoint(first, second);
}

function drawPrimaryLineAngleLabel(a, b, c, d, color) {
  const center = lineIntersection(a, b, c, d);
  const labelPoint = center && isPointInsideActiveCanvas(center, 80 * window.devicePixelRatio) ? center : fallbackAngleLabelPoint(a, b, c, d);
  drawAngleLabel(labelPoint, lineAngle(a, b, c, d), color);
}

function drawFourLineAngles(a, b, c, d, color) {
  const center = lineIntersection(a, b, c, d);
  if (!center || !isPointInsideActiveCanvas(center, 140 * window.devicePixelRatio)) {
    drawPrimaryLineAngleLabel(a, b, c, d, color);
    return;
  }
  const firstAngle = Math.atan2(b.y - a.y, b.x - a.x);
  const secondAngle = Math.atan2(d.y - c.y, d.x - c.x);
  const rays = [
    firstAngle,
    firstAngle + Math.PI,
    secondAngle,
    secondAngle + Math.PI
  ].sort(function(left, right) { return left - right; });
  const radius = Math.max(34 / activeScale(), 18);
  rays.forEach(function(angle, index) {
    const next = rays[(index + 1) % rays.length];
    const gap = angleDiff(angle, next);
    if (gap < 0.01) return;
    const mid = angle + gap / 2;
    drawAngleLabel({
      x: center.x + Math.cos(mid) * radius,
      y: center.y + Math.sin(mid) * radius
    }, gap * 180 / Math.PI, color);
  });
}

function drawPolygon(points, color) {
  if (!points.length) return;
  const target = activeCtx();
  const first = imageToScreen(points[0]);
  target.beginPath();
  target.moveTo(first.x, first.y);
  points.slice(1).forEach(function(point) {
    const p = imageToScreen(point);
    target.lineTo(p.x, p.y);
  });
  target.closePath();
  target.lineWidth = lineThickness * window.devicePixelRatio;
  target.strokeStyle = color || "#66d9c4";
  target.stroke();
}

function rotatedFragmentPoints(measure) {
  const pivot = measure.pivot || polygonCentroid(measure.points);
  const rotation = measure.rotation || 0;
  return measure.points.map(function(point) { return rotatePoint(point, pivot, rotation); });
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const current = polygon[index];
    const before = polygon[previous];
    const intersects = current.y > point.y !== before.y > point.y &&
      point.x < (before.x - current.x) * (point.y - current.y) / ((before.y - current.y) || 0.000001) + current.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function nearestFragment(screenPoint) {
  const imagePoint = screenToImage(screenPoint);
  for (let index = measurements.length - 1; index >= 0; index -= 1) {
    const measure = measurements[index];
    if (measure.tool !== "fragment" || measure.hidden || measure.locked) continue;
    if (pointInPolygon(imagePoint, rotatedFragmentPoints(measure))) return measure;
  }
  return null;
}

function drawFragment(measure, color) {
  const target = activeCtx();
  const pivot = measure.pivot || polygonCentroid(measure.points);
  const rotation = measure.rotation || 0;
  const rotated = rotatedFragmentPoints(measure);

  if (image && rotation !== 0) {
    const pivotScreen = imageToScreen(pivot);
    target.save();
    target.translate(pivotScreen.x, pivotScreen.y);
    target.rotate(rotation * Math.PI / 180);
    target.translate(-pivotScreen.x, -pivotScreen.y);
    target.beginPath();
    measure.points.forEach(function(point, index) {
      const p = imageToScreen(point);
      if (index === 0) target.moveTo(p.x, p.y);
      else target.lineTo(p.x, p.y);
    });
    target.closePath();
    target.clip();
    target.globalAlpha = 0.92;
    const localScale = activeScale();
    const localPan = activePan();
    target.drawImage(filteredImage(), localPan.x, localPan.y, image.width * localScale, image.height * localScale);
    target.restore();
  }

  target.save();
  target.globalAlpha = 0.2;
  const first = imageToScreen(rotated[0]);
  target.beginPath();
  target.moveTo(first.x, first.y);
  rotated.slice(1).forEach(function(point) {
    const p = imageToScreen(point);
    target.lineTo(p.x, p.y);
  });
  target.closePath();
  target.fillStyle = color || "#66d9c4";
  target.fill();
  target.restore();
  drawPolygon(rotated, color);
  drawPoint(pivot, "P", color);
}

function filteredImage() {
  if (!image) return image;
  const key = [imageBrightness, imageContrast, invertImage ? 1 : 0, image.width, image.height].join("|");
  if (filteredImageCache && filteredImageCache.key === key) return filteredImageCache.canvas;
  const source = document.createElement("canvas");
  source.width = image.width;
  source.height = image.height;
  const sourceCtx = source.getContext("2d", { willReadFrequently: true });
  sourceCtx.drawImage(image, 0, 0);
  const data = sourceCtx.getImageData(0, 0, source.width, source.height);
  const brightness = imageBrightness / 100;
  const contrast = imageContrast / 100;
  const intercept = 128 * (1 - contrast);
  for (let index = 0; index < data.data.length; index += 4) {
    for (let channel = 0; channel < 3; channel += 1) {
      let value = data.data[index + channel] * brightness;
      value = value * contrast + intercept;
      if (invertImage) value = 255 - value;
      data.data[index + channel] = Math.max(0, Math.min(255, value));
    }
  }
  sourceCtx.putImageData(data, 0, 0);
  filteredImageCache = { key: key, canvas: source };
  return source;
}

function resetImageControls() {
  imageBrightness = 100;
  imageContrast = 100;
  invertImage = false;
  brightnessInput.value = "100";
  contrastInput.value = "100";
  invertImageToggle.checked = false;
  filteredImageCache = null;
  draw();
}

function drawMeasurement(measure) {
  if (measure.hidden) return;
  const pts = measure.points;
  if (measure.tool === "calibrate") return;
  const color = measure.color || (measure.tool === "mechanicalAxis" ? "#f2c14e" : "#66d9c4");
  if (measure.tool === "angle3") {
    drawLine(pts[1], pts[0], color);
    drawLine(pts[1], pts[2], color);
    if (autoAngles) drawAngleLabel(pts[1], classifyMeasurement("angle3", pts, measure).value, color);
  } else if (measure.tool === "line") {
    const selected = selectedLine && selectedLine.measure === measure && selectedLine.segmentKey === "0";
    if (selected) drawHighlightedLine(pts[0], pts[1], color);
    else drawAxisLine(pts[0], pts[1], color);
    drawLineDivisions(pts[0], pts[1], measure.divisions, color);
  } else if (measure.tool === "lineAngle") {
    if (!isSegmentDeleted(measure, "0")) {
      const selected = selectedLine && selectedLine.measure === measure && selectedLine.segmentKey === "0";
      if (selected) drawHighlightedLine(pts[0], pts[1], color);
      else drawAxisLine(pts[0], pts[1], color);
    }
    if (!isSegmentDeleted(measure, "1")) {
      const selected = selectedLine && selectedLine.measure === measure && selectedLine.segmentKey === "1";
      if (selected) drawHighlightedLine(pts[2], pts[3], "#7aa7ff");
      else drawAxisLine(pts[2], pts[3], "#7aa7ff");
    }
    if (autoAngles && !isSegmentDeleted(measure, "0") && !isSegmentDeleted(measure, "1")) drawFourLineAngles(pts[0], pts[1], pts[2], pts[3], color);
  } else if (measure.tool === "ruler" || measure.tool === "calibrate") {
    drawLine(pts[0], pts[1], color);
  } else if (measure.tool === "annotation") {
    drawText(pts[0], measure.text || "Observação", color);
    drawPoint(pts[0], "", color);
    return;
  } else if (measure.tool === "fragment") {
    drawFragment(measure, color);
    return;
  } else if (measure.tool === "mechanicalAxis") {
    if (!isSegmentDeleted(measure, "0")) {
      const selected = selectedLine && selectedLine.measure === measure && selectedLine.segmentKey === "0";
      if (selected) drawHighlightedLine(pts[0], pts[1], color);
      else drawAxisLine(pts[0], pts[1], color);
    }
  } else if (measure.tool === "mad") {
    if (!isSegmentDeleted(measure, "0")) {
      const selected = selectedLine && selectedLine.measure === measure && selectedLine.segmentKey === "0";
      if (selected) drawHighlightedLine(pts[0], pts[1], color);
      else drawAxisLine(pts[0], pts[1], color);
      const projection = pointOnLineProjection(pts[2], pts[0], pts[1]);
      drawLine(pts[2], projection, "#ef6f6c");
      drawPoint(projection, "", "#ef6f6c");
      drawText(midpoint(pts[2], projection), classifyMeasurement("mad", pts, measure).value.toFixed(1) + " " + classifyMeasurement("mad", pts, measure).unit, "#ef6f6c");
    }
  } else if (measure.tool === "cora") {
    if (!isSegmentDeleted(measure, "0")) {
      const selected = selectedLine && selectedLine.measure === measure && selectedLine.segmentKey === "0";
      if (selected) drawHighlightedLine(pts[0], pts[1], color);
      else drawAxisLine(pts[0], pts[1], color);
    }
    if (!isSegmentDeleted(measure, "1")) {
      const selected = selectedLine && selectedLine.measure === measure && selectedLine.segmentKey === "1";
      if (selected) drawHighlightedLine(pts[2], pts[3], "#7aa7ff");
      else drawAxisLine(pts[2], pts[3], "#7aa7ff");
    }
    if (!isSegmentDeleted(measure, "0") && !isSegmentDeleted(measure, "1")) {
      const center = lineIntersection(pts[0], pts[1], pts[2], pts[3]);
      if (center) drawPoint(center, "", "#f2c14e");
      if (autoAngles) drawPrimaryLineAngleLabel(pts[0], pts[1], pts[2], pts[3], color);
    }
  } else if (isArticularAngleTool(measure.tool)) {
    if (!isSegmentDeleted(measure, "0")) {
      const selected = selectedLine && selectedLine.measure === measure && selectedLine.segmentKey === "0";
      if (selected) drawHighlightedLine(pts[0], pts[1], color);
      else drawAxisLine(pts[0], pts[1], color);
    }
    if (!isSegmentDeleted(measure, "1")) {
      const selected = selectedLine && selectedLine.measure === measure && selectedLine.segmentKey === "1";
      if (selected) drawHighlightedLine(pts[2], pts[3], "#7aa7ff");
      else drawAxisLine(pts[2], pts[3], "#7aa7ff");
    }
    if (autoAngles && !isSegmentDeleted(measure, "0") && !isSegmentDeleted(measure, "1")) drawPrimaryLineAngleLabel(pts[0], pts[1], pts[2], pts[3], color);
  }
  visiblePointIndexes(measure).forEach(function(index) { drawPoint(pts[index], String(index + 1), color); });
}

function draw() {
  const target = activeCtx();
  target.clearRect(0, 0, activeWidth(), activeHeight());
  if (image) {
    const localScale = activeScale();
    const localPan = activePan();
    target.imageSmoothingEnabled = true;
    target.drawImage(filteredImage(), localPan.x, localPan.y, image.width * localScale, image.height * localScale);
  }
  measurements.forEach(drawMeasurement);
  pending.forEach(function(point, index) { drawPoint(point, String(index + 1), "#ef6f6c"); });
}

function renderMeasurements() {
  measurementsEl.innerHTML = "";
  measurements.forEach(function(measure, index) {
    const result = classifyMeasurement(measure.tool, measure.points, measure);
    const article = document.createElement("article");
    article.className = "measure" + (measure.hidden ? " is-hidden" : "") + ((selectedLine && selectedLine.measure === measure) || selectedFragment === measure ? " is-selected" : "");
    const details = [result.normal, result.note, measurementGuides[measure.tool]].filter(Boolean).join(" | ") || "Medida criada manualmente sobre a imagem.";
    const valueText = measure.tool === "annotation" ? "" : result.value.toFixed(1) + " " + result.unit;
    const fragmentActions = measure.tool === "fragment" ? "<div class=\"fragment-actions\"><button data-action=\"rotateLeft\" data-id=\"" + measure.id + "\">-1</button><button data-action=\"rotateReset\" data-id=\"" + measure.id + "\">0</button><button data-action=\"rotateRight\" data-id=\"" + measure.id + "\">+1</button></div>" : "";
    const segmentActions = lineSegmentsForMeasurement(measure).filter(function(segment) {
      return !isSegmentDeleted(measure, segment.key);
    }).map(function(segment) {
      const selected = selectedLine && selectedLine.measure === measure && selectedLine.segmentKey === segment.key;
      return "<button data-action=\"selectLine\" data-id=\"" + measure.id + "\" data-segment=\"" + segment.key + "\">" + (selected ? "Selecionada: " : "Selecionar ") + segmentName(measure, segment.key) + "</button>";
    }).join("");
    const segmentBlock = segmentActions ? "<div class=\"segment-actions\">" + segmentActions + "</div>" : "";
    article.innerHTML = "<header><strong>" + (index + 1) + ". " + result.label + "</strong><b>" + valueText + "</b></header><small>" + details + "</small>" + segmentBlock + "<div class=\"measure-actions\"><button data-action=\"toggle\" data-id=\"" + measure.id + "\">" + (measure.hidden ? "Mostrar" : "Ocultar") + "</button><button data-action=\"lock\" data-id=\"" + measure.id + "\">" + (measure.locked ? "Destravar" : "Travar") + "</button><button data-action=\"delete\" data-id=\"" + measure.id + "\">Apagar</button></div>" + fragmentActions;
    measurementsEl.appendChild(article);
  });
}

function updateCalibrationStatus() {
  if (!calibration.pixelsPerMm) {
    calibrationStatus.textContent = "Escala não calibrada.";
    return;
  }
  calibrationStatus.textContent = "Escala: 1 mm = " + calibration.pixelsPerMm.toFixed(2) + " px.";
}

function recomputeCalibration() {
  calibration = { pixelsPerMm: null, markerMm: null };
  for (let index = measurements.length - 1; index >= 0; index -= 1) {
    const measure = measurements[index];
    if (measure.tool === "calibrate" && measure.markerMm > 0) {
      const markerPx = distance(measure.points[0], measure.points[1]);
      if (markerPx > 0) calibration = { pixelsPerMm: markerPx / measure.markerMm, markerMm: measure.markerMm };
      break;
    }
  }
  updateCalibrationStatus();
}

function updatePending() {
  const spec = toolSpecs[activeTool];
  if (activeTool === "fragment") {
    pendingPoints.textContent = pending.length ? pending.length + " pontos no contorno. Use Fechar fragmento." : "Clique ao redor do fragmento.";
    return;
  }
  pendingPoints.textContent = spec.points ? pending.length + "/" + spec.points + " pontos marcados." : "Nenhum ponto pendente.";
}

function setTool(tool) {
  activeTool = tool;
  pending = [];
  if (tool !== "select") setSelectedLine(null);
  document.querySelectorAll(".tool").forEach(function(button) {
    button.classList.toggle("is-active", button.dataset.tool === tool);
  });
  activeToolLabel.textContent = toolSpecs[tool].label;
  toolHint.textContent = toolSpecs[tool].hint;
  updatePending();
  draw();
}

function finishMeasurement() {
  const measurement = { id: crypto.randomUUID(), tool: activeTool, color: currentColor, hidden: false, locked: false, points: pending.map(function(point) { return { x: point.x, y: point.y }; }) };
  if (activeTool === "calibrate") {
    const markerMm = Number(calibrationSizeInput.value);
    if (markerMm > 0) measurement.markerMm = markerMm;
  }
  if (activeTool === "annotation") {
    measurement.text = annotationTextInput.value.trim() || "Observação";
  }
  if (activeTool === "line") {
    measurement.divisions = lineDivisions;
  }
  setSelectedLine(null);
  measurements.push(measurement);
  recomputeCalibration();
  redoStack = [];
  pending = [];
  renderMeasurements();
  updatePending();
  draw();
}

function finishFragment() {
  if (pending.length < 3) {
    pendingPoints.textContent = "Marque pelo menos 3 pontos para fechar o fragmento.";
    return;
  }
  const points = pending.map(function(point) { return { x: point.x, y: point.y }; });
  measurements.push({
    id: crypto.randomUUID(),
    tool: "fragment",
    color: currentColor,
    hidden: false,
    locked: false,
    points: points,
    pivot: polygonCentroid(points),
    rotation: 0
  });
  redoStack = [];
  pending = [];
  setSelectedFragment(measurements[measurements.length - 1]);
  renderMeasurements();
  updatePending();
  draw();
}

function nearestPoint(screenPoint) {
  let best = null;
  measurements.forEach(function(measure) {
    if (measure.hidden || measure.locked || measure.tool === "calibrate") return;
    measure.points.forEach(function(point) {
      const screen = imageToScreen(point);
      const d = distance(screen, screenPoint);
      if (d < 14 * window.devicePixelRatio && (!best || d < best.distance)) best = { point: point, measure: measure, distance: d };
    });
  });
  return best;
}

function pointToSegmentDistance(point, a, b) {
  const ab = { x: b.x - a.x, y: b.y - a.y };
  const ap = { x: point.x - a.x, y: point.y - a.y };
  const lengthSq = ab.x * ab.x + ab.y * ab.y;
  if (!lengthSq) return distance(point, a);
  const t = Math.max(0, Math.min(1, (ap.x * ab.x + ap.y * ab.y) / lengthSq));
  return distance(point, { x: a.x + ab.x * t, y: a.y + ab.y * t });
}

function nearestLine(screenPoint) {
  let best = null;
  const imagePoint = screenToImage(screenPoint);
  measurements.forEach(function(measure) {
    if (measure.hidden || measure.locked || measure.tool === "calibrate") return;
    lineSegmentsForMeasurement(measure).forEach(function(segment) {
      if (isSegmentDeleted(measure, segment.key)) return;
      const a = measure.points[segment.indexes[0]];
      const b = measure.points[segment.indexes[1]];
      if (!a || !b) return;
      const d = pointToSegmentDistance(imagePoint, a, b) * scale;
      if (d < 12 * window.devicePixelRatio && (!best || d < best.distance)) {
        best = { measure: measure, segmentKey: segment.key, indexes: segment.indexes, distance: d };
      }
    });
  });
  return best;
}

function selectedLinePoints() {
  if (!selectedLine) return null;
  const a = selectedLine.measure.points[selectedLine.indexes[0]];
  const b = selectedLine.measure.points[selectedLine.indexes[1]];
  if (!a || !b) return null;
  return { a: a, b: b };
}

function moveSelectedLine(dx, dy) {
  const points = selectedLinePoints();
  if (!points) return;
  points.a.x += dx;
  points.a.y += dy;
  points.b.x += dx;
  points.b.y += dy;
  renderMeasurements();
  draw();
}

function rotateSelectedLine(degrees) {
  const points = selectedLinePoints();
  if (!points) return;
  const center = { x: (points.a.x + points.b.x) / 2, y: (points.a.y + points.b.y) / 2 };
  const nextA = rotatePoint(points.a, center, degrees);
  const nextB = rotatePoint(points.b, center, degrees);
  Object.assign(points.a, nextA);
  Object.assign(points.b, nextB);
  renderMeasurements();
  draw();
}

function adjustSelectedLine(action) {
  const points = selectedLinePoints();
  if (!points) return;
  const dx = points.b.x - points.a.x;
  const dy = points.b.y - points.a.y;
  const length = Math.hypot(dx, dy);
  if (!length) return;
  const step = Math.max(Number(nudgeStep) || 1, 0.1);
  const axis = { x: dx / length, y: dy / length };
  const normal = { x: -axis.y, y: axis.x };
  if (action === "axisBackward") moveSelectedLine(-axis.x * step, -axis.y * step);
  if (action === "axisForward") moveSelectedLine(axis.x * step, axis.y * step);
  if (action === "parallelBackward") moveSelectedLine(-normal.x * step, -normal.y * step);
  if (action === "parallelForward") moveSelectedLine(normal.x * step, normal.y * step);
  if (action === "rotateLeft") rotateSelectedLine(-rotationStep);
  if (action === "rotateRight") rotateSelectedLine(rotationStep);
}

function updateZoomLabel() {
  zoomLabel.textContent = Math.round(scale * 100) + "%";
}

function clampZoom(value) {
  return Math.max(0.08, Math.min(16, value));
}

function eventToScreenPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * window.devicePixelRatio,
    y: (event.clientY - rect.top) * window.devicePixelRatio
  };
}

function pointerPair() {
  return Array.from(activePointers.values()).slice(0, 2);
}

function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function clearCanvasDragState() {
  draggingPoint = null;
  draggingLine = null;
  draggingFragment = null;
  isPanning = false;
  lastMouse = null;
}

function beginPinchGesture() {
  if (!image || activePointers.size < 2) return;
  const pair = pointerPair();
  const center = midpoint(pair[0], pair[1]);
  pinchGesture = {
    startDistance: Math.max(distance(pair[0], pair[1]), 1),
    startScale: scale,
    imageAtCenter: screenToImage(center)
  };
  clearCanvasDragState();
}

function updatePinchGesture() {
  if (!pinchGesture || !image || activePointers.size < 2) return;
  const pair = pointerPair();
  const center = midpoint(pair[0], pair[1]);
  const nextScale = clampZoom(pinchGesture.startScale * (distance(pair[0], pair[1]) / pinchGesture.startDistance));
  scale = nextScale;
  pan.x = center.x - pinchGesture.imageAtCenter.x * scale;
  pan.y = center.y - pinchGesture.imageAtCenter.y * scale;
  updateZoomLabel();
  draw();
}

canvas.addEventListener("pointerdown", function(event) {
  const screenPoint = eventToScreenPoint(event);
  activePointers.set(event.pointerId, screenPoint);
  try {
    canvas.setPointerCapture(event.pointerId);
  } catch (error) {
    // Some browsers release capture automatically for cancelled touch gestures.
  }
  if (activePointers.size >= 2) {
    event.preventDefault();
    beginPinchGesture();
    return;
  }
  if (pinchGesture) return;
  if (event.button === 1 || event.shiftKey) {
    isPanning = true;
    lastMouse = screenPoint;
    return;
  }
  if (activeTool === "pan") {
    isPanning = true;
    lastMouse = screenPoint;
    return;
  }
  if (activeTool === "zoom") {
    zoomAt(screenPoint, event.altKey ? 0.8 : 1.25);
    return;
  }
  if (activeTool === "select") {
    const fragmentHit = nearestFragment(screenPoint);
    if (fragmentHit) {
      const pivot = fragmentHit.pivot || polygonCentroid(fragmentHit.points);
      const start = screenToImage(screenPoint);
      setSelectedFragment(fragmentHit);
      draggingFragment = {
        measure: fragmentHit,
        pivot: pivot,
        startAngle: Math.atan2(start.y - pivot.y, start.x - pivot.x),
        startRotation: fragmentHit.rotation || 0
      };
      draw();
      return;
    }
    const hit = nearestPoint(screenPoint);
    if (hit) {
      draggingPoint = hit.point;
      selectedFragment = null;
      setSelectedLine(null);
      renderMeasurements();
      return;
    }
    const lineHit = nearestLine(screenPoint);
    setSelectedLine(lineHit);
    if (lineHit) {
      draggingLine = {
        measure: lineHit.measure,
        indexes: lineHit.indexes,
        lastImagePoint: screenToImage(screenPoint)
      };
      setSelectedFragment(null);
      renderMeasurements();
      draw();
      return;
    }
    selectedFragment = null;
    renderMeasurements();
    draw();
    return;
  }
  if (!image) return;
  if (activeTool === "fragment") {
    pending.push(screenToImage(screenPoint));
    updatePending();
    draw();
    return;
  }
  if (activeTool === "pivot") {
    const fragment = measurements.slice().reverse().find(function(item) { return item.tool === "fragment" && !item.hidden && !item.locked; });
    if (fragment) {
      fragment.pivot = screenToImage(screenPoint);
      renderMeasurements();
      draw();
    } else {
      pendingPoints.textContent = "Nenhum fragmento disponível para receber pivô.";
    }
    return;
  }
  pending.push(screenToImage(screenPoint));
  if (pending.length === toolSpecs[activeTool].points) finishMeasurement();
  updatePending();
  draw();
});

canvas.addEventListener("pointermove", function(event) {
  const screenPoint = eventToScreenPoint(event);
  if (activePointers.has(event.pointerId)) activePointers.set(event.pointerId, screenPoint);
  if (activePointers.size >= 2) {
    event.preventDefault();
    updatePinchGesture();
    return;
  }
  if (pinchGesture) return;
  if (isPanning && lastMouse) {
    pan.x += screenPoint.x - lastMouse.x;
    pan.y += screenPoint.y - lastMouse.y;
    lastMouse = screenPoint;
    draw();
    return;
  }
  if (draggingLine) {
    const current = screenToImage(screenPoint);
    const delta = { x: current.x - draggingLine.lastImagePoint.x, y: current.y - draggingLine.lastImagePoint.y };
    draggingLine.indexes.forEach(function(index) {
      draggingLine.measure.points[index].x += delta.x;
      draggingLine.measure.points[index].y += delta.y;
    });
    draggingLine.lastImagePoint = current;
    renderMeasurements();
    draw();
    return;
  }
  if (draggingFragment) {
    const current = screenToImage(screenPoint);
    const currentAngle = Math.atan2(current.y - draggingFragment.pivot.y, current.x - draggingFragment.pivot.x);
    draggingFragment.measure.rotation = draggingFragment.startRotation + (currentAngle - draggingFragment.startAngle) * 180 / Math.PI;
    renderMeasurements();
    draw();
    return;
  }
  if (draggingPoint) {
    Object.assign(draggingPoint, screenToImage(screenPoint));
    recomputeCalibration();
    renderMeasurements();
    draw();
  }
});

function finishPointer(event) {
  activePointers.delete(event.pointerId);
  try {
    canvas.releasePointerCapture(event.pointerId);
  } catch (error) {
    // Pointer capture may already be gone after touch cancellation.
  }
  if (activePointers.size < 2) pinchGesture = null;
  draggingPoint = null;
  draggingLine = null;
  draggingFragment = null;
  isPanning = false;
  lastMouse = null;
}

canvas.addEventListener("pointerup", finishPointer);
canvas.addEventListener("pointercancel", finishPointer);
canvas.addEventListener("pointerleave", function(event) {
  if (event.pointerType === "mouse") finishPointer(event);
});

window.addEventListener("keydown", function(event) {
  const target = event.target;
  if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
  const shortcuts = {
    ArrowLeft: "axisBackward",
    ArrowRight: "axisForward",
    ArrowUp: "parallelBackward",
    ArrowDown: "parallelForward",
    "[": "rotateLeft",
    "]": "rotateRight"
  };
  if (shortcuts[event.key]) {
    event.preventDefault();
    if (selectedFragment && (event.key === "[" || event.key === "]")) {
      selectedFragment.rotation = (selectedFragment.rotation || 0) + (event.key === "[" ? -rotationStep : rotationStep);
      renderMeasurements();
      draw();
      return;
    }
    if (!selectedLine) return;
    adjustSelectedLine(shortcuts[event.key]);
    return;
  }
  if (!selectedLine) return;
  if (event.key !== "Delete" && event.key !== "Backspace") return;
  event.preventDefault();
  const measure = selectedLine.measure;
  if (measure.tool === "line") {
    measurements = measurements.filter(function(item) { return item !== measure; });
  } else {
    measure.deletedSegments = Array.from(new Set([].concat(measure.deletedSegments || [], selectedLine.segmentKey)));
  }
  setSelectedLine(null);
  redoStack = [];
  recomputeCalibration();
  renderMeasurements();
  draw();
});

canvas.addEventListener("wheel", function(event) {
  if (!image) return;
  event.preventDefault();
  const delta = event.deltaY > 0 ? 0.9 : 1.1;
  const rect = canvas.getBoundingClientRect();
  const mouse = { x: (event.clientX - rect.left) * window.devicePixelRatio, y: (event.clientY - rect.top) * window.devicePixelRatio };
  zoomAt(mouse, delta);
}, { passive: false });

function zoomAt(screenPoint, factor) {
  if (!image) return;
  const before = screenToImage(screenPoint);
  scale = clampZoom(scale * factor);
  pan.x = screenPoint.x - before.x * scale;
  pan.y = screenPoint.y - before.y * scale;
  updateZoomLabel();
  draw();
}

fileInput.addEventListener("change", function(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = function() {
    image = img;
    emptyState.classList.add("is-hidden");
    measurements = [];
    pending = [];
    redoStack = [];
    filteredImageCache = null;
    selectedFragment = null;
    setSelectedLine(null);
    calibration = { pixelsPerMm: null, markerMm: null };
    updateCalibrationStatus();
    renderMeasurements();
    updatePending();
    fitImage();
    URL.revokeObjectURL(url);
  };
  img.src = url;
});

document.querySelectorAll(".tool").forEach(function(button) {
  button.addEventListener("click", function() { setTool(button.dataset.tool); });
});

referenceTabs.forEach(function(button) {
  button.addEventListener("click", function() {
    referenceTabs.forEach(function(tab) {
      const isActive = tab === button;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", isActive ? "true" : "false");
    });
    document.querySelectorAll(".reference-content").forEach(function(panel) {
      const isActive = panel.id === "reference-" + button.dataset.referenceTab;
      panel.classList.toggle("is-active", isActive);
      panel.hidden = !isActive;
    });
  });
});

document.getElementById("undoBtn").addEventListener("click", function() {
  if (pending.length) pending.pop();
  else {
    const removed = measurements.pop();
    if (removed) redoStack.push(removed);
  }
  recomputeCalibration();
  renderMeasurements();
  updatePending();
  draw();
});

document.getElementById("redoBtn").addEventListener("click", function() {
  const restored = redoStack.pop();
  if (restored) measurements.push(restored);
  recomputeCalibration();
  renderMeasurements();
  updatePending();
  draw();
});

document.getElementById("clearBtn").addEventListener("click", function() {
  pending = [];
  measurements = [];
  redoStack = [];
  selectedFragment = null;
  setSelectedLine(null);
  recomputeCalibration();
  renderMeasurements();
  updatePending();
  draw();
});

measurementsEl.addEventListener("click", function(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const measure = measurements.find(function(item) { return item.id === button.dataset.id; });
  if (!measure) return;
  if (button.dataset.action === "selectLine") {
    selectLineSegment(measure, button.dataset.segment);
    return;
  }
  if (button.dataset.action === "toggle") measure.hidden = !measure.hidden;
  if (button.dataset.action === "lock") measure.locked = !measure.locked;
  if (button.dataset.action === "delete") {
    measurements = measurements.filter(function(item) { return item.id !== measure.id; });
    redoStack = [];
    if (selectedLine && selectedLine.measure === measure) setSelectedLine(null);
    if (selectedFragment === measure) selectedFragment = null;
  }
  if (button.dataset.action === "rotateLeft") measure.rotation = (measure.rotation || 0) - 1;
  if (button.dataset.action === "rotateRight") measure.rotation = (measure.rotation || 0) + 1;
  if (button.dataset.action === "rotateReset") measure.rotation = 0;
  recomputeCalibration();
  renderMeasurements();
  draw();
});

document.getElementById("exportBtn").addEventListener("click", function() {
  const lines = ["Angulação RX - medidas", ""];
  if (!measurements.length) {
    lines.push("Nenhuma medida registrada.");
  }
  measurements.forEach(function(measure, index) {
    const result = classifyMeasurement(measure.tool, measure.points, measure);
    const hiddenLabel = measure.hidden ? " (oculta)" : "";
    if (measure.tool === "annotation") lines.push((index + 1) + ". Anotação" + hiddenLabel + ": " + (measure.text || ""));
    else if (measure.tool === "fragment") lines.push((index + 1) + ". Fragmento" + hiddenLabel + ": rotação " + (measure.rotation || 0).toFixed(1) + " graus");
    else if (measure.tool === "line") lines.push((index + 1) + ". Linha" + hiddenLabel + ": " + result.value.toFixed(1) + " " + result.unit);
    else if (measure.tool === "mechanicalAxis") lines.push((index + 1) + ". Eixo mecânico" + hiddenLabel + ": " + result.value.toFixed(1) + " " + result.unit + " | centro da cabeça femoral ao centro do tornozelo");
    else lines.push((index + 1) + ". " + result.label + hiddenLabel + ": " + result.value.toFixed(1) + " " + result.unit);
    if (result.normal) lines.push("   Referência: " + result.normal);
    if (result.note) lines.push("   Observação: " + result.note);
  });
  const planFields = Array.from(document.querySelectorAll("[data-plan]"));
  const filledPlan = planFields.map(function(field) {
    return { label: field.closest("label").childNodes[0].textContent.trim(), value: field.value.trim() };
  }).filter(function(item) { return item.value; });
  if (filledPlan.length) {
    lines.push("");
    lines.push("Planejamento MAP (planejamento pelo eixo mecânico)");
    filledPlan.forEach(function(item) { lines.push(item.label + ": " + item.value); });
  }
  lines.push("");
  lines.push("Referências rápidas");
  lines.push("AP: mLDFA ~87,5 +/- 2,5 graus; MPTA ~87 +/- 2,5 graus; LDTA ~89 +/- 3 graus; JLCA próximo de 0 a 2 graus.");
  lines.push("Perfil: aPDFA ~83 +/- 4 graus; PPTA ~81 +/- 4 graus; ADTA ~80 +/- 3 graus.");
  lines.push("Fonte: valores orientativos adaptados de Paley, Principles of Deformity Correction.");
  lines.push("");
  lines.push("Ferramenta de apoio para medição. Interpretação final depende de revisão médica.");
  const blob = new Blob([lines.join("\n")], { type: "text/plain" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "medidas-angulacao-rx.txt";
  link.click();
  URL.revokeObjectURL(link.href);
});

document.getElementById("saveImageBtn").addEventListener("click", function() {
  if (!image) return;
  draw();
  canvas.toBlob(function(blob) {
    if (!blob) return;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "angulacao-rx-area-visivel.png";
    link.click();
    URL.revokeObjectURL(link.href);
  }, "image/png");
});

document.getElementById("zoomIn").addEventListener("click", function() {
  zoomAt({ x: canvas.width / 2, y: canvas.height / 2 }, 1.15);
});

document.getElementById("zoomOut").addEventListener("click", function() {
  zoomAt({ x: canvas.width / 2, y: canvas.height / 2 }, 1 / 1.15);
});

document.getElementById("fitBtn").addEventListener("click", fitImage);
document.getElementById("finishFragmentBtn").addEventListener("click", finishFragment);

lineControlButtons.forEach(function(button) {
  button.addEventListener("click", function() {
    adjustSelectedLine(button.dataset.lineMove);
  });
});

lineThicknessInput.addEventListener("change", function() {
  lineThickness = Number(lineThicknessInput.value);
  draw();
});

lineDivisionsInput.addEventListener("change", function() {
  lineDivisions = Number(lineDivisionsInput.value);
});

autoAnglesToggle.addEventListener("change", function() {
  autoAngles = autoAnglesToggle.checked;
  draw();
});

extendLinesToggle.addEventListener("change", function() {
  extendLines = extendLinesToggle.checked;
  draw();
});

nudgeStepInput.addEventListener("change", function() {
  nudgeStep = Number(nudgeStepInput.value) || 1;
});

rotationStepInput.addEventListener("change", function() {
  rotationStep = Number(rotationStepInput.value) || 1;
});

brightnessInput.addEventListener("input", function() {
  imageBrightness = Number(brightnessInput.value) || 100;
  filteredImageCache = null;
  draw();
});

contrastInput.addEventListener("input", function() {
  imageContrast = Number(contrastInput.value) || 100;
  filteredImageCache = null;
  draw();
});

invertImageToggle.addEventListener("change", function() {
  invertImage = invertImageToggle.checked;
  filteredImageCache = null;
  draw();
});

document.getElementById("resetImageBtn").addEventListener("click", resetImageControls);

colorSwatches.forEach(function(button) {
  button.addEventListener("click", function() {
    currentColor = button.dataset.color;
    colorSwatches.forEach(function(item) { item.classList.toggle("is-active", item === button); });
  });
});

function updateDeviceMode() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const shortestSide = Math.min(width, height);
  const longestSide = Math.max(width, height);
  const hasTouch = navigator.maxTouchPoints > 0 || window.matchMedia("(pointer: coarse)").matches;
  const tabletLike = hasTouch && shortestSide >= 700 && longestSide <= 1366;
  document.body.classList.toggle("is-tablet", tabletLike);
  document.body.classList.toggle("is-desktop", !tabletLike);
}

window.addEventListener("resize", function() {
  updateDeviceMode();
  resizeCanvas();
});
updateDeviceMode();
resizeCanvas();
setTool("select");
updateCalibrationStatus();
updateLineControls();
