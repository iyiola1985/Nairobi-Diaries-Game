import * as THREE from 'three';
import { miterEdges, type JunctionPad, type RoadLine } from './roads';

export function extrudeFootprints(
  items: { polygon: [number, number][]; height: number; lift?: number; style?: number }[],
): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];
  for (const item of items) {
    if (item.polygon.length < 3 || item.height <= 0) continue;
    const shape = new THREE.Shape();
    item.polygon.forEach(([x, z], index) => {
      const y = -z;
      if (index === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    });
    try {
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: item.height, bevelEnabled: false });
      // shape Y is -worldZ. rotateX(-90°) maps that back to +Z and extrusion to +Y.
      geometry.rotateX(-Math.PI / 2);
      if (item.lift) geometry.translate(0, item.lift, 0);
      const flat = geometry.index ? geometry.toNonIndexed() : geometry;
      if (flat !== geometry) geometry.dispose();
      const count = flat.getAttribute('position')?.count ?? 0;
      if (count > 0) {
        const style = new Float32Array(count);
        style.fill(item.style ?? 0);
        flat.setAttribute('aStyle', new THREE.BufferAttribute(style, 1));
      }
      geometries.push(flat);
    } catch {
      continue;
    }
  }
  if (geometries.length === 0) return new THREE.BufferGeometry();
  const merged = mergeGeometries(geometries);
  geometries.forEach((geometry) => geometry.dispose());
  return merged ?? new THREE.BufferGeometry();
}

/** A thin vertical ribbon for compound walls. It is visual only and does not block walking. */
export function wallGeometry(lines: { points: [number, number][] }[], height: number): THREE.BufferGeometry {
  const positions: number[] = [];
  for (const line of lines) {
    const pts = line.points;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, z1] = pts[i];
      const [x2, z2] = pts[i + 1];
      let dx = x2 - x1;
      let dz = z2 - z1;
      const len = Math.hypot(dx, dz);
      if (len < 0.25 || len > 80) continue;
      dx /= len;
      dz /= len;
      const ox = -dz * 0.09;
      const oz = dx * 0.09;
      positions.push(
        x1 - ox, 0, z1 - oz, x2 - ox, 0, z2 - oz, x2 - ox, height, z2 - oz,
        x1 - ox, 0, z1 - oz, x2 - ox, height, z2 - oz, x1 - ox, height, z1 - oz,
        x1 + ox, 0, z1 + oz, x1 + ox, height, z1 + oz, x2 + ox, height, z2 + oz,
        x1 + ox, 0, z1 + oz, x2 + ox, height, z2 + oz, x2 + ox, 0, z2 + oz,
      );
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function postGeometry(points: [number, number][], height: number, size: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const half = size / 2;
  for (const [x, z] of points) {
    const corners: [number, number][] = [
      [x - half, z - half],
      [x + half, z - half],
      [x + half, z + half],
      [x - half, z + half],
    ];
    for (let i = 0; i < 4; i++) {
      const [x1, z1] = corners[i]!;
      const [x2, z2] = corners[(i + 1) % 4]!;
      positions.push(x1, 0, z1, x2, 0, z2, x2, height, z2, x1, 0, z1, x2, height, z2, x1, height, z1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function joinedRibbon(lines: RoadLine[], y: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  for (const line of lines) {
    if (line.points.length < 2 || line.width <= 0) continue;
    const edges = miterEdges(line.points, line.width / 2);
    let travelled = 0;
    for (let i = 0; i < edges.length - 1; i++) {
      const start = edges[i];
      const end = edges[i + 1];
      if (!start || !end) continue;
      const span = Math.hypot((start.left[0] + start.right[0]) / 2 - (end.left[0] + end.right[0]) / 2, (start.left[1] + start.right[1]) / 2 - (end.left[1] + end.right[1]) / 2);
      const next = travelled + span;
      positions.push(
        start.left[0], y, start.left[1], start.right[0], y, start.right[1], end.right[0], y, end.right[1],
        start.left[0], y, start.left[1], end.right[0], y, end.right[1], end.left[0], y, end.left[1],
      );
      uvs.push(0, travelled, 1, travelled, 1, next, 0, travelled, 1, next, 0, next);
      travelled = next;
    }
  }
  const geometry = new THREE.BufferGeometry();
  if (positions.length > 0) {
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  }
  geometry.computeVertexNormals();
  return geometry;
}

export function discGeometry(discs: JunctionPad[], y: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const wedges = 12;
  for (const disc of discs) {
    for (let i = 0; i < wedges; i++) {
      const a0 = (i / wedges) * Math.PI * 2;
      const a1 = ((i + 1) / wedges) * Math.PI * 2;
      positions.push(
        disc.x, y, disc.z,
        disc.x + Math.cos(a0) * disc.radius, y, disc.z + Math.sin(a0) * disc.radius,
        disc.x + Math.cos(a1) * disc.radius, y, disc.z + Math.sin(a1) * disc.radius,
      );
    }
  }
  const geometry = new THREE.BufferGeometry();
  if (positions.length > 0) geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function ribbonGeometry(lines: { points: [number, number][]; width: number }[], y: number): THREE.BufferGeometry {
  const positions: number[] = [];
  for (const line of lines) {
    const pts = line.points;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, z1] = pts[i];
      const [x2, z2] = pts[i + 1];
      let dx = x2 - x1;
      let dz = z2 - z1;
      const len = Math.hypot(dx, dz);
      if (len < 0.15) continue;
      dx /= len;
      dz /= len;
      const px = -dz * (line.width / 2);
      const pz = dx * (line.width / 2);
      const ax = x1 + px;
      const az = z1 + pz;
      const bx = x1 - px;
      const bz = z1 - pz;
      const cx = x2 - px;
      const cz = z2 - pz;
      const ex = x2 + px;
      const ez = z2 + pz;
      positions.push(ax, y, az, bx, y, bz, cx, y, cz, ax, y, az, cx, y, cz, ex, y, ez);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
  const first = geometries[0];
  if (!first) return null;
  let offset = 0;
  const positions: number[] = [];
  const normals: number[] = [];
  const styles: number[] = [];
  for (const geometry of geometries) {
    const position = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    const style = geometry.getAttribute('aStyle');
    if (!position) continue;
    for (let i = 0; i < position.count; i++) {
      positions.push(position.getX(i), position.getY(i), position.getZ(i));
      if (normal) normals.push(normal.getX(i), normal.getY(i), normal.getZ(i));
      styles.push(style ? style.getX(i) : 0);
    }
    offset += position.count;
  }
  if (offset === 0) return null;
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (normals.length === positions.length) merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  else merged.computeVertexNormals();
  if (styles.length === offset) merged.setAttribute('aStyle', new THREE.Float32BufferAttribute(styles, 1));
  return merged;
}

export function makePrintTexture(base: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#f3ead8';
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(8 + i * 32, 8, 10, 112);
    ctx.beginPath();
    ctx.arc(24 + i * 28, 36 + (i % 2) * 40, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#1c140f';
  ctx.lineWidth = 3;
  ctx.strokeRect(6, 6, 116, 116);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function makeWindowTexture(lit: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  if (!ctx) return texture;
  ctx.fillStyle = lit ? '#8d877d' : '#d9d3c8';
  ctx.fillRect(0, 0, 128, 128);
  for (let y = 8; y < 120; y += 22) {
    for (let x = 8; x < 120; x += 18) {
      const on = ((x * 3 + y * 7) % 11) > 4;
      ctx.fillStyle = lit && on ? '#f0c27a' : lit ? '#6e8494' : '#b7c6d2';
      ctx.fillRect(x, y, 10, 14);
    }
  }
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 2);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function makeLabelTexture(text: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  if (!ctx) return texture;
  ctx.clearRect(0, 0, 512, 128);
  ctx.fillStyle = '#f4f0e8';
  roundRect(ctx, 8, 24, 496, 80, 18);
  ctx.fill();
  ctx.strokeStyle = '#272b2e';
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.fillStyle = '#272b2e';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let size = 42;
  ctx.font = `600 ${size}px Outfit, sans-serif`;
  while (size > 18 && ctx.measureText(text).width > 460) {
    size -= 2;
    ctx.font = `600 ${size}px Outfit, sans-serif`;
  }
  ctx.fillText(text, 256, 66);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function skyColors(time: 'day' | 'sunset' | 'evening' | 'night'): {
  top: string;
  horizon: string;
  fog: string;
  sun: string;
  ambient: number;
  sunIntensity: number;
  fogDensity: number;
  inclination: number;
} {
  switch (time) {
    case 'day':
      return { top: '#6ea4d0', horizon: '#f4ead8', fog: '#e7ddcf', sun: '#fff1d6', ambient: 0.78, sunIntensity: 2.05, fogDensity: 0.0028, inclination: 0.95 };
    case 'sunset':
      return { top: '#24344c', horizon: '#e88858', fog: '#c47a58', sun: '#ffc08a', ambient: 0.32, sunIntensity: 1.9, fogDensity: 0.006, inclination: 0.22 };
    case 'evening':
      return { top: '#151a2a', horizon: '#c46a58', fog: '#6a403c', sun: '#ffb58a', ambient: 0.55, sunIntensity: 1.6, fogDensity: 0.012, inclination: 0.08 };
    case 'night':
      return { top: '#070910', horizon: '#1a2236', fog: '#121722', sun: '#b7c6dc', ambient: 0.62, sunIntensity: 0.85, fogDensity: 0.014, inclination: -0.2 };
    default: {
      const _exhaustive: never = time;
      return _exhaustive;
    }
  }
}

const plaster = new Map<string, THREE.MeshStandardMaterial>();

/**
 * Plaster colour plus a storey-sized window grid in world metres.
 * The grid is painted on the existing footprint extrusion. It does not move the polygon.
 */
export function plasterMaterial(tint: string, _windows: THREE.Texture | null, lit: boolean): THREE.MeshStandardMaterial {
  const key = `${tint}|${lit ? 'on' : 'off'}`;
  const existing = plaster.get(key);
  if (existing) return existing;
  const material = new THREE.MeshStandardMaterial({
    color: tint,
    roughness: 0.82,
    metalness: 0.02,
  });
  material.customProgramCacheKey = () => `facade-${key}`;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindowLit = { value: lit ? 1 : 0 };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFacadePos;\nvarying vec3 vFacadeN;\nvarying float vStyle;\nattribute float aStyle;\n')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vFacadePos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vFacadeN = normalize(mat3(modelMatrix) * objectNormal);
        vStyle = aStyle;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vFacadePos;\nvarying vec3 vFacadeN;\nvarying float vStyle;\nuniform float uWindowLit;\nfloat facadeWindow;\n',
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          vec3 n = normalize(vFacadeN);
          float roof = smoothstep(0.52, 0.8, n.y);
          float along = abs(n.x) > abs(n.z) ? vFacadePos.z : vFacadePos.x;
          float y = max(vFacadePos.y, 0.0);
          float f = fract(y / 3.15);
          float ledge = (1.0 - roof) * (1.0 - smoothstep(0.0, 0.16, f));
          float sill = (1.0 - roof) * smoothstep(0.72, 0.78, f) * (1.0 - smoothstep(0.86, 0.92, f));
          float winY = smoothstep(0.14, 0.2, f) * (1.0 - smoothstep(0.8, 0.88, f));
          float officeBand = step(2.5, vStyle) * (1.0 - step(3.5, vStyle));
          float houseBand = step(3.5, vStyle) * (1.0 - step(4.5, vStyle));
          float olderBand = step(5.5, vStyle);
          float cell = officeBand > 0.5 ? 2.8 : houseBand > 0.5 ? 2.4 : olderBand > 0.5 ? 4.6 : 3.4;
          float wx = fract(along / cell);
          float winX = smoothstep(0.12, 0.18, wx) * (1.0 - smoothstep(0.82, 0.88, wx));
          float pier = (1.0 - smoothstep(0.0, 0.07, min(wx, 1.0 - wx)));
          float above = step(3.2, y);
          float house = step(3.5, vStyle) * (1.0 - step(4.5, vStyle));
          float plain = step(4.5, vStyle) * (1.0 - step(5.5, vStyle));
          float older = step(5.5, vStyle);
          float wall = (1.0 - roof) * (1.0 - plain);
          facadeWindow = winX * winY * above * wall * (house > 0.5 ? 0.65 : 1.0);
          float frameX = smoothstep(0.05, 0.09, wx) * (1.0 - smoothstep(0.91, 0.95, wx));
          float frameY = smoothstep(0.08, 0.12, f) * (1.0 - smoothstep(0.88, 0.93, f));
          float frame = frameX * frameY * above * wall;
          float shop = wall * (1.0 - above) * (1.0 - house * 0.65);
          float pane = fract(along / 4.4);
          float shopPane = shop * smoothstep(0.06, 0.12, pane) * (1.0 - smoothstep(0.88, 0.94, pane)) * smoothstep(0.35, 0.55, y) * (1.0 - smoothstep(2.7, 3.05, y));
          float apt = step(0.5, vStyle) * (1.0 - step(1.5, vStyle));
          float balcony = apt * above * (1.0 - roof) * winY * smoothstep(0.08, 0.16, wx) * (1.0 - smoothstep(0.84, 0.92, wx));
          float office = step(2.5, vStyle) * (1.0 - step(3.5, vStyle));
          float ac = office * above * (1.0 - roof) * smoothstep(0.8, 0.86, wx) * (1.0 - smoothstep(0.96, 1.0, wx)) * smoothstep(0.36, 0.44, f) * (1.0 - smoothstep(0.56, 0.64, f));
          vec3 plasterCol = diffuseColor.rgb;
          float occupied = step(0.42, fract(sin(dot(floor(vec2(along * 0.17, y / 3.15)), vec2(21.3, 9.2))) * 43758.5));
          vec3 glass = mix(vec3(0.48, 0.56, 0.62), vec3(0.98, 0.74, 0.4), uWindowLit * occupied);
          float grime = older * fract(sin(dot(floor(vFacadePos.xz * 0.35), vec2(19.1, 7.7))) * 43758.5);
          float contact = (1.0 - roof) * (1.0 - smoothstep(0.0, 0.6, y));
          float plinth = wall * (1.0 - smoothstep(0.0, 0.38, y));
          diffuseColor.rgb = mix(plasterCol, plasterCol * vec3(0.42, 0.38, 0.34), ledge * wall);
          diffuseColor.rgb = mix(diffuseColor.rgb, plasterCol * vec3(0.55, 0.5, 0.46), pier * wall * (1.0 - roof));
          diffuseColor.rgb = mix(diffuseColor.rgb, plasterCol * vec3(0.9, 0.86, 0.8), sill * wall * 0.8);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.45, 0.4, 0.35), plinth * 0.55);
          diffuseColor.rgb = mix(diffuseColor.rgb, plasterCol * vec3(0.52, 0.46, 0.38), shop * 0.62);
          diffuseColor.rgb = mix(diffuseColor.rgb, plasterCol * 0.62, balcony * 0.75 * wall);
          diffuseColor.rgb = mix(diffuseColor.rgb, plasterCol * 0.34, ac * wall);
          diffuseColor.rgb = mix(diffuseColor.rgb, plasterCol * 0.42, frame * (1.0 - facadeWindow));
          diffuseColor.rgb = mix(diffuseColor.rgb, glass, clamp(facadeWindow + shopPane, 0.0, 1.0));
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.72, 0.66, 0.58), grime * 0.65);
          diffuseColor.rgb *= mix(1.0, 0.84, contact * 0.55);
          facadeWindow = max(facadeWindow, shopPane);
          facadeWindow *= mix(1.0, occupied, uWindowLit);
        }`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0, 0.72, 0.42) * facadeWindow * uWindowLit * 0.38;',
      )
      .replace(
        '#include <metalnessmap_fragment>',
        '#include <metalnessmap_fragment>\nmetalnessFactor = max(metalnessFactor, clamp(facadeWindow, 0.0, 1.0) * 0.08);',
      )
      .replace(
        '#include <roughnessmap_fragment>',
        '#include <roughnessmap_fragment>\nfloat grit = fract(sin(dot(vFacadePos.xz, vec2(17.1, 3.7))) * 43758.5);\nroughnessFactor = mix(0.74, 0.93, grit);\nroughnessFactor = mix(roughnessFactor, 0.34, clamp(facadeWindow, 0.0, 1.0));',
      );
  };
  plaster.set(key, material);
  return material;
}

const silhouettes = new Map<string, THREE.MeshStandardMaterial>();

/** Distant mass. A coarse floor line keeps the storeys without the window grid. */
export function silhouetteMaterial(tint: string): THREE.MeshStandardMaterial {
  const existing = silhouettes.get(tint);
  if (existing) return existing;
  const material = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.9, metalness: 0 });
  material.customProgramCacheKey = () => `silhouette-${tint}`;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMassPos;\nvarying vec3 vMassN;\n')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vMassPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vMassN = normalize(mat3(modelMatrix) * objectNormal);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMassPos;\nvarying vec3 vMassN;\n')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          float roof = smoothstep(0.55, 0.82, normalize(vMassN).y);
          float storey = fract(max(vMassPos.y, 0.0) / 6.3);
          float floorLine = (1.0 - roof) * (1.0 - smoothstep(0.0, 0.08, storey));
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.78, 0.74, 0.68), floorLine);
        }`,
      );
  };
  silhouettes.set(tint, material);
  return material;
}

const surfaces = new Map<string, THREE.MeshStandardMaterial>();

/** World-space grain on the existing road ribbons. The ribbon geometry is unchanged. */
export function surfaceMaterial(kind: 'asphalt' | 'pavement' | 'service' | 'footway', rain: boolean): THREE.MeshStandardMaterial {
  const key = `${kind}|${rain ? 'wet' : 'dry'}`;
  const existing = surfaces.get(key);
  if (existing) return existing;
  const color = kind === 'asphalt' ? (rain ? '#2a2e32' : '#555c62') : kind === 'service' ? (rain ? '#3a342e' : '#5a534c') : kind === 'footway' ? '#d4cbbd' : '#cfc3b2';
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: rain ? 0.38 : kind === 'asphalt' ? 0.92 : 0.96,
    metalness: rain ? 0.08 : 0,
  });
  material.customProgramCacheKey = () => `surface-${key}`;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRoadPos;\nvarying vec2 vRoadUv;\n')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vRoadPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vRoadUv = vec2(0.0);
        #ifdef USE_UV
          vRoadUv = uv;
        #endif`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRoadPos;\nvarying vec2 vRoadUv;\n')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          float grain = ${kind === 'asphalt' || kind === 'service' ? '1.0' : '0.0'};
          float n = fract(sin(dot(floor(vRoadPos.xz * 2.2), vec2(12.9898, 78.233))) * 43758.5453);
          float aligned = step(0.02, vRoadUv.y);
          float along = vRoadUv.y;
          float across = vRoadUv.x;
          float alongEdge = min(fract(along / 1.25), 1.0 - fract(along / 1.25));
          float acrossEdge = min(fract(across * 2.5), 1.0 - fract(across * 2.5));
          float joint = (1.0 - grain) * aligned * max(1.0 - smoothstep(0.0, 0.028, alongEdge), 1.0 - smoothstep(0.0, 0.04, acrossEdge));
          float wearBand = fract(sin(dot(floor(vec2(along * 0.07, across * 3.0)), vec2(19.1, 7.7))) * 43758.5);
          float wear = grain * aligned * smoothstep(0.86, 0.98, wearBand) * 0.1;
          float worldWearBand = fract(sin(dot(floor(vRoadPos.xz * 0.07), vec2(19.1, 7.7))) * 43758.5);
          float worldWear = grain * smoothstep(0.93, 0.995, worldWearBand) * 0.08;
          float lane = min(abs(across - 0.32), abs(across - 0.68));
          float wheel = grain * aligned * (1.0 - smoothstep(0.0, 0.07, lane)) * 0.05;
          diffuseColor.rgb *= mix(0.94, 1.04, n);
          diffuseColor.rgb *= 1.0 - wear - worldWear - wheel;
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.62, joint);
          float kerb = grain * (1.0 - smoothstep(0.0, 0.06, min(across, 1.0 - across)));
          float dashOn = step(0.4, fract(along * 0.2));
          float dash = grain * aligned * dashOn * (1.0 - smoothstep(0.0, 0.014, abs(across - 0.5)));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.76, 0.72, 0.66), kerb);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.82, 0.72, 0.36), dash);
        }`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        '#include <roughnessmap_fragment>\nfloat roadGrit = fract(sin(dot(floor(vRoadPos.xz * 2.2), vec2(12.9, 78.2))) * 43758.5);\nroughnessFactor = mix(roughnessFactor * 0.88, min(roughnessFactor, 0.96), roadGrit);',
      );
  };
  surfaces.set(key, material);
  return material;
}
