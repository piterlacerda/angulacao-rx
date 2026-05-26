const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

function extractFunction(name) {
  const start = appSource.indexOf("function " + name + "(");
  assert.notEqual(start, -1, "Function not found: " + name);
  const braceStart = appSource.indexOf("{", start);
  let depth = 0;
  for (let index = braceStart; index < appSource.length; index += 1) {
    if (appSource[index] === "{") depth += 1;
    if (appSource[index] === "}") depth -= 1;
    if (depth === 0) return appSource.slice(start, index + 1);
  }
  throw new Error("Could not extract function: " + name);
}

const sandbox = { Math };
vm.createContext(sandbox);
vm.runInContext(
  [
    "var calibration = { pixelsPerMm: null, markerMm: null };",
    "var measurementGuides = {};",
    "var toolSpecs = {};",
    "var articularAngleMeta = { ldfa: { label: 'mLDFA (ângulo femoral distal lateral mecânico)', normal: 'referência usual: cerca de 87,5 +/- 2,5', guide: '' }, mpta: { label: 'MPTA (ângulo tibial proximal medial)', normal: 'referência usual: cerca de 87 +/- 2,5', guide: '' }, apdfa: { label: 'aPDFA (ângulo femoral distal posterior anatômico)', normal: 'referência usual: cerca de 83 +/- 4', guide: '' }, ppta: { label: 'PPTA (ângulo tibial proximal posterior)', normal: 'referência usual: cerca de 81 +/- 4', guide: '' }, adta: { label: 'ADTA (ângulo tibial distal anterior)', normal: 'referência usual: cerca de 80 +/- 3', guide: '' } };",
    extractFunction("isArticularAngleTool"),
    extractFunction("distance"),
    extractFunction("polygonCentroid"),
    extractFunction("rotatePoint"),
    extractFunction("angleBetweenVectors"),
    extractFunction("lineAngle"),
    extractFunction("lineIntersection"),
    extractFunction("pointLineSignedDistance"),
    extractFunction("pxToMm"),
    extractFunction("lengthResult"),
    extractFunction("classifyMeasurement")
  ].join("\n"),
  sandbox
);

function closeTo(actual, expected, tolerance = 0.001) {
  assert.ok(Math.abs(actual - expected) <= tolerance, actual + " != " + expected);
}

closeTo(
  sandbox.angleBetweenVectors({ x: 1, y: 0 }, { x: 0, y: 1 }),
  90
);

closeTo(
  sandbox.lineAngle({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 10 }),
  45
);

closeTo(
  sandbox.classifyMeasurement("mpta", [
    { x: 0, y: 0 },
    { x: 0, y: 100 },
    { x: -50, y: 0 },
    { x: 50, y: 0 }
  ]).value,
  90
);

closeTo(
  sandbox.classifyMeasurement("ldfa", [
    { x: 0, y: 0 },
    { x: 0, y: 100 },
    { x: -50, y: 100 },
    { x: 50, y: 100 }
  ]).value,
  90
);

closeTo(
  sandbox.classifyMeasurement("apdfa", [
    { x: 0, y: 0 },
    { x: 0, y: 100 },
    { x: -50, y: 100 },
    { x: 50, y: 100 }
  ]).value,
  90
);

assert.equal(
  sandbox.classifyMeasurement("ppta", [
    { x: 0, y: 0 },
    { x: 0, y: 100 },
    { x: -50, y: 0 },
    { x: 50, y: 0 }
  ]).label,
  "PPTA (ângulo tibial proximal posterior)"
);

assert.equal(
  sandbox.classifyMeasurement("mechanicalAxis", [
    { x: 0, y: 0 },
    { x: 0, y: 100 }
  ]).label,
  "Eixo mecânico"
);

closeTo(
  sandbox.classifyMeasurement("mad", [
    { x: 0, y: 0 },
    { x: 0, y: 100 },
    { x: 10, y: 50 }
  ]).value,
  10
);

closeTo(
  sandbox.classifyMeasurement("cora", [
    { x: 0, y: 0 },
    { x: 0, y: 100 },
    { x: -50, y: 50 },
    { x: 50, y: 50 }
  ]).value,
  90
);

sandbox.calibration.pixelsPerMm = 2;
closeTo(
  sandbox.classifyMeasurement("ruler", [
    { x: 0, y: 0 },
    { x: 10, y: 0 }
  ]).value,
  5
);

const rotated = sandbox.rotatePoint({ x: 10, y: 0 }, { x: 0, y: 0 }, 90);
closeTo(rotated.x, 0);
closeTo(rotated.y, 10);

const centroid = sandbox.polygonCentroid([
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 }
]);
closeTo(centroid.x, 5);
closeTo(centroid.y, 5);

console.log("measurement-calculations: ok");
