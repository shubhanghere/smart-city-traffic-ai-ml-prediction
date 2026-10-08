import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const ROUTE_LENGTH = 108;
const ROUTE_MID = ROUTE_LENGTH / 2;
const ROAD_HALF_WIDTH = 9;
const INTERSECTION_HALF = 10;
const LANE_SPACING = 6.1;
const MAX_CARS_PER_LANE = 9;

const FLEET = [
  { kind: "taxi", label: "NYC TAXI", color: "#d9a72f", width: 1.85, length: 4.55, height: 0.66, cruise: 8.2 },
  { kind: "sedan", label: "SEDAN", color: "#536372", width: 1.82, length: 4.35, height: 0.62, cruise: 9.0 },
  { kind: "sedan", label: "SEDAN", color: "#aeb5b5", width: 1.82, length: 4.35, height: 0.62, cruise: 9.0 },
  { kind: "suv", label: "SUV", color: "#313a40", width: 1.96, length: 4.8, height: 0.78, cruise: 8.3 },
  { kind: "pickup", label: "PICKUP", color: "#66725d", width: 1.94, length: 5.15, height: 0.73, cruise: 7.6 },
  { kind: "van", label: "DELIVERY VAN", color: "#dedbd0", width: 2.0, length: 5.25, height: 1.05, cruise: 7.4 },
  { kind: "bus", label: "CITY BUS", color: "#d9a830", width: 2.35, length: 8.2, height: 1.55, cruise: 6.5 },
  { kind: "emergency", label: "EMS", color: "#e3e3dc", width: 2.0, length: 5.05, height: 1.02, cruise: 8.0 },
  { kind: "truck", label: "BOX TRUCK", color: "#9b9d9a", width: 2.12, length: 6.5, height: 1.25, cruise: 6.8 },
  { kind: "ev", label: "ELECTRIC", color: "#526d7b", width: 1.86, length: 4.5, height: 0.62, cruise: 8.8 },
];

const LANE_CONFIG = [
  { key: "northbound", axis: "NS", direction: 1, fixed: -2.8, label: "N" },
  { key: "southbound", axis: "NS", direction: -1, fixed: 2.8, label: "S" },
  { key: "eastbound", axis: "EW", direction: 1, fixed: -2.8, label: "E" },
  { key: "westbound", axis: "EW", direction: -1, fixed: 2.8, label: "W" },
];

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const seeded = (seed) => {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
};

function makeAsphaltTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  context.fillStyle = "#363a3a";
  context.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 7800; i += 1) {
    const shade = Math.floor(42 + seeded(i + 9) * 50);
    const alpha = 0.05 + seeded(i + 80) * 0.15;
    const size = 0.3 + seeded(i + 180) * 1.2;
    context.fillStyle = "rgba(" + shade + "," + shade + "," + (shade + 1) + "," + alpha + ")";
    context.fillRect(seeded(i + 300) * 512, seeded(i + 400) * 512, size, size);
  }
  for (let i = 0; i < 14; i += 1) {
    const x = seeded(i + 780) * 512;
    const y = seeded(i + 820) * 512;
    context.strokeStyle = "rgba(17,20,20,0.22)";
    context.lineWidth = 0.6;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + 5 + seeded(i + 900) * 11, y + 2 + seeded(i + 920) * 8);
    context.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(15, 15);
  texture.anisotropy = 4;
  return texture;
}

function makeFacadeTexture(base, trim, window) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  context.fillStyle = base;
  context.fillRect(0, 0, 256, 512);
  context.fillStyle = trim;
  for (let y = 0; y < 512; y += 42) context.fillRect(0, y, 256, 3);
  for (let x = 0; x < 256; x += 32) context.fillRect(x, 0, 2, 512);
  for (let y = 14; y < 512; y += 42) {
    for (let x = 7; x < 256; x += 32) {
      context.fillStyle = "#171f24";
      context.fillRect(x, y, 19, 22);
      context.fillStyle = window;
      context.fillRect(x + 2, y + 2, 15, 18);
      context.fillStyle = "rgba(255,255,255,.18)";
      context.fillRect(x + 2, y + 2, 2, 18);
      context.fillStyle = trim;
      context.fillRect(x - 1, y + 23, 21, 2);
    }
  }
  context.fillStyle = "rgba(24,31,35,.82)";
  context.fillRect(0, 430, 256, 82);
  for (let x = 8; x < 250; x += 35) {
    context.fillStyle = "#709198";
    context.fillRect(x, 438, 25, 63);
    context.fillStyle = "rgba(218,234,222,.23)";
    context.fillRect(x + 2, 441, 3, 57);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

function compactMeshChildren(root) {
  root.updateMatrixWorld(true);
  const batches = new Map();
  root.traverse((object) => {
    if (!object.isMesh || !object.visible || Array.isArray(object.material)) return;
    const list = batches.get(object.material) || [];
    list.push(object);
    batches.set(object.material, list);
  });
  for (const [material, meshes] of batches) {
    if (meshes.length < 2) continue;
    const geometries = meshes.map((mesh) => {
      mesh.updateMatrix();
      let geometry = mesh.geometry.clone();
      if (geometry.index) {
        const unindexed = geometry.toNonIndexed();
        geometry.dispose();
        geometry = unindexed;
      }
      for (const attribute of Object.keys(geometry.attributes)) {
        if (attribute !== "position" && attribute !== "normal" && attribute !== "uv") geometry.deleteAttribute(attribute);
      }
      geometry.applyMatrix4(mesh.matrixWorld);
      return geometry;
    });
    const merged = mergeGeometries(geometries, false);
    for (const geometry of geometries) geometry.dispose();
    if (!merged) continue;
    const combined = new THREE.Mesh(merged, material);
    combined.castShadow = meshes.some((mesh) => mesh.castShadow);
    combined.receiveShadow = meshes.some((mesh) => mesh.receiveShadow);
    for (const mesh of meshes) {
      mesh.parent?.remove(mesh);
      mesh.geometry.dispose();
    }
    root.add(combined);
  }
}

function flattenCarMeshes(root) {
  root.updateMatrixWorld(true);
  const sourceMeshes = root.children.filter((object) => object.isMesh);
  const geometries = sourceMeshes.map((mesh) => {
    mesh.updateMatrix();
    let geometry = mesh.geometry.clone();
    if (geometry.index) {
      const unindexed = geometry.toNonIndexed();
      geometry.dispose();
      geometry = unindexed;
    }
    for (const attribute of Object.keys(geometry.attributes)) {
      if (attribute !== "position" && attribute !== "normal" && attribute !== "uv") geometry.deleteAttribute(attribute);
    }
    geometry.applyMatrix4(mesh.matrixWorld);
    const color = mesh.material?.color || new THREE.Color("#ffffff");
    const colors = new Float32Array(geometry.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) color.toArray(colors, i);
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    return geometry;
  });
  const merged = mergeGeometries(geometries, false);
  for (const geometry of geometries) geometry.dispose();
  for (const mesh of sourceMeshes) {
    root.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.dispose();
  }
  const material = new THREE.MeshStandardMaterial({ color: "#ffffff", vertexColors: true, roughness: 0.62, metalness: 0.12 });
  const body = new THREE.Mesh(merged, material);
  body.castShadow = true;
  root.add(body);
}

function createCar(scene, index, lane, profile) {
  const group = new THREE.Group();
  group.visible = false;
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: profile.color, roughness: 0.52, metalness: 0.32 });
  const dark = new THREE.MeshStandardMaterial({ color: "#101619", roughness: 0.78 });
  const glass = new THREE.MeshStandardMaterial({ color: "#33464e", roughness: 0.24, metalness: 0.42 });
  const chrome = new THREE.MeshStandardMaterial({ color: "#b9b7ad", roughness: 0.28, metalness: 0.72 });
  const tire = new THREE.MeshStandardMaterial({ color: "#171b1d", roughness: 0.91 });
  const lamp = new THREE.MeshStandardMaterial({ color: "#fff0b7", emissive: "#ffd66d", emissiveIntensity: 0.6, roughness: 0.22 });
  const redLamp = new THREE.MeshStandardMaterial({ color: "#b7231e", emissive: "#bd2319", emissiveIntensity: 0.45 });
  const wheelGeometry = new THREE.CylinderGeometry(0.32, 0.32, 0.2, 16);
  const hubGeometry = new THREE.CylinderGeometry(0.17, 0.17, 0.205, 12);
  const bodyGeometry = new RoundedBoxGeometry(profile.width, profile.height, profile.length, 3, 0.14);
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.y = 0.68 + profile.height / 2;
  body.castShadow = true;
  group.add(body);

  let cabinWidth = profile.width * 0.77;
  let cabinLength = profile.length * 0.49;
  let cabinHeight = profile.kind === "bus" ? 1.16 : profile.kind === "van" || profile.kind === "emergency" ? 0.86 : profile.kind === "truck" ? 0.76 : 0.6;
  let cabinZ = profile.length > 6 ? -0.58 : -0.25;
  if (profile.kind === "bus") {
    cabinWidth = profile.width * 0.86;
    cabinLength = profile.length * 0.84;
    cabinZ = -0.1;
  } else if (profile.kind === "van" || profile.kind === "emergency") {
    cabinLength = profile.length * 0.66;
    cabinZ = -0.35;
  } else if (profile.kind === "truck") {
    cabinLength = 2.35;
    cabinZ = 1.0;
  }
  const cabinGeometry = new RoundedBoxGeometry(cabinWidth, cabinHeight, cabinLength, 2, 0.1);
  const cabin = new THREE.Mesh(cabinGeometry, profile.kind === "truck" ? bodyMaterial : glass);
  cabin.position.set(0, 0.94 + cabinHeight / 2, cabinZ);
  cabin.castShadow = true;
  group.add(cabin);

  const roof = new THREE.Mesh(
    new RoundedBoxGeometry(cabinWidth * 0.86, 0.08, cabinLength * 0.65, 2, 0.04),
    profile.kind === "taxi" ? bodyMaterial : (profile.kind === "bus" ? bodyMaterial : glass)
  );
  roof.position.set(0, 0.98 + cabinHeight, cabinZ - 0.03);
  group.add(roof);

  const wheelZ = profile.length * 0.32;
  for (const side of [-1, 1]) {
    for (const longitudinal of [-1, 1]) {
      const wheelX = side * (profile.width * 0.49);
      const wheelZPos = longitudinal * wheelZ;
      const wheel = new THREE.Mesh(wheelGeometry, tire);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wheelX, 0.58, wheelZPos);
      group.add(wheel);
      const hub = new THREE.Mesh(hubGeometry, chrome);
      hub.rotation.z = Math.PI / 2;
      hub.position.set(wheelX + side * 0.015, 0.58, wheelZPos);
      group.add(hub);
    }
  }

  const headGeometry = new THREE.BoxGeometry(0.34, 0.16, 0.08);
  const rearGeometry = new THREE.BoxGeometry(0.36, 0.2, 0.08);
  for (const side of [-1, 1]) {
    const frontLamp = new THREE.Mesh(headGeometry, lamp);
    frontLamp.position.set(side * profile.width * 0.34, 0.83, profile.length / 2 + 0.025);
    group.add(frontLamp);
    const tailLamp = new THREE.Mesh(rearGeometry, redLamp);
    tailLamp.position.set(side * profile.width * 0.35, 0.83, -profile.length / 2 - 0.025);
    group.add(tailLamp);

    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.12, 0.3), bodyMaterial);
    mirror.position.set(side * (cabinWidth * 0.54), 1.15, cabinZ + cabinLength * 0.34);
    group.add(mirror);
    const window = new THREE.Mesh(new THREE.BoxGeometry(0.035, cabinHeight * 0.5, cabinLength * 0.31), glass);
    window.position.set(side * (cabinWidth * 0.51), 1.12 + cabinHeight * 0.5, cabinZ - cabinLength * 0.06);
    group.add(window);
  }

  const grille = new THREE.Mesh(new THREE.BoxGeometry(profile.width * 0.44, 0.2, 0.045), dark);
  grille.position.set(0, 0.88, profile.length / 2 + 0.04);
  group.add(grille);
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(profile.width * 0.94, 0.15, 0.2), chrome);
  bumper.position.set(0, 0.55, profile.length / 2 + 0.06);
  group.add(bumper);
  const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(profile.width * 0.94, 0.13, 0.18), chrome);
  rearBumper.position.set(0, 0.55, -profile.length / 2 - 0.05);
  group.add(rearBumper);

  if (profile.kind === "taxi") {
    const marker = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.22, 0.36, 2, 0.06), new THREE.MeshStandardMaterial({ color: "#f2ca59", roughness: 0.5 }));
    marker.position.set(0, 1.76, cabinZ - 0.05);
    group.add(marker);
    const markerFace = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.025, 0.03), dark);
    markerFace.position.set(0, 1.77, cabinZ + 0.14);
    group.add(markerFace);
  }

  if (profile.kind === "bus") {
    for (let side of [-1, 1]) {
      for (let i = 0; i < 5; i += 1) {
        const busWindow = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.57, 0.82), glass);
        busWindow.position.set(side * (profile.width * 0.47), 1.94, 2.1 - i * 1.02);
        group.add(busWindow);
      }
    }
    const band = new THREE.Mesh(new THREE.BoxGeometry(profile.width + 0.02, 0.14, profile.length * 0.78), new THREE.MeshStandardMaterial({ color: "#e9c44e", roughness: 0.55 }));
    band.position.set(0, 1.25, 0);
    group.add(band);
  }

  if (profile.kind === "pickup") {
    const bedMaterial = new THREE.MeshStandardMaterial({ color: "#343c3b", roughness: 0.78 });
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.52, 1.6), bodyMaterial);
      rail.position.set(side * 0.8, 1.0, -1.48);
      group.add(rail);
    }
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.12, 1.5), bedMaterial);
    bed.position.set(0, 0.82, -1.48);
    group.add(bed);
  }

  if (profile.kind === "truck") {
    const cargo = new THREE.Mesh(new RoundedBoxGeometry(profile.width * 0.9, 1.75, profile.length * 0.49, 2, 0.08), new THREE.MeshStandardMaterial({ color: profile.color, roughness: 0.66 }));
    cargo.position.set(0, 1.62, -1.65);
    group.add(cargo);
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.025, 1.28, 0.035), chrome);
    seam.position.set(0, 1.66, -profile.length * 0.49);
    group.add(seam);
  }

  if (profile.kind === "emergency") {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.18, 0.26), new THREE.MeshStandardMaterial({ color: "#284157", emissive: "#163d83", emissiveIntensity: 0.75 }));
    bar.position.set(0, 1.98, cabinZ);
    group.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.24), new THREE.MeshStandardMaterial({ color: "#ee4540", emissive: "#c71d17", emissiveIntensity: 1.2 }));
    red.position.set(-0.28, 2.04, cabinZ);
    group.add(red);
  }

  flattenCarMeshes(group);
  const overlay = new THREE.Group();
  const outline = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(profile.width + 0.28, 1.8, profile.length + 0.55)),
    new THREE.LineBasicMaterial({ color: "#67e4ad", transparent: true, opacity: 0.9 })
  );
  outline.position.y = 1.55;
  overlay.add(outline);
  const tagCanvas = document.createElement("canvas");
  tagCanvas.width = 256;
  tagCanvas.height = 64;
  const tagContext = tagCanvas.getContext("2d");
  tagContext.fillStyle = "rgba(8,20,22,.88)";
  tagContext.fillRect(0, 0, 256, 64);
  tagContext.strokeStyle = "#55d9a2";
  tagContext.strokeRect(1, 1, 254, 62);
  tagContext.fillStyle = "#b9ffdb";
  tagContext.font = "600 20px monospace";
  tagContext.fillText("CV-" + String(100 + index).padStart(3, "0") + "  " + profile.label, 12, 39);
  const tagTexture = new THREE.CanvasTexture(tagCanvas);
  tagTexture.colorSpace = THREE.SRGBColorSpace;
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tagTexture, transparent: true, depthTest: false }));
  tag.position.set(0, 3.2, 0);
  tag.scale.set(4.9, 1.22, 1);
  overlay.add(tag);
  overlay.visible = false;
  group.add(overlay);

  scene.add(group);
  const stopProgress = ROUTE_MID - (14.25 + profile.length / 2);
  return {
    id: index,
    shadowIndex: index - 1,
    group,
    overlay,
    tagContext,
    tagTexture,
    lane,
    profile,
    progress: 0,
    speed: 0,
    active: false,
    pastStop: false,
    stopProgress,
    length: profile.length,
    overlaySpeed: -10,
    incidentPassed: false,
  };
}

function makeSignal(scene, x, z, facing, label, materials, geometry) {
  const post = new THREE.Mesh(geometry.pole, materials.pole);
  post.position.set(x, 3.3, z);
  scene.add(post);
  const arm = new THREE.Mesh(geometry.arm, materials.pole);
  arm.position.set(x * 0.58, 5.4, z * 0.58);
  scene.add(arm);
  const housing = new THREE.Group();
  housing.position.set(x * 0.58, 5.15, z * 0.58);
  housing.rotation.y = facing;
  scene.add(housing);
  const boxMesh = new THREE.Mesh(geometry.signalBox, materials.signal);
  housing.add(boxMesh);
  for (let i = 0; i < 3; i += 1) {
    const lens = new THREE.Mesh(geometry.lens, materials.lamps[i]);
    lens.position.set(0, 0.45 - i * 0.45, 0.39);
    housing.add(lens);
  }
  const plate = new THREE.Mesh(geometry.plate, materials.plate);
  plate.position.set(0, -1.05, 0.04);
  housing.add(plate);
  return { label, lamps: housing.children.slice(1, 4) };
}

function buildWorld(scene) {
  const asphaltTexture = makeAsphaltTexture();
  const asphalt = new THREE.MeshStandardMaterial({ map: asphaltTexture, roughness: 0.9, metalness: 0.02 });
  const road = new THREE.MeshStandardMaterial({ map: asphaltTexture, roughness: 0.82, metalness: 0.1 });
  const concrete = new THREE.MeshStandardMaterial({ color: "#85877e", roughness: 0.88 });
  const curb = new THREE.MeshStandardMaterial({ color: "#b2afa4", roughness: 0.87 });
  const paint = new THREE.MeshStandardMaterial({ color: "#e7e3d3", roughness: 0.78 });
  const yellowPaint = new THREE.MeshStandardMaterial({ color: "#e5b33f", roughness: 0.74 });
  const blackMetal = new THREE.MeshStandardMaterial({ color: "#252d30", roughness: 0.58, metalness: 0.55 });
  const paleMetal = new THREE.MeshStandardMaterial({ color: "#a4a59d", roughness: 0.46, metalness: 0.58 });
  const treeMaterials = [
    new THREE.MeshStandardMaterial({ color: "#3c614b", roughness: 0.96 }),
    new THREE.MeshStandardMaterial({ color: "#55724f", roughness: 0.96 }),
    new THREE.MeshStandardMaterial({ color: "#64754c", roughness: 0.96 }),
  ];
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: "#554a3d", roughness: 0.96 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(150, 150), new THREE.MeshStandardMaterial({ color: "#787b73", roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.1;
  scene.add(ground);

  const eastRoad = new THREE.Mesh(new THREE.PlaneGeometry(130, 19), asphalt);
  eastRoad.rotation.x = -Math.PI / 2;
  eastRoad.position.y = 0;
  scene.add(eastRoad);
  const northRoad = new THREE.Mesh(new THREE.PlaneGeometry(19, 130), road);
  northRoad.rotation.x = -Math.PI / 2;
  northRoad.position.y = 0.012;
  scene.add(northRoad);
  const centerRoad = new THREE.Mesh(new THREE.PlaneGeometry(19, 19), road);
  centerRoad.rotation.x = -Math.PI / 2;
  centerRoad.position.y = 0.018;
  scene.add(centerRoad);

  const whiteMarkings = new THREE.Group();
  scene.add(whiteMarkings);
  const markingGeo = new THREE.PlaneGeometry(0.12, 3.3);
  const yellowGeo = new THREE.PlaneGeometry(0.13, 4.2);
  for (let p = -61; p <= 61; p += 6.3) {
    if (Math.abs(p) < 16) continue;
    const dashA = new THREE.Mesh(markingGeo, paint);
    dashA.rotation.x = -Math.PI / 2;
    dashA.position.set(5.25, 0.035, p);
    whiteMarkings.add(dashA);
    const dashB = new THREE.Mesh(markingGeo, paint);
    dashB.rotation.x = -Math.PI / 2;
    dashB.position.set(-5.25, 0.035, p);
    whiteMarkings.add(dashB);
    const dashC = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 0.12), paint);
    dashC.rotation.x = -Math.PI / 2;
    dashC.position.set(p, 0.04, 5.25);
    whiteMarkings.add(dashC);
    const dashD = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 0.12), paint);
    dashD.rotation.x = -Math.PI / 2;
    dashD.position.set(p, 0.04, -5.25);
    whiteMarkings.add(dashD);
  }
  for (const side of [-1, 1]) {
    const doubleYellow = new THREE.Mesh(yellowGeo, yellowPaint);
    doubleYellow.rotation.x = -Math.PI / 2;
    doubleYellow.position.set(side * 0.22, 0.04, 0);
    doubleYellow.scale.y = 130 / 4.2;
    scene.add(doubleYellow);
    const crossYellow = new THREE.Mesh(new THREE.PlaneGeometry(130, 0.13), yellowPaint);
    crossYellow.rotation.x = -Math.PI / 2;
    crossYellow.position.set(0, 0.045, side * 0.22);
    scene.add(crossYellow);
  }

  // Raised sidewalks and stone curb lines define the corners without obscuring the street.
  for (const axis of ["x", "z"]) {
    for (const side of [-1, 1]) {
      const sidewalk = new THREE.Mesh(new THREE.BoxGeometry(axis === "x" ? 130 : 5.8, 0.24, axis === "z" ? 130 : 5.8), concrete);
      sidewalk.position.set(axis === "x" ? 0 : side * 12.3, 0.12, axis === "z" ? 0 : side * 12.3);
      scene.add(sidewalk);
      const curbLine = new THREE.Mesh(new THREE.BoxGeometry(axis === "x" ? 130 : 0.42, 0.36, axis === "z" ? 130 : 0.42), curb);
      curbLine.position.set(axis === "x" ? 0 : side * 9.55, 0.2, axis === "z" ? 0 : side * 9.55);
      scene.add(curbLine);
    }
  }

  // Crosswalk stripes and stop bars are positioned before the conflict area on each approach.
  for (const approach of [-1, 1]) {
    for (let i = 0; i < 12; i += 1) {
      const offset = -7.7 + i * 1.4;
      const stripeX = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 4.3), paint);
      stripeX.rotation.x = -Math.PI / 2;
      stripeX.position.set(offset, 0.052, approach * 11.2);
      scene.add(stripeX);
      const stripeZ = new THREE.Mesh(new THREE.PlaneGeometry(4.3, 0.78), paint);
      stripeZ.rotation.x = -Math.PI / 2;
      stripeZ.position.set(approach * 11.2, 0.055, offset);
      scene.add(stripeZ);
    }
    const stopNS = new THREE.Mesh(new THREE.PlaneGeometry(11.8, 0.22), paint);
    stopNS.rotation.x = -Math.PI / 2;
    stopNS.position.set(0, 0.057, approach * 14.1);
    scene.add(stopNS);
    const stopEW = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 11.8), paint);
    stopEW.rotation.x = -Math.PI / 2;
    stopEW.position.set(approach * 14.1, 0.06, 0);
    scene.add(stopEW);
  }

  // Small directional arrows sit well upstream of the stop bars.
  function addArrow(axis, fixed, along, direction) {
    const arrow = new THREE.Group();
    arrow.position.set(axis === "x" ? along : fixed, 0.065, axis === "z" ? along : fixed);
    arrow.rotation.y = axis === "x" ? (direction > 0 ? Math.PI / 2 : -Math.PI / 2) : (direction > 0 ? 0 : Math.PI);
    const shaft = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 1.75), paint);
    shaft.rotation.x = -Math.PI / 2;
    arrow.add(shaft);
    for (const side of [-1, 1]) {
      const head = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.8), paint);
      head.rotation.x = -Math.PI / 2;
      head.position.set(side * 0.31, 0.002, 0.48);
      head.rotation.z = -side * 0.7;
      arrow.add(head);
    }
    scene.add(arrow);
  }
  addArrow("z", -2.8, -24, 1);
  addArrow("z", 2.8, 24, -1);
  addArrow("x", -2.8, -24, 1);
  addArrow("x", 2.8, 24, -1);

  // Weathered utility covers, curb drains, and small street fixtures add useful scale cues.
  const manhole = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.055, 24), new THREE.MeshStandardMaterial({ color: "#505553", roughness: 0.74, metalness: 0.22 }));
  const manholeRim = new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.055, 7, 24), paleMetal);
  for (const [x, z] of [[-7, -6], [7, 6], [-24, 6], [27, -6]]) {
    const cover = manhole.clone();
    cover.position.set(x, 0.052, z);
    scene.add(cover);
    const rim = manholeRim.clone();
    rim.rotation.x = Math.PI / 2;
    rim.position.set(x, 0.082, z);
    scene.add(rim);
  }
  const drainGeometry = new THREE.BoxGeometry(0.8, 0.028, 0.24);
  for (const side of [-1, 1]) {
    for (const along of [-28, -5, 18, 39]) {
      const drain = new THREE.Mesh(drainGeometry, blackMetal);
      drain.position.set(along, 0.39, side * 9.65);
      scene.add(drain);
    }
  }

  // Four varied corner blocks, with individual facade materials and roof equipment.
  const facadeSets = [
    { base: "#786e64", trim: "#cbc1ad", window: "#778b90", width: 16, depth: 13, floors: 12, style: "stone" },
    { base: "#874d3c", trim: "#d0a07b", window: "#657c83", width: 14, depth: 15, floors: 9, style: "brick" },
    { base: "#718086", trim: "#bcc5c5", window: "#9aadaf", width: 15, depth: 13, floors: 17, style: "glass" },
    { base: "#a09a87", trim: "#ddd2b8", window: "#60757d", width: 17, depth: 12, floors: 7, style: "stone" },
  ];
  const signMaterial = new THREE.MeshStandardMaterial({ color: "#263842", emissive: "#0c1d25", emissiveIntensity: 0.12, roughness: 0.58 });
  const windowRows = new THREE.MeshStandardMaterial({ color: "#b8a984", roughness: 0.76 });
  const roofMaterial = new THREE.MeshStandardMaterial({ color: "#656761", roughness: 0.87 });
  let buildingId = 0;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const config = facadeSets[buildingId % facadeSets.length];
      const floors = config.floors + Math.floor(seeded(buildingId + 35) * 5);
      const height = floors * 3.05;
      const texture = makeFacadeTexture(config.base, config.trim, config.window);
      const facade = new THREE.MeshStandardMaterial({ map: texture, roughness: config.style === "glass" ? 0.34 : 0.86, metalness: config.style === "glass" ? 0.32 : 0.05 });
      const width = config.width;
      const depth = config.depth;
      const cx = sx * (15.8 + width / 2);
      const cz = sz * (15.8 + depth / 2);
      const building = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), facade);
      building.position.set(cx, height / 2 + 0.24, cz);
      building.castShadow = true;
      building.receiveShadow = true;
      scene.add(building);
      const baseTrim = new THREE.Mesh(new THREE.BoxGeometry(width + 0.3, 0.65, depth + 0.3), windowRows);
      baseTrim.position.set(cx, 0.6, cz);
      scene.add(baseTrim);
      const cornice = new THREE.Mesh(new THREE.BoxGeometry(width + 0.5, 0.42, depth + 0.5), config.style === "brick" ? facade : curb);
      cornice.position.set(cx, height + 0.47, cz);
      scene.add(cornice);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(width - 0.8, 0.35, depth - 0.8), roofMaterial);
      roof.position.set(cx, height + 0.2, cz);
      scene.add(roof);
      const equipment = new THREE.Mesh(new THREE.BoxGeometry(2.4 + seeded(buildingId + 74) * 1.2, 1.5, 2.1), blackMetal);
      equipment.position.set(cx + sx * 3, height + 1.1, cz + sz * 2);
      scene.add(equipment);
      const roofUnit = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.0, 1.5), paleMetal);
      roofUnit.position.set(cx - sx * 2, height + 0.85, cz - sz * 2);
      scene.add(roofUnit);

      // A corner shop awning and glass entry make the first floor read at street scale.
      const awning = new THREE.Mesh(new THREE.BoxGeometry(width * 0.72, 0.25, 1.1), new THREE.MeshStandardMaterial({ color: ["#8b3630", "#b98a36", "#41656a", "#6a4134"][buildingId], roughness: 0.65 }));
      awning.position.set(cx, 3.55, cz - sz * (depth / 2 + 0.56));
      if (sz < 0) awning.rotation.y = Math.PI;
      scene.add(awning);
      const storefront = new THREE.Mesh(new THREE.BoxGeometry(width * 0.72, 2.8, 0.08), new THREE.MeshStandardMaterial({ color: "#35474b", roughness: 0.3, metalness: 0.2 }));
      storefront.position.set(cx, 1.8, cz - sz * (depth / 2 + 0.07));
      scene.add(storefront);
      const sign = new THREE.Mesh(new THREE.BoxGeometry(width * 0.66, 0.55, 0.12), signMaterial);
      sign.position.set(cx, 4.1, cz - sz * (depth / 2 + 0.16));
      scene.add(sign);
      const signCanvas = document.createElement("canvas");
      signCanvas.width = 512;
      signCanvas.height = 96;
      const signContext = signCanvas.getContext("2d");
      signContext.fillStyle = "#24383d";
      signContext.fillRect(0, 0, 512, 96);
      signContext.fillStyle = "#efe7d5";
      signContext.font = "600 43px Arial";
      signContext.textAlign = "center";
      signContext.fillText(["DELI  •  COFFEE", "34TH STREET MARKET", "CITY PHARMACY", "MIDTOWN GRILL"][buildingId], 256, 63);
      const signTexture = new THREE.CanvasTexture(signCanvas);
      signTexture.colorSpace = THREE.SRGBColorSpace;
      const signFace = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.64, 0.46), new THREE.MeshBasicMaterial({ map: signTexture, side: THREE.DoubleSide }));
      signFace.position.set(cx, 4.1, cz - sz * (depth / 2 + 0.235));
      scene.add(signFace);

      // Exterior steel fire escapes on the older brick and stone facades.
      if (config.style !== "glass") {
        const escapeX = cx - sx * (width / 2 + 0.11);
        for (let floor = 2; floor < Math.min(floors, 7); floor += 2) {
          const platform = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.09, 1.05), blackMetal);
          platform.position.set(escapeX, floor * 3.05, cz - sz * (depth * 0.28));
          scene.add(platform);
          const rail = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.72, 0.07), blackMetal);
          rail.position.set(escapeX, floor * 3.05 + 0.36, cz - sz * (depth * 0.28 - 0.45));
          scene.add(rail);
          const ladder = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.85, 0.08), blackMetal);
          ladder.position.set(escapeX, floor * 3.05 - 1.5, cz - sz * (depth * 0.28));
          scene.add(ladder);
        }
      }
      buildingId += 1;
    }
  }

  // Distant midtown skyline blocks establish an urban horizon without filling the road view.
  const skylineMaterial = new THREE.MeshStandardMaterial({ color: "#58666b", roughness: 0.55, metalness: 0.28 });
  for (let i = 0; i < 22; i += 1) {
    const angle = i * 2.399;
    const radius = 61 + seeded(i + 501) * 20;
    const width = 7 + seeded(i + 511) * 8;
    const depth = 7 + seeded(i + 521) * 9;
    const height = 22 + seeded(i + 531) * 68;
    const tower = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), skylineMaterial);
    tower.position.set(Math.cos(angle) * radius, height / 2, Math.sin(angle) * radius);
    scene.add(tower);
  }

  // Street trees remain on the sidewalk, behind the pedestrian curb.
  for (const side of [-1, 1]) {
    for (const along of [-45, -33, -22, 22, 33, 45]) {
      for (const axis of ["x", "z"]) {
        const x = axis === "z" ? side * 12.7 : along;
        const z = axis === "x" ? side * 12.7 : along;
        if (Math.abs(x) < 17 && Math.abs(z) < 17) continue;
        const tree = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 3.6, 8), trunkMaterial);
        trunk.position.y = 1.85;
        tree.add(trunk);
        const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 1), treeMaterials[Math.floor(seeded(Math.abs(x + z)) * treeMaterials.length)]);
        crown.scale.set(1.0, 1.18, 1.0);
        crown.position.y = 4.1;
        crown.castShadow = true;
        tree.add(crown);
        tree.position.set(x, 0.25, z);
        scene.add(tree);
      }
    }
  }

  // Lamp standards, parking meters, and street blades are placed on the sidewalk corners.
  const lampEmissive = new THREE.MeshStandardMaterial({ color: "#f4daa4", emissive: "#f6ce77", emissiveIntensity: 0.35 });
  const lampLights = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 7.2, 8), blackMetal);
      pole.position.set(sx * 10.7, 3.7, sz * 10.7);
      scene.add(pole);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 1.5), blackMetal);
      arm.position.set(sx * 10.7, 7.15, sz * 10.0);
      scene.add(arm);
      const lampHead = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.18, 0.35), lampEmissive);
      lampHead.position.set(sx * 10.7, 7.05, sz * 9.35);
      scene.add(lampHead);
      const streetLight = new THREE.PointLight("#f4dba8", 0, 25, 2);
      streetLight.position.set(sx * 10.7, 6.85, sz * 9.35);
      scene.add(streetLight);
      lampLights.push(streetLight);
      const meter = new THREE.Mesh(new THREE.BoxGeometry(0.26, 1.15, 0.22), new THREE.MeshStandardMaterial({ color: "#53605e", roughness: 0.56, metalness: 0.36 }));
      meter.position.set(sx * 9.9, 0.8, sz * 12.7);
      scene.add(meter);
      const signPost = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 3.8, 7), blackMetal);
      signPost.position.set(sx * 10.25, 2.05, sz * 10.25);
      scene.add(signPost);
      const blade = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.62, 0.11), new THREE.MeshStandardMaterial({ color: "#345e65", roughness: 0.54 }));
      blade.position.set(sx * 9.75, 3.35, sz * 10.25);
      scene.add(blade);
    }
  }

  // Waiting pedestrians add scale but stay clear of vehicle paths.
  const clothing = ["#596c74", "#8b6451", "#71805d", "#505a7b", "#b18253", "#586a65"];
  const clothingMaterials = clothing.map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.88 }));
  const skinMaterial = new THREE.MeshStandardMaterial({ color: "#b18769", roughness: 0.88 });
  for (let i = 0; i < 20; i += 1) {
    const corner = i % 4;
    const sx = corner < 2 ? -1 : 1;
    const sz = corner % 2 === 0 ? -1 : 1;
    const person = new THREE.Group();
    const shirt = clothingMaterials[i % clothingMaterials.length];
    const torso = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.78, 0.28, 2, 0.08), shirt);
    torso.position.y = 1.17;
    person.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), skinMaterial);
    head.position.y = 1.72;
    person.add(head);
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.55, 0.18), blackMetal);
      leg.position.set(side * 0.13, 0.48, 0);
      person.add(leg);
    }
    const offset = Math.floor(i / 4) * 0.7;
    person.position.set(sx * (10.1 + offset), 0.25, sz * (10.2 + offset));
    person.rotation.y = i * 0.78;
    scene.add(person);
  }

  const poleGeo = new THREE.CylinderGeometry(0.12, 0.2, 5.6, 10);
  const armGeo = new THREE.BoxGeometry(4.1, 0.14, 0.14);
  const signalBoxGeo = new RoundedBoxGeometry(0.7, 1.7, 0.7, 2, 0.08);
  const lensGeo = new THREE.SphereGeometry(0.19, 16, 12);
  const plateGeo = new THREE.BoxGeometry(0.72, 0.2, 0.12);
  const signalMaterials = {
    pole: blackMetal,
    signal: new THREE.MeshStandardMaterial({ color: "#111a1c", roughness: 0.54, metalness: 0.46 }),
    plate: new THREE.MeshStandardMaterial({ color: "#3a4949", roughness: 0.64 }),
    lamps: [
      new THREE.MeshStandardMaterial({ color: "#8e2525", emissive: "#d92e25", emissiveIntensity: 1.1 }),
      new THREE.MeshStandardMaterial({ color: "#7b6124", emissive: "#d59a2f", emissiveIntensity: 0.28 }),
      new THREE.MeshStandardMaterial({ color: "#287b50", emissive: "#27d281", emissiveIntensity: 0.26 }),
    ],
  };
  const signalGeometry = { pole: poleGeo, arm: armGeo, signalBox: signalBoxGeo, lens: lensGeo, plate: plateGeo };
  const signals = [
    makeSignal(scene, -10.6, -10.6, Math.PI, "southbound", signalMaterials, signalGeometry),
    makeSignal(scene, 10.6, 10.6, 0, "northbound", signalMaterials, signalGeometry),
    makeSignal(scene, 10.6, -10.6, -Math.PI / 2, "westbound", signalMaterials, signalGeometry),
    makeSignal(scene, -10.6, 10.6, Math.PI / 2, "eastbound", signalMaterials, signalGeometry),
  ];
  compactMeshChildren(scene);
  const incidentMarker = new THREE.Group();
  incidentMarker.visible = false;
  const coneMaterial = new THREE.MeshStandardMaterial({ color: "#e77b3d", roughness: 0.76 });
  const coneStripe = new THREE.MeshStandardMaterial({ color: "#e9e5d8", roughness: 0.65 });
  const coneBase = new THREE.MeshStandardMaterial({ color: "#262b2a", roughness: 0.86 });
  for (const z of [-5, -3.9, -2.8, -1.7, -0.6]) {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.08, 8), coneBase);
    base.position.set(-28.75, 0.1, z);
    incidentMarker.add(base);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.78, 9), coneMaterial);
    cone.position.set(-28.75, 0.51, z);
    incidentMarker.add(cone);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.23, 0.1, 9), coneStripe);
    band.position.set(-28.75, 0.42, z);
    incidentMarker.add(band);
  }
  const incidentBarrier = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.78, 4.9), coneMaterial);
  incidentBarrier.position.set(-29.1, 0.58, -2.8);
  incidentMarker.add(incidentBarrier);
  const barrierStripe = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 4.9), coneStripe);
  barrierStripe.position.set(-29.1, 0.66, -2.8);
  incidentMarker.add(barrierStripe);
  scene.add(incidentMarker);
  return { signals, asphalt, road, lampLights, incidentMarker };
}

function createWeather(scene) {
  const count = 210;
  const positions = new Float32Array(count * 6);
  for (let i = 0; i < count; i += 1) {
    const x = (seeded(i + 3001) - 0.5) * 105;
    const y = 5 + seeded(i + 3002) * 40;
    const z = (seeded(i + 3003) - 0.5) * 105;
    const index = i * 6;
    positions[index] = x;
    positions[index + 1] = y;
    positions[index + 2] = z;
    positions[index + 3] = x - 0.25;
    positions[index + 4] = y - 1.4;
    positions[index + 5] = z - 0.12;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const rain = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: "#a8c6d1", transparent: true, opacity: 0.0 }));
  scene.add(rain);
  return rain;
}

function cameraPreset(mode) {
  const presets = {
    "Aerial": { yaw: 0.76, pitch: 1.28, distance: 108, target: [0, 0, 0] },
    "Overview": { yaw: 0.76, pitch: 0.68, distance: 75, target: [0, 0, 0] },
    "Intersection": { yaw: 0.78, pitch: 1.14, distance: 91, target: [0, 0, 0] },
    "Street-level": { yaw: 0, pitch: 0.12, distance: 39, target: [0, 1.7, 0] },
    "Street": { yaw: 0, pitch: 0.12, distance: 39, target: [0, 1.7, 0] },
    "Traffic cam": { yaw: 0.16, pitch: 0.55, distance: 27, target: [0, 0, 0] },
    "AI Analysis": { yaw: 0.78, pitch: 0.61, distance: 64, target: [0, 0, 0] },
  };
  return presets[mode] || presets.Intersection;
}

export default function CityScene({
  phase = "NS",
  incident = false,
  density = 0.55,
  weather = "clear",
  hour = 17,
  cameraMode = "Intersection",
  paused = false,
  simulationSpeed = 1,
  resetCameraKey = 0,
}) {
  const hostRef = useRef(null);
  const settingsRef = useRef({});
  settingsRef.current = { phase, incident, density, weather, hour, cameraMode, paused, simulationSpeed, resetCameraKey };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#829092");
    scene.fog = new THREE.Fog("#829092", 72, 155);
    const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 260);
    const initialPreset = cameraPreset(settingsRef.current.cameraMode);
    let orbit = { ...initialPreset, target: initialPreset.target.slice() };
    let desiredOrbit = { ...initialPreset, target: initialPreset.target.slice() };
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = false;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.setAttribute("aria-label", "Interactive New York City traffic digital twin");
    host.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight("#dce7e0", "#3c4141", 2.0));
    const sun = new THREE.DirectionalLight("#ffe2b5", 3.2);
    sun.position.set(-45, 74, 32);
    sun.castShadow = false;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -75;
    sun.shadow.camera.right = 75;
    sun.shadow.camera.top = 75;
    sun.shadow.camera.bottom = -75;
    sun.shadow.bias = -0.0004;
    scene.add(sun);
    sun.target.position.set(0, 0, 0);
    scene.add(sun.target);

    const world = buildWorld(scene);
    const rain = createWeather(scene);
    const fleet = [];
    const lanes = LANE_CONFIG.map((config, laneIndex) => {
      const lane = { ...config, cars: [], index: laneIndex, spawnTimer: 0 };
      for (let i = 0; i < MAX_CARS_PER_LANE; i += 1) {
        const profile = FLEET[(i + laneIndex * 3) % FLEET.length];
        const car = createCar(scene, laneIndex * MAX_CARS_PER_LANE + i + 1, lane, profile);
        lane.cars.push(car);
        fleet.push(car);
      }
      return lane;
    });
    const shadowInstances = new THREE.InstancedMesh(
      new THREE.CircleGeometry(1, 20),
      new THREE.MeshBasicMaterial({ color: "#090e10", transparent: true, opacity: 0.26, depthWrite: false }),
      fleet.length
    );
    shadowInstances.frustumCulled = false;
    shadowInstances.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(shadowInstances);
    const shadowTransform = new THREE.Object3D();
    const initialDensity = clamp(settingsRef.current.density, 0.2, 1.4);
    const initialCount = 3 + Math.round(((initialDensity - 0.2) / 1.2) * 6);
    for (const lane of lanes) {
      const lead = lane.cars[0];
      const stop = lead.stopProgress;
      for (let i = 0; i < initialCount; i += 1) {
        const car = lane.cars[i];
        car.active = true;
        car.progress = Math.max(1.5, stop - i * LANE_SPACING);
        car.speed = 0;
        car.pastStop = false;
        car.group.visible = true;
      }
    }

    const lookAt = new THREE.Vector3();
    let previousFrame = performance.now();
    let animationFrame = 0;
    let lastPhase = settingsRef.current.phase;
    let clearanceAxis = null;
    let clearanceElapsed = 0;
    let activePreset = settingsRef.current.cameraMode;
    let lastResetKey = settingsRef.current.resetCameraKey;
    let elapsed = 0;
    let statsAt = performance.now();
    let frameCount = 0;

    const updateCamera = (dt, mode) => {
      if (mode !== activePreset) {
        activePreset = mode;
        const preset = cameraPreset(mode);
        desiredOrbit = { ...preset, target: preset.target.slice() };
      }
      if (settingsRef.current.resetCameraKey !== lastResetKey) {
        lastResetKey = settingsRef.current.resetCameraKey;
        const preset = cameraPreset(mode);
        orbit = { ...preset, target: preset.target.slice() };
        desiredOrbit = { ...preset, target: preset.target.slice() };
      }
      const damping = 1 - Math.exp(-Math.max(dt, 0.001) * 5.6);
      orbit.yaw += (desiredOrbit.yaw - orbit.yaw) * damping;
      orbit.pitch += (desiredOrbit.pitch - orbit.pitch) * damping;
      orbit.distance += (desiredOrbit.distance - orbit.distance) * damping;
      orbit.target[0] += (desiredOrbit.target[0] - orbit.target[0]) * damping;
      orbit.target[1] += (desiredOrbit.target[1] - orbit.target[1]) * damping;
      orbit.target[2] += (desiredOrbit.target[2] - orbit.target[2]) * damping;
      const cosPitch = Math.cos(orbit.pitch);
      camera.position.set(
        orbit.target[0] + orbit.distance * cosPitch * Math.sin(orbit.yaw),
        orbit.target[1] + orbit.distance * Math.sin(orbit.pitch),
        orbit.target[2] + orbit.distance * cosPitch * Math.cos(orbit.yaw)
      );
      lookAt.set(orbit.target[0], orbit.target[1], orbit.target[2]);
      camera.lookAt(lookAt);
    };

    const getCarWorldPosition = (car) => {
      const coord = car.lane.direction * (car.progress - ROUTE_MID);
      if (car.lane.axis === "EW") return [coord, 0, car.lane.fixed];
      return [car.lane.fixed, 0, coord];
    };
    const updateVehicleShadows = () => {
      for (const car of fleet) {
        if (!car.active) {
          shadowTransform.position.set(0, -100, 0);
          shadowTransform.scale.set(0, 0, 0);
        } else {
          const position = getCarWorldPosition(car);
          const yaw = car.lane.axis === "EW"
            ? (car.lane.direction > 0 ? Math.PI / 2 : -Math.PI / 2)
            : (car.lane.direction > 0 ? 0 : Math.PI);
          shadowTransform.position.set(position[0], 0.062, position[2]);
          shadowTransform.rotation.set(-Math.PI / 2, yaw, 0);
          shadowTransform.scale.set(car.profile.width * 0.9, car.length * 0.66, 1);
        }
        shadowTransform.updateMatrix();
        shadowInstances.setMatrixAt(car.shadowIndex, shadowTransform.matrix);
      }
      shadowInstances.instanceMatrix.needsUpdate = true;
    };

    const setSignals = (greenAxis, isClearance, isDark) => {
      for (const signal of world.signals) {
        const lane = lanes.find((candidate) => candidate.key === signal.label);
        const isGreen = !isClearance && lane && lane.axis === greenAxis;
        signal.lamps.forEach((lamp, index) => {
          const material = lamp.material;
      const on = isGreen ? index === 2 : index === 0;
          material.emissiveIntensity = on ? (isDark ? 2.8 : 1.2) : (index === 1 ? 0.18 : 0.035);
        });
      }
    };

    const updateTraffic = (dt, options) => {
      const densityTarget = clamp(options.density, 0.2, 1.4);
      const desiredCount = clamp(3 + Math.round(((densityTarget - 0.2) / 1.2) * 6), 3, MAX_CARS_PER_LANE);
      const rainy = options.weather === "rain";
      const foggy = options.weather === "fog";
      const weatherFactor = rainy ? 0.78 : foggy ? 0.82 : 1;
      const minGap = rainy ? 3.0 : 2.25;
      const physicalGap = 2.05;
      const braking = rainy ? 4.5 : 6.0;
      const dark = options.hour < 6 || options.hour >= 20;
      const allRed = clearanceAxis !== null;
      const greenAxis = allRed ? null : options.phase;

      for (const lane of lanes) {
        const ordered = lane.cars.filter((car) => car.active).sort((a, b) => b.progress - a.progress);
        for (let index = 0; index < ordered.length; index += 1) {
          const car = ordered[index];
          const front = ordered[index - 1];
          if (car.progress > car.stopProgress + 0.12) car.pastStop = true;
          const incidentStop = 26 - car.length / 2 - 1.25;
          if (car.progress >= incidentStop) car.incidentPassed = true;
          const mayEnter = car.pastStop || (!allRed && lane.axis === greenAxis);
          const incidentBlock = options.incident && lane.key === "eastbound";
          const cruise = car.profile.cruise * weatherFactor * (1 - clamp((densityTarget - 0.3) * 0.09, 0, 0.1));
          let targetSpeed = cruise;

          if (front) {
            const gap = front.progress - car.progress - (front.length + car.length) / 2;
            const requiredGap = minGap + car.speed * 0.94 + Math.max(0, car.speed - front.speed) * 0.62;
            const gapSpeed = front.speed + Math.max(0, gap - minGap) * 0.92;
            targetSpeed = Math.min(targetSpeed, gapSpeed);
            if (gap < requiredGap) {
              const safeSpeed = Math.sqrt(Math.max(0, front.speed * front.speed + 2 * braking * Math.max(0, gap - minGap)));
              targetSpeed = Math.min(targetSpeed, safeSpeed);
            }
          }

          if (!mayEnter) {
            const stopDistance = car.stopProgress - car.progress;
            targetSpeed = Math.min(targetSpeed, Math.sqrt(Math.max(0, 2 * braking * Math.max(0, stopDistance))));
          }
          if (incidentBlock && !car.incidentPassed) {
            const distance = incidentStop - car.progress;
            targetSpeed = Math.min(targetSpeed, Math.sqrt(Math.max(0, 2 * braking * Math.max(0, distance))));
          }

          const accel = targetSpeed > car.speed ? 1.75 : braking;
          const speedStep = accel * dt;
          car.speed += clamp(targetSpeed - car.speed, -speedStep, speedStep);
          let nextProgress = car.progress + Math.max(0, car.speed) * dt;

          if (!mayEnter && nextProgress > car.stopProgress) {
            nextProgress = car.stopProgress;
            car.speed = Math.min(car.speed, 0.18);
          }
          if (incidentBlock && !car.incidentPassed) {
            if (nextProgress > incidentStop) {
              nextProgress = incidentStop;
              car.speed = Math.min(car.speed, 0.18);
            }
          }
          if (front) {
            const maximum = front.progress - (front.length + car.length) / 2 - physicalGap;
            if (nextProgress > maximum) {
              nextProgress = maximum;
              car.speed = Math.min(car.speed, front.speed);
            }
          }
          car.progress = nextProgress;

          if (car.progress > ROUTE_LENGTH + car.length / 2 + 1) {
            car.active = false;
            car.pastStop = false;
            car.speed = 0;
            car.group.visible = false;
          } else {
            const worldPosition = getCarWorldPosition(car);
            car.group.position.set(worldPosition[0], 0, worldPosition[2]);
            if (lane.axis === "EW") car.group.rotation.y = lane.direction > 0 ? Math.PI / 2 : -Math.PI / 2;
            else car.group.rotation.y = lane.direction > 0 ? 0 : Math.PI;
          }
        }
      }

      // Object-pool arrivals enter from the street edge only after a full safe gap opens.
      for (const lane of lanes) {
        let active = lane.cars.filter((car) => car.active).sort((a, b) => b.progress - a.progress);
        if (active.length >= desiredCount) continue;
        lane.spawnTimer = Math.min(1.2, lane.spawnTimer + dt);
        if (lane.spawnTimer < 1.1) continue;
        const candidate = lane.cars.find((car) => !car.active);
        if (!candidate) continue;
        const tail = active.length ? active[active.length - 1] : null;
        const entryProgress = 1.2;
        const entryGap = tail ? tail.progress - entryProgress - (tail.length + candidate.length) / 2 : Infinity;
        if (entryGap < LANE_SPACING + 1.6) continue;
        candidate.progress = entryProgress;
        candidate.speed = 0;
        candidate.pastStop = false;
        candidate.incidentPassed = false;
        candidate.active = true;
        candidate.group.visible = true;
        const worldPosition = getCarWorldPosition(candidate);
        candidate.group.position.set(worldPosition[0], 0, worldPosition[2]);
        candidate.group.rotation.y = lane.axis === "EW" ? (lane.direction > 0 ? Math.PI / 2 : -Math.PI / 2) : (lane.direction > 0 ? 0 : Math.PI);
        lane.spawnTimer = 0;
      }
      updateVehicleShadows();

      if (clearanceAxis !== null) {
        clearanceElapsed += dt;
        const draining = lanes.filter((lane) => lane.axis === clearanceAxis);
        const stillInside = draining.some((lane) => lane.cars.some((car) =>
          car.active && car.pastStop && car.progress < ROUTE_MID + INTERSECTION_HALF + car.length / 2
        ));
        if (clearanceElapsed >= 1.25 && !stillInside) clearanceAxis = null;
      }

      // Only the two nearest waiting vehicles on each approach receive restrained CV labels.
      for (const lane of lanes) {
        const visible = lane.cars.filter((car) => car.active && car.progress > 15 && car.progress < 61)
          .sort((a, b) => Math.abs(a.stopProgress - a.progress) - Math.abs(b.stopProgress - b.progress));
        for (let i = 0; i < visible.length; i += 1) {
          const car = visible[i];
          const show = options.cameraMode === "AI Analysis" && i < 2;
          car.overlay.visible = show;
          if (show && elapsed - car.overlaySpeed > 1.1) {
            car.tagContext.clearRect(0, 0, 256, 64);
            car.tagContext.fillStyle = "rgba(8,20,22,.9)";
            car.tagContext.fillRect(0, 0, 256, 64);
            car.tagContext.strokeStyle = "#55d9a2";
            car.tagContext.strokeRect(1, 1, 254, 62);
            car.tagContext.fillStyle = "#b9ffdb";
            car.tagContext.font = "600 20px monospace";
            car.tagContext.fillText("CV-" + String(100 + car.id).padStart(3, "0") + "  " + Math.round(car.speed * 3.6) + " km/h", 12, 39);
            car.tagTexture.needsUpdate = true;
            car.overlaySpeed = elapsed;
          }
        }
        for (const car of lane.cars) {
          if (!visible.includes(car)) car.overlay.visible = false;
        }
      }
      const visibleCars = fleet.filter((car) => car.active);
      let overlapCount = 0;
      const overlapPairs = [];
      for (let i = 0; i < visibleCars.length; i += 1) {
        const a = visibleCars[i];
        const aPos = getCarWorldPosition(a);
        const aHalfX = (a.lane.axis === "EW" ? a.length : a.profile.width + 0.24) / 2;
        const aHalfZ = (a.lane.axis === "NS" ? a.length : a.profile.width + 0.24) / 2;
        for (let j = i + 1; j < visibleCars.length; j += 1) {
          const b = visibleCars[j];
          const bPos = getCarWorldPosition(b);
          const bHalfX = (b.lane.axis === "EW" ? b.length : b.profile.width + 0.24) / 2;
          const bHalfZ = (b.lane.axis === "NS" ? b.length : b.profile.width + 0.24) / 2;
          if (Math.abs(aPos[0] - bPos[0]) < aHalfX + bHalfX - 0.16 &&
              Math.abs(aPos[2] - bPos[2]) < aHalfZ + bHalfZ - 0.16) {
            overlapCount += 1;
            overlapPairs.push(a.id + ":" + a.lane.key + ":" + a.progress.toFixed(1) + "/" + b.id + ":" + b.lane.key + ":" + b.progress.toFixed(1));
          }
        }
      }
      host.dataset.vehicleOverlaps = String(overlapCount);
      host.dataset.vehicleOverlapPairs = overlapPairs.join("|");
      host.dataset.activeVehicles = String(visibleCars.length);
      host.dataset.signalMode = allRed ? "all-red-clearance" : greenAxis;
      host.dataset.clearanceAxis = clearanceAxis || "none";
      host.dataset.clearanceElapsed = clearanceElapsed.toFixed(1);
      host.dataset.clearanceBlockers = clearanceAxis === null ? "" : lanes
        .filter((lane) => lane.axis === clearanceAxis)
        .flatMap((lane) => lane.cars.filter((car) => car.active && car.pastStop &&
          car.progress < ROUTE_MID + INTERSECTION_HALF + car.length / 2)
          .map((car) => car.id + ":" + car.progress.toFixed(1) + "/" + car.speed.toFixed(1)))
        .join("|");
      world.incidentMarker.visible = options.incident;
      setSignals(greenAxis, allRed, dark);
    };

    let pointer = null;
    const canvas = renderer.domElement;
    const onPointerDown = (event) => {
      if (event.button !== 0 && event.button !== 2) return;
      pointer = { x: event.clientX, y: event.clientY, button: event.button, shift: event.shiftKey };
      canvas.setPointerCapture?.(event.pointerId);
    };
    const onPointerMove = (event) => {
      if (!pointer) return;
      const dx = event.clientX - pointer.x;
      const dy = event.clientY - pointer.y;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      if (pointer.button === 2 || pointer.shift) {
        const panScale = desiredOrbit.distance * 0.0017;
        const rightX = Math.cos(desiredOrbit.yaw);
        const rightZ = -Math.sin(desiredOrbit.yaw);
        desiredOrbit.target[0] += (-dx * rightX + dy * Math.sin(desiredOrbit.pitch) * Math.sin(desiredOrbit.yaw)) * panScale;
        desiredOrbit.target[2] += (-dx * rightZ - dy * Math.sin(desiredOrbit.pitch) * Math.cos(desiredOrbit.yaw)) * panScale;
        desiredOrbit.target[1] = clamp(desiredOrbit.target[1] + dy * Math.cos(desiredOrbit.pitch) * panScale, -2, 18);
      } else {
        desiredOrbit.yaw -= dx * 0.006;
        desiredOrbit.pitch = clamp(desiredOrbit.pitch + dy * 0.0048, 0.045, 1.43);
      }
    };
    const onPointerUp = () => { pointer = null; };
    const onWheel = (event) => {
      event.preventDefault();
      desiredOrbit.distance = clamp(desiredOrbit.distance * (event.deltaY > 0 ? 1.09 : 0.92), 16, 138);
    };
    const onContextMenu = (event) => event.preventDefault();
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("contextmenu", onContextMenu);

    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    const animate = (now) => {
      animationFrame = requestAnimationFrame(animate);
      const settings = settingsRef.current;
      const rawDt = Math.max(0, (now - previousFrame) / 1000);
      previousFrame = now;
      const dt = settings.paused ? 0 : Math.min(1.0, rawDt) * clamp(settings.simulationSpeed, 0.5, 2.5);
      elapsed += dt;

      if (settings.phase !== lastPhase) {
        clearanceAxis = lastPhase;
        clearanceElapsed = 0;
        lastPhase = settings.phase;
      }
      updateCamera(Math.min(rawDt, 0.25), settings.cameraMode);
      const simulationSteps = Math.max(1, Math.ceil(dt / 0.05));
      for (let step = 0; step < simulationSteps; step += 1) updateTraffic(dt / simulationSteps, settings);

      const isNight = settings.hour < 6 || settings.hour >= 20;
      const rainy = settings.weather === "rain";
      const foggy = settings.weather === "fog";
      const color = isNight ? new THREE.Color("#1c292e") : foggy ? new THREE.Color("#a2a7a0") : rainy ? new THREE.Color("#66777b") : new THREE.Color("#8a9996");
      scene.background.copy(color);
      scene.fog.color.copy(color);
      scene.fog.near = foggy ? 32 : 72;
      scene.fog.far = foggy ? 110 : 155;
      sun.intensity = isNight ? 0.48 : rainy || foggy ? 2.05 : 3.2;
      sun.color.set(isNight ? "#7186a4" : rainy ? "#c2d1d1" : "#ffe2b5");
      renderer.toneMappingExposure = isNight ? 0.86 : 1.08;
      world.lampLights.forEach((light) => { light.intensity = isNight ? 11 : 0; });
      world.asphalt.roughness = rainy ? 0.57 : 0.9;
      world.road.roughness = rainy ? 0.54 : 0.82;
      rain.material.opacity = rainy ? 0.24 : 0.0;
      if (rainy && dt > 0) {
        const position = rain.geometry.attributes.position;
        for (let i = 0; i < position.count; i += 2) {
          let y = position.getY(i) - dt * 24;
          if (y < 0.7) {
            y = 28 + seeded(i + Math.floor(elapsed * 3)) * 17;
            position.setX(i, (seeded(i + elapsed * 0.2) - 0.5) * 105);
            position.setZ(i, (seeded(i + 700) - 0.5) * 105);
          }
          position.setY(i, y);
          position.setY(i + 1, y - 1.4);
          position.setX(i + 1, position.getX(i) - 0.25);
          position.setZ(i + 1, position.getZ(i) - 0.12);
        }
        position.needsUpdate = true;
      }
      renderer.render(scene, camera);
      frameCount += 1;
      if (now - statsAt >= 1000) {
        host.dataset.sceneFps = String(Math.round(frameCount * 1000 / (now - statsAt)));
        host.dataset.sceneDrawCalls = String(renderer.info.render.calls);
        host.dataset.sceneFrameMs = String(Math.round(rawDt * 1000));
        frameCount = 0;
        statsAt = now;
      }
    };
    animationFrame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("contextmenu", onContextMenu);
      scene.traverse((item) => {
        if (item.geometry) item.geometry.dispose();
        if (item.material) {
          const materials = Array.isArray(item.material) ? item.material : [item.material];
          for (const material of materials) {
            if (material.map) material.map.dispose();
            material.dispose();
          }
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div className="city-scene" ref={hostRef} role="img" aria-label="Interactive New York City traffic intersection digital twin">
    <div className="scene-overlay-label"><span><i/>LIVE DIGITAL TWIN</span>{cameraMode === "AI Analysis" && <span className="cv-overlay-chip">CV TRACKING · IDs / SPEED</span>}</div>
    <div className="scene-compass">{cameraMode === "Street-level" || cameraMode === "Street" ? "STREET VIEW" : cameraMode === "Traffic cam" ? "CAM-07 · TRAFFIC CAM" : cameraMode === "AI Analysis" ? "AI PERCEPTION LAYER" : "MIDTOWN · 34 ST"}</div>
  </div>;
}
