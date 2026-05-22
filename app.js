const canvas = document.getElementById("viewer");
const ctx = canvas.getContext("2d");
const fileInput = document.getElementById("fileInput");
const emptyState = document.getElementById("emptyState");
const activeToolLabel = document.getElementById("activeTool");
const toolHint = document.getElementById("toolHint");
const pendingPoints = document.getElementById("pendingPoints");
const measurementsEl = document.getElementById("measurements");
const zoomLabel = document.getElementById("zoomLabel");

const toolSpecs = {
  select: { label: "Selecionar", points: 0, hint: "Arraste um ponto para ajustar a medida." },
  angle3: { label: "Angulo 3 pontos", points: 3, hint: "Marque A, vertice, B." },
  lineAngle: { label: "Angulo entre linhas", points: 4, hint: "Marque dois pontos da primeira linha e dois da segunda." },
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

function classifyMeasurement(tool, pts) {
  if (tool === "angle3") {
    const a = pts[0], vertex = pts[1], b = pts[2];
    return { label: "Angulo 3 pontos", value: angleBetweenVectors({ x: a.x - vertex.x, y: a.y - vertex.y }, { x: b.x - vertex.x, y: b.y - vertex.y }), unit: "graus" };
  }
  if (tool === "lineAngle") return { label: "Angulo entre linhas", value: lineAngle(pts[0], pts[1], pts[2], pts[3]), unit: "graus" };
  if (tool === "mechanicalAxis") return { label: "MAD", value: pointLineSignedDistance(pts[1], pts[0], pts[2]), unit: "px", note: "Valor em pixels. Calibracao em mm entra na proxima versao." };
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
  ctx.lineWidth = 2 * window.devicePixelRatio;
  ctx.strokeStyle = color || "#66d9c4";
  ctx.stroke();
}

function drawMeasurement(measure) {
  const pts = measure.points;
  const color = measure.tool === "mechanicalAxis" ? "#f2c14e" : "#66d9c4";
  if (measure.tool === "angle3") {
    drawLine(pts[1], pts[0], color);
    drawLine(pts[1], pts[2], color);
  } else if (measure.tool === "lineAngle") {
    drawLine(pts[0], pts[1], color);
    drawLine(pts[2], pts[3], color);
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
    const result = classifyMeasurement(measure.tool, measure.points);
    const article = document.createElement("article");
    article.className = "measure";
    const details = [result.normal, result.note].filter(Boolean).join(" | ") || "Medida criada manualmente sobre a imagem.";
    article.innerHTML = "<header><strong>" + (index + 1) + ". " + result.label + "</strong><b>" + result.value.toFixed(1) + " " + result.unit + "</b></header><small>" + details + "</small>";
    measurementsEl.appendChild(article);
  });
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
  measurements.push({ id: crypto.randomUUID(), tool: activeTool, points: pending.map(function(point) { return { x: point.x, y: point.y }; }) });
  pending = [];
  renderMeasurements();
  updatePending();
  draw();
}

function nearestPoint(screenPoint) {
  let best = null;
  measurements.forEach(function(measure) {
    measure.points.forEach(function(point) {
      const screen = imageToScreen(point);
      const d = distance(screen, screenPoint);
      if (d < 14 * window.devicePixelRatio && (!best || d < best.distance)) best = { point: point, distance: d };
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
  else measurements.pop();
  renderMeasurements();
  updatePending();
  draw();
});

document.getElementById("clearBtn").addEventListener("click", function() {
  pending = [];
  measurements = [];
  renderMeasurements();
  updatePending();
  draw();
});

document.getElementById("exportBtn").addEventListener("click", function() {
  const lines = ["Angulacao RX - medidas", ""];
  if (!measurements.length) {
    lines.push("Nenhuma medida registrada.");
  }
  measurements.forEach(function(measure, index) {
    const result = classifyMeasurement(measure.tool, measure.points);
    lines.push((index + 1) + ". " + result.label + ": " + result.value.toFixed(1) + " " + result.unit);
    if (result.normal) lines.push("   Referencia: " + result.normal);
    if (result.note) lines.push("   Observacao: " + result.note);
  });
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

window.addEventListener("resize", resizeCanvas);
resizeCanvas();
setTool("select");
