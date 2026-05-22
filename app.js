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
  calibrate: "Use um marcador radiografico de tamanho conhecido. A calibracao converte medidas lineares de pixels para milimetros.",
  annotation: "Use para registrar referencias visuais ou observacoes curtas sem misturar com os calculos.",
  ruler: "Serve para distancias lineares e discrepancia. Com escala calibrada, o resultado aparece em milimetros.",
  angle3: "Use quando o angulo depende de um vertice anatomico claro. O segundo ponto e o vertice.",
  lineAngle: "Use para comparar duas linhas independentes, como eixo e linha articular.",
  mechanicalAxis: "Quantifica o desvio global do eixo mecanico no joelho. Primeiro passo do MAP.",
  ldfa: "Avalia a orientacao distal do femur no plano frontal. Ajuda a localizar se a deformidade vem do femur distal.",
  mpta: "Avalia a orientacao proximal da tibia no plano frontal. Ajuda a localizar deformidade da tibia proximal."
};

const toolSpecs = {
  select: { label: "Selecionar", points: 0, hint: "Arraste um ponto para ajustar a medida." },
  angle3: { label: "Angulo 3 pontos", points: 3, hint: "Marque A, vertice, B." },
  lineAngle: { label: "Angulo entre linhas", points: 4, hint: "Marque dois pontos da primeira linha e dois da segunda." },
  ruler: { label: "Regua", points: 2, hint: "Marque dois pontos para medir distancia." },
  calibrate: { label: "Calibrar escala", points: 2, hint: "Marque as bordas do marcador e informe o tamanho real em mm." },
  annotation: { label: "Anotacao", points: 1, hint: "Digite o texto na lateral e clique no ponto em que ele deve aparecer." },
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

function resizeCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = Math.max(900, Math.floor(rect.width * window.devicePixelRatio));
  canvas.height = Math.max(620, Math.floor(rect.height * window.devicePixelRatio));
  canvas.style.width = rect.width + "px";
  canvas.style.height = rect.height + "px";
  draw();
}

function imageToScreen(point) {
  return { x: point.x * scale + pan.x, y: point.y * scale + pan.y };
}

function screenToImage(point) {
  return { x: (point.x - pan.x) / scale, y: (point.y - pan.y) / scale };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
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
  if (tool === "annotation") {
    return { label: "Anotacao", value: 0, unit: "", note: measurement && measurement.text ? measurement.text : "Observacao" };
  }
  if (tool === "angle3") {
    const a = pts[0], vertex = pts[1], b = pts[2];
    return { label: "Angulo 3 pontos", value: angleBetweenVectors({ x: a.x - vertex.x, y: a.y - vertex.y }, { x: b.x - vertex.x, y: b.y - vertex.y }), unit: "graus" };
  }
  if (tool === "lineAngle") return { label: "Angulo entre linhas", value: lineAngle(pts[0], pts[1], pts[2], pts[3]), unit: "graus" };
  if (tool === "mechanicalAxis") {
    const valuePx = pointLineSignedDistance(pts[1], pts[0], pts[2]);
    const result = lengthResult(valuePx);
    return { label: "MAD", value: result.value, unit: result.unit, note: result.note || "Sinal depende do lado marcado e deve ser interpretado clinicamente." };
  }
  if (tool === "ldfa") return { label: "mLDFA", value: lineAngle(pts[0], pts[1], pts[2], pts[3]), unit: "graus", normal: "referencia usual: cerca de 87,5 +/- 2,5" };
  if (tool === "mpta") return { label: "MPTA", value: lineAngle(pts[0], pts[1], pts[2], pts[3]), unit: "graus", normal: "referencia usual: cerca de 87 +/- 2,5" };
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
  const p = imageToScreen(point);
  const radius = 6 * window.devicePixelRatio;
  ctx.beginPath();
  ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color || "#66d9c4";
  ctx.fill();
  ctx.lineWidth = 2 * window.devicePixelRatio;
  ctx.strokeStyle = "#101412";
  ctx.stroke();
  ctx.fillStyle = "#f2f4ef";
  ctx.font = 12 * window.devicePixelRatio + "px sans-serif";
  ctx.fillText(label, p.x + 9 * window.devicePixelRatio, p.y - 9 * window.devicePixelRatio);
}

function drawLine(a, b, color) {
  const p1 = imageToScreen(a);
  const p2 = imageToScreen(b);
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.lineWidth = lineThickness * window.devicePixelRatio;
  ctx.strokeStyle = color || "#66d9c4";
  ctx.stroke();
}

function drawText(point, value, color) {
  const p = imageToScreen(point);
  ctx.font = 14 * window.devicePixelRatio + "px sans-serif";
  const padding = 6 * window.devicePixelRatio;
  const metrics = ctx.measureText(value);
  const width = metrics.width + padding * 2;
  const height = 24 * window.devicePixelRatio;
  ctx.fillStyle = "rgba(16, 20, 18, 0.82)";
  ctx.fillRect(p.x, p.y - height, width, height);
  ctx.strokeStyle = color || "#66d9c4";
  ctx.lineWidth = 1.5 * window.devicePixelRatio;
  ctx.strokeRect(p.x, p.y - height, width, height);
  ctx.fillStyle = color || "#f2f4ef";
  ctx.fillText(value, p.x + padding, p.y - 8 * window.devicePixelRatio);
}

function drawMeasurement(measure) {
  if (measure.hidden) return;
  const pts = measure.points;
  if (measure.tool === "calibrate") return;
  const color = measure.color || (measure.tool === "mechanicalAxis" ? "#f2c14e" : "#66d9c4");
  if (measure.tool === "angle3") {
    drawLine(pts[1], pts[0], color);
    drawLine(pts[1], pts[2], color);
  } else if (measure.tool === "lineAngle") {
    drawLine(pts[0], pts[1], color);
    drawLine(pts[2], pts[3], color);
  } else if (measure.tool === "ruler" || measure.tool === "calibrate") {
    drawLine(pts[0], pts[1], color);
  } else if (measure.tool === "annotation") {
    drawText(pts[0], measure.text || "Observacao", color);
    drawPoint(pts[0], "", color);
    return;
  } else if (measure.tool === "mechanicalAxis") {
    drawLine(pts[0], pts[2], color);
    drawLine(pts[1], pts[2], "#7aa7ff");
  } else if (measure.tool === "ldfa" || measure.tool === "mpta") {
    drawLine(pts[0], pts[1], color);
    drawLine(pts[2], pts[3], "#7aa7ff");
  }
  pts.forEach(function(point, index) { drawPoint(point, String(index + 1), color); });
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (image) {
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(image, pan.x, pan.y, image.width * scale, image.height * scale);
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
    const valueText = measure.tool === "annotation" ? "" : result.value.toFixed(1) + " " + result.unit;
    article.innerHTML = "<header><strong>" + (index + 1) + ". " + result.label + "</strong><b>" + valueText + "</b></header><small>" + details + "</small><div class=\"measure-actions\"><button data-action=\"toggle\" data-id=\"" + measure.id + "\">" + (measure.hidden ? "Mostrar" : "Ocultar") + "</button><button data-action=\"lock\" data-id=\"" + measure.id + "\">" + (measure.locked ? "Destravar" : "Travar") + "</button><button data-action=\"delete\" data-id=\"" + measure.id + "\">Apagar</button></div>";
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
  measurements.push(measurement);
  recomputeCalibration();
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
  if (activeTool === "select") {
    const hit = nearestPoint(screenPoint);
    draggingPoint = hit ? hit.point : null;
    return;
  }
  if (!image) return;
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
  if (draggingPoint) {
    Object.assign(draggingPoint, screenToImage(screenPoint));
    recomputeCalibration();
    renderMeasurements();
    draw();
  }
});

canvas.addEventListener("pointerup", function() {
  draggingPoint = null;
  isPanning = false;
  lastMouse = null;
});

canvas.addEventListener("wheel", function(event) {
  if (!image) return;
  event.preventDefault();
  const delta = event.deltaY > 0 ? 0.9 : 1.1;
  const rect = canvas.getBoundingClientRect();
  const mouse = { x: (event.clientX - rect.left) * window.devicePixelRatio, y: (event.clientY - rect.top) * window.devicePixelRatio };
  const before = screenToImage(mouse);
  scale = Math.max(0.08, Math.min(8, scale * delta));
  pan.x = mouse.x - before.x * scale;
  pan.y = mouse.y - before.y * scale;
  updateZoomLabel();
  draw();
}, { passive: false });

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
  }
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

document.getElementById("zoomIn").addEventListener("click", function() {
  scale = Math.min(8, scale * 1.15);
  updateZoomLabel();
  draw();
});

document.getElementById("zoomOut").addEventListener("click", function() {
  scale = Math.max(0.08, scale / 1.15);
  updateZoomLabel();
  draw();
});

document.getElementById("fitBtn").addEventListener("click", fitImage);

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
