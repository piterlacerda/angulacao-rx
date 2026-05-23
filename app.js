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
const colorSwatches = Array.from(document.querySelectorAll(".color-swatch"));
const annotationTextInput = document.getElementById("annotationText");

const measurementGuides = {
  zoom: "Use zoom alto para posicionar pontos finos sobre cortex, centro articular e marcadores. A roda do mouse tambem aproxima e afasta.",
  pan: "Use para deslocar a radiografia ampliada sem mover os pontos ja marcados.",
  calibrate: "Use um marcador radiografico de tamanho conhecido. A calibracao converte medidas lineares de pixels para milimetros.",
  annotation: "Use para registrar referencias visuais ou observacoes curtas sem misturar com os calculos.",
  fragment: "Contorne um segmento osseo e use rotacao para simular correcao. Funcao educativa; nao substitui planejamento cirurgico validado.",
  pivot: "Define o ponto em torno do qual o fragmento mais recente sera rotacionado.",
  ruler: "Serve para distancias lineares e discrepancia. Com escala calibrada, o resultado aparece em milimetros.",
  line: "Linha independente de 2 pontos. Selecione e arraste a linha inteira, ajuste as pontas ou pressione Delete para apagar.",
  angle3: "Use quando o angulo depende de um vertice anatomico claro. O segundo ponto e o vertice.",
  lineAngle: "Use para comparar duas linhas independentes, como eixo e linha articular.",
  mechanicalAxis: "Quantifica o desvio global do eixo mecanico no joelho. Primeiro passo do MAP.",
  ldfa: "Avalia a orientacao distal do femur no plano frontal. Ajuda a localizar se a deformidade vem do femur distal.",
  mpta: "Avalia a orientacao proximal da tibia no plano frontal. Ajuda a localizar deformidade da tibia proximal."
};

const toolSpecs = {
  select: { label: "Selecionar", points: 0, hint: "Arraste um ponto para ajustar a medida." },
  zoom: { label: "Zoom", points: 0, hint: "Clique para aproximar. Use Alt+clique para afastar." },
  pan: { label: "Mover", points: 0, hint: "Arraste a radiografia ampliada sem alterar os pontos." },
  line: { label: "Linha", points: 2, hint: "Clique em 2 pontos para desenhar uma linha independente." },
  angle3: { label: "Angulo 3 pontos", points: 3, hint: "Marque A, vertice, B." },
  lineAngle: { label: "Angulo entre linhas", points: 4, hint: "Marque dois pontos da primeira linha e dois da segunda." },
  ruler: { label: "Regua", points: 2, hint: "Marque dois pontos para medir distancia." },
  calibrate: { label: "Calibrar escala", points: 2, hint: "Marque as bordas do marcador e informe o tamanho real em mm." },
  annotation: { label: "Anotacao", points: 1, hint: "Digite o texto na lateral e clique no ponto em que ele deve aparecer." },
  fragment: { label: "Fragmento", points: null, hint: "Clique ao redor do osso. Depois use Fechar fragmento." },
  pivot: { label: "Pivo", points: 1, hint: "Clique onde o ultimo fragmento deve girar." },
  mechanicalAxis: { label: "Eixo mecanico", points: 3, hint: "Marque centro femoral, centro do joelho e centro do tornozelo." },
  ldfa: { label: "mLDFA", points: 4, hint: "Marque centro femoral, centro do joelho e dois pontos da linha articular distal femoral." },
  mpta: { label: "MPTA", points: 4, hint: "Marque centro do joelho, centro do tornozelo e dois pontos da linha articular proximal tibial." }
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
let currentColor = "#66d9c4";
let redoStack = [];
let renderState = null;
let draggingLine = null;
let selectedLine = null;

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
  if (measure.tool === "line" || measure.tool === "ruler" || measure.tool === "calibrate") {
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
      { key: "0", indexes: [0, 2], color: measure.color || "#f2c14e" },
      { key: "1", indexes: [1, 2], color: "#7aa7ff" }
    ];
  }
  if (measure.tool === "ldfa" || measure.tool === "mpta") {
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
    return { label: "Calibracao", value: markerMm || distance(pts[0], pts[1]), unit: markerMm ? "mm" : "px", note: markerMm ? "Escala aplicada. Os pontos de calibracao ficam ocultos para nao poluir a radiografia." : "Escala ainda nao aplicada." };
  }
  if (tool === "ruler") {
    const result = lengthResult(distance(pts[0], pts[1]));
    return { label: "Distancia", value: result.value, unit: result.unit, note: result.note };
  }
  if (tool === "line") {
    return { label: "Linha", value: 0, unit: "", note: "Linha independente selecionavel, movel e apagavel." };
  }
  if (tool === "annotation") {
    return { label: "Anotacao", value: 0, unit: "", note: measurement && measurement.text ? measurement.text : "Observacao" };
  }
  if (tool === "fragment") {
    return { label: "Fragmento", value: measurement && measurement.rotation ? measurement.rotation : 0, unit: "graus", note: "Rotacao simulada do fragmento em torno do pivo." };
  }
  if (tool === "angle3") {
    const a = pts[0], vertex = pts[1], b = pts[2];
    return { label: "Angulo 3 pontos", value: angleBetweenVectors({ x: a.x - vertex.x, y: a.y - vertex.y }, { x: b.x - vertex.x, y: b.y - vertex.y }), unit: "graus" };
  }
  if (tool === "lineAngle") {
    if (measurement && (isSegmentDeleted(measurement, "0") || isSegmentDeleted(measurement, "1"))) {
      return { label: "Angulo entre linhas", value: 0, unit: "graus", note: "Uma das linhas foi removida." };
    }
    return { label: "Angulo entre linhas", value: lineAngle(pts[0], pts[1], pts[2], pts[3]), unit: "graus" };
  }
  if (tool === "mechanicalAxis") {
    if (measurement && (isSegmentDeleted(measurement, "0") || isSegmentDeleted(measurement, "1"))) {
      return { label: "MAD", value: 0, unit: "", note: "Uma das linhas foi removida." };
    }
    const valuePx = pointLineSignedDistance(pts[1], pts[0], pts[2]);
    const result = lengthResult(valuePx);
    return { label: "MAD", value: result.value, unit: result.unit, note: result.note || "Sinal depende do lado marcado e deve ser interpretado clinicamente." };
  }
  if (tool === "ldfa") {
    if (measurement && (isSegmentDeleted(measurement, "0") || isSegmentDeleted(measurement, "1"))) return { label: "mLDFA", value: 0, unit: "", note: "Uma das linhas foi removida." };
    return { label: "mLDFA", value: lineAngle(pts[0], pts[1], pts[2], pts[3]), unit: "graus", normal: "referencia usual: cerca de 87,5 +/- 2,5" };
  }
  if (tool === "mpta") {
    if (measurement && (isSegmentDeleted(measurement, "0") || isSegmentDeleted(measurement, "1"))) return { label: "MPTA", value: 0, unit: "", note: "Uma das linhas foi removida." };
    return { label: "MPTA", value: lineAngle(pts[0], pts[1], pts[2], pts[3]), unit: "graus", normal: "referencia usual: cerca de 87 +/- 2,5" };
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

function drawHighlightedLine(a, b, color) {
  const target = activeCtx();
  const p1 = imageToScreen(a);
  const p2 = imageToScreen(b);
  target.save();
  target.beginPath();
  target.moveTo(p1.x, p1.y);
  target.lineTo(p2.x, p2.y);
  target.lineWidth = (lineThickness + 6) * window.devicePixelRatio;
  target.strokeStyle = "rgba(242, 244, 239, 0.28)";
  target.stroke();
  target.restore();
  drawLine(a, b, color);
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

function drawFourLineAngles(a, b, c, d, color) {
  const center = lineIntersection(a, b, c, d);
  if (!center) return;
  const rays = [
    Math.atan2(a.y - center.y, a.x - center.x),
    Math.atan2(b.y - center.y, b.x - center.x),
    Math.atan2(c.y - center.y, c.x - center.x),
    Math.atan2(d.y - center.y, d.x - center.x)
  ].sort(function(left, right) { return left - right; });
  const radius = 34 / activeScale();
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

function drawFragment(measure, color) {
  const target = activeCtx();
  const pivot = measure.pivot || polygonCentroid(measure.points);
  const rotation = measure.rotation || 0;
  const rotated = measure.points.map(function(point) { return rotatePoint(point, pivot, rotation); });

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
    target.drawImage(image, localPan.x, localPan.y, image.width * localScale, image.height * localScale);
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

function drawMeasurement(measure) {
  if (measure.hidden) return;
  const pts = measure.points;
  if (measure.tool === "calibrate") return;
  const color = measure.color || (measure.tool === "mechanicalAxis" ? "#f2c14e" : "#66d9c4");
  if (measure.tool === "angle3") {
    drawLine(pts[1], pts[0], color);
    drawLine(pts[1], pts[2], color);
  } else if (measure.tool === "line") {
    const selected = selectedLine && selectedLine.measure === measure && selectedLine.segmentKey === "0";
    if (selected) drawHighlightedLine(pts[0], pts[1], color);
    else drawLine(pts[0], pts[1], color);
  } else if (measure.tool === "lineAngle") {
    if (!isSegmentDeleted(measure, "0")) {
      const selected = selectedLine && selectedLine.measure === measure && selectedLine.segmentKey === "0";
      if (selected) drawHighlightedLine(pts[0], pts[1], color);
      else drawLine(pts[0], pts[1], color);
    }
    if (!isSegmentDeleted(measure, "1")) {
      const selected = selectedLine && selectedLine.measure === measure && selectedLine.segmentKey === "1";
      if (selected) drawHighlightedLine(pts[2], pts[3], "#7aa7ff");
      else drawLine(pts[2], pts[3], "#7aa7ff");
    }
    if (!isSegmentDeleted(measure, "0") && !isSegmentDeleted(measure, "1")) drawFourLineAngles(pts[0], pts[1], pts[2], pts[3], color);
  } else if (measure.tool === "ruler" || measure.tool === "calibrate") {
    drawLine(pts[0], pts[1], color);
  } else if (measure.tool === "annotation") {
    drawText(pts[0], measure.text || "Observacao", color);
    drawPoint(pts[0], "", color);
    return;
  } else if (measure.tool === "fragment") {
    drawFragment(measure, color);
    return;
  } else if (measure.tool === "mechanicalAxis") {
    if (!isSegmentDeleted(measure, "0")) {
      const selected = selectedLine && selectedLine.measure === measure && selectedLine.segmentKey === "0";
      if (selected) drawHighlightedLine(pts[0], pts[2], color);
      else drawLine(pts[0], pts[2], color);
    }
    if (!isSegmentDeleted(measure, "1")) {
      const selected = selectedLine && selectedLine.measure === measure && selectedLine.segmentKey === "1";
      if (selected) drawHighlightedLine(pts[1], pts[2], "#7aa7ff");
      else drawLine(pts[1], pts[2], "#7aa7ff");
    }
  } else if (measure.tool === "ldfa" || measure.tool === "mpta") {
    if (!isSegmentDeleted(measure, "0")) {
      const selected = selectedLine && selectedLine.measure === measure && selectedLine.segmentKey === "0";
      if (selected) drawHighlightedLine(pts[0], pts[1], color);
      else drawLine(pts[0], pts[1], color);
    }
    if (!isSegmentDeleted(measure, "1")) {
      const selected = selectedLine && selectedLine.measure === measure && selectedLine.segmentKey === "1";
      if (selected) drawHighlightedLine(pts[2], pts[3], "#7aa7ff");
      else drawLine(pts[2], pts[3], "#7aa7ff");
    }
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
    target.drawImage(image, localPan.x, localPan.y, image.width * localScale, image.height * localScale);
  }
  measurements.forEach(drawMeasurement);
  pending.forEach(function(point, index) { drawPoint(point, String(index + 1), "#ef6f6c"); });
}

function renderMeasurements() {
  measurementsEl.innerHTML = "";
  measurements.forEach(function(measure, index) {
    const result = classifyMeasurement(measure.tool, measure.points, measure);
    const article = document.createElement("article");
    article.className = "measure" + (measure.hidden ? " is-hidden" : "");
    const details = [result.normal, result.note, measurementGuides[measure.tool]].filter(Boolean).join(" | ") || "Medida criada manualmente sobre a imagem.";
    const valueText = (measure.tool === "annotation" || measure.tool === "line") ? "" : result.value.toFixed(1) + " " + result.unit;
    const fragmentActions = measure.tool === "fragment" ? "<div class=\"fragment-actions\"><button data-action=\"rotateLeft\" data-id=\"" + measure.id + "\">-5</button><button data-action=\"rotateReset\" data-id=\"" + measure.id + "\">0</button><button data-action=\"rotateRight\" data-id=\"" + measure.id + "\">+5</button></div>" : "";
    article.innerHTML = "<header><strong>" + (index + 1) + ". " + result.label + "</strong><b>" + valueText + "</b></header><small>" + details + "</small><div class=\"measure-actions\"><button data-action=\"toggle\" data-id=\"" + measure.id + "\">" + (measure.hidden ? "Mostrar" : "Ocultar") + "</button><button data-action=\"lock\" data-id=\"" + measure.id + "\">" + (measure.locked ? "Destravar" : "Travar") + "</button><button data-action=\"delete\" data-id=\"" + measure.id + "\">Apagar</button></div>" + fragmentActions;
    measurementsEl.appendChild(article);
  });
}

function updateCalibrationStatus() {
  if (!calibration.pixelsPerMm) {
    calibrationStatus.textContent = "Escala nao calibrada.";
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
    measurement.text = annotationTextInput.value.trim() || "Observacao";
  }
  selectedLine = null;
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

function updateZoomLabel() {
  zoomLabel.textContent = Math.round(scale * 100) + "%";
}

canvas.addEventListener("pointerdown", function(event) {
  const rect = canvas.getBoundingClientRect();
  const screenPoint = { x: (event.clientX - rect.left) * window.devicePixelRatio, y: (event.clientY - rect.top) * window.devicePixelRatio };
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
    const hit = nearestPoint(screenPoint);
    if (hit) {
      draggingPoint = hit.point;
      selectedLine = null;
      return;
    }
    const lineHit = nearestLine(screenPoint);
    selectedLine = lineHit;
    if (lineHit) {
      draggingLine = {
        measure: lineHit.measure,
        indexes: lineHit.indexes,
        lastImagePoint: screenToImage(screenPoint)
      };
    }
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
      pendingPoints.textContent = "Nenhum fragmento disponivel para receber pivo.";
    }
    return;
  }
  pending.push(screenToImage(screenPoint));
  if (pending.length === toolSpecs[activeTool].points) finishMeasurement();
  updatePending();
  draw();
});

canvas.addEventListener("pointermove", function(event) {
  const rect = canvas.getBoundingClientRect();
  const screenPoint = { x: (event.clientX - rect.left) * window.devicePixelRatio, y: (event.clientY - rect.top) * window.devicePixelRatio };
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
  if (draggingPoint) {
    Object.assign(draggingPoint, screenToImage(screenPoint));
    recomputeCalibration();
    renderMeasurements();
    draw();
  }
});

canvas.addEventListener("pointerup", function() {
  draggingPoint = null;
  draggingLine = null;
  isPanning = false;
  lastMouse = null;
});

window.addEventListener("keydown", function(event) {
  if ((event.key !== "Delete" && event.key !== "Backspace") || !selectedLine) return;
  const target = event.target;
  if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
  event.preventDefault();
  const measure = selectedLine.measure;
  if (measure.tool === "line") {
    measurements = measurements.filter(function(item) { return item !== measure; });
  } else {
    measure.deletedSegments = Array.from(new Set([].concat(measure.deletedSegments || [], selectedLine.segmentKey)));
  }
  selectedLine = null;
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
  scale = Math.max(0.08, Math.min(16, scale * factor));
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
  selectedLine = null;
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
  if (button.dataset.action === "toggle") measure.hidden = !measure.hidden;
  if (button.dataset.action === "lock") measure.locked = !measure.locked;
  if (button.dataset.action === "delete") {
    measurements = measurements.filter(function(item) { return item.id !== measure.id; });
    redoStack = [];
    if (selectedLine && selectedLine.measure === measure) selectedLine = null;
  }
  if (button.dataset.action === "rotateLeft") measure.rotation = (measure.rotation || 0) - 5;
  if (button.dataset.action === "rotateRight") measure.rotation = (measure.rotation || 0) + 5;
  if (button.dataset.action === "rotateReset") measure.rotation = 0;
  recomputeCalibration();
  renderMeasurements();
  draw();
});

document.getElementById("exportBtn").addEventListener("click", function() {
  const lines = ["Angulacao RX - medidas", ""];
  if (!measurements.length) {
    lines.push("Nenhuma medida registrada.");
  }
  measurements.forEach(function(measure, index) {
    const result = classifyMeasurement(measure.tool, measure.points, measure);
    const hiddenLabel = measure.hidden ? " (oculta)" : "";
    if (measure.tool === "annotation") lines.push((index + 1) + ". Anotacao" + hiddenLabel + ": " + (measure.text || ""));
    else if (measure.tool === "fragment") lines.push((index + 1) + ". Fragmento" + hiddenLabel + ": rotacao " + (measure.rotation || 0).toFixed(1) + " graus");
    else if (measure.tool === "line") lines.push((index + 1) + ". Linha" + hiddenLabel);
    else lines.push((index + 1) + ". " + result.label + hiddenLabel + ": " + result.value.toFixed(1) + " " + result.unit);
    if (result.normal) lines.push("   Referencia: " + result.normal);
    if (result.note) lines.push("   Observacao: " + result.note);
  });
  const planFields = Array.from(document.querySelectorAll("[data-plan]"));
  const filledPlan = planFields.map(function(field) {
    return { label: field.closest("label").childNodes[0].textContent.trim(), value: field.value.trim() };
  }).filter(function(item) { return item.value; });
  if (filledPlan.length) {
    lines.push("");
    lines.push("Planejamento MAP");
    filledPlan.forEach(function(item) { lines.push(item.label + ": " + item.value); });
  }
  lines.push("");
  lines.push("Ferramenta de apoio para medicao. Interpretacao final depende de revisao medica.");
  const blob = new Blob([lines.join("\n")], { type: "text/plain" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "medidas-angulacao-rx.txt";
  link.click();
  URL.revokeObjectURL(link.href);
});

document.getElementById("saveImageBtn").addEventListener("click", function() {
  if (!image) return;
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = image.width;
  exportCanvas.height = image.height;
  const exportCtx = exportCanvas.getContext("2d");
  renderState = { ctx: exportCtx, width: exportCanvas.width, height: exportCanvas.height, scale: 1, pan: { x: 0, y: 0 } };
  draw();
  renderState = null;
  draw();
  exportCanvas.toBlob(function(blob) {
    if (!blob) return;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "angulacao-rx-imagem.png";
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

lineThicknessInput.addEventListener("change", function() {
  lineThickness = Number(lineThicknessInput.value);
  draw();
});

colorSwatches.forEach(function(button) {
  button.addEventListener("click", function() {
    currentColor = button.dataset.color;
    colorSwatches.forEach(function(item) { item.classList.toggle("is-active", item === button); });
  });
});

window.addEventListener("resize", resizeCanvas);
resizeCanvas();
setTool("select");
updateCalibrationStatus();
