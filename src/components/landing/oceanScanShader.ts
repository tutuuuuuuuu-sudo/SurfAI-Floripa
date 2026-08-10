import * as THREE from 'three'
import { shaderMaterial } from '@react-three/drei'
import { extend } from '@react-three/fiber'

// vec3 abaixo é a conversão sRGB de oklch(0.6 0.16 200) (--primary, dark mode,
// src/index.css) — GLSL não consome OKLCH direto num uniform. Se essa variável
// de tema mudar, recalcular e atualizar aqui.
const ACCENT_COLOR = new THREE.Color('#009aa6')

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  precision mediump float;

  uniform sampler2D uPhoto;
  uniform sampler2D uDepth;
  uniform float uHasDepth;
  uniform float uScanProgress;
  uniform vec2 uPointer;
  uniform float uDotScale;
  uniform vec2 uResolution;
  uniform vec3 uAccentColor;
  uniform vec2 uPhotoScale;
  uniform vec2 uPhotoOffset;

  varying vec2 vUv;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  void main() {
    vec2 uv = vUv;

    float depth = uHasDepth > 0.5 ? texture2D(uDepth, uv).r : 0.5;
    vec2 parallaxOffset = uHasDepth * (depth - 0.5) * uPointer * 0.03;
    vec2 sampleUv = clamp(uv + parallaxOffset, 0.0, 1.0);

    // uPhotoScale/uPhotoOffset implementam "object-fit: cover" — a foto raramente
    // bate exatamente com o aspect ratio do plano, então recortamos em vez de esticar.
    vec2 photoUv = sampleUv * uPhotoScale + uPhotoOffset;
    vec3 photoColor = texture2D(uPhoto, photoUv).rgb;

    // Sem mapa de profundidade real, a "banda de varredura" segue uv.y;
    // com profundidade real (uHasDepth = 1), segue o valor do depth map.
    float depthCoord = mix(uv.y, depth, uHasDepth);
    float closeness = 1.0 - smoothstep(0.0, 0.16, abs(depthCoord - uScanProgress));

    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 aspectUv = vec2(uv.x * aspect, uv.y);
    vec2 cellId = floor(aspectUv * uDotScale);
    vec2 cell = fract(aspectUv * uDotScale) - 0.5;
    float jitter = hash21(cellId) * 0.25;
    float dist = length(cell);
    float dotShape = smoothstep(0.40 - jitter, 0.28 - jitter, dist);
    float dotMask = dotShape * closeness;

    vec3 dotColor = uAccentColor * dotMask;
    vec3 screenBlend = 1.0 - (1.0 - photoColor) * (1.0 - dotColor);

    float stripe = 1.0 - smoothstep(0.0, 0.02, abs(depthCoord - uScanProgress));
    vec3 finalColor = screenBlend + uAccentColor * stripe * 0.6;

    gl_FragColor = vec4(finalColor, 1.0);
  }
`

const dummyTexture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
dummyTexture.needsUpdate = true

export const OceanScanMaterial = shaderMaterial(
  {
    uPhoto: dummyTexture,
    uDepth: dummyTexture,
    uHasDepth: 0,
    uScanProgress: 0,
    uPointer: new THREE.Vector2(0, 0),
    uDotScale: 55,
    uResolution: new THREE.Vector2(1, 1),
    uAccentColor: ACCENT_COLOR,
    uPhotoScale: new THREE.Vector2(1, 1),
    uPhotoOffset: new THREE.Vector2(0, 0),
  },
  vertexShader,
  fragmentShader,
)

extend({ OceanScanMaterial })

declare module '@react-three/fiber' {
  interface ThreeElements {
    oceanScanMaterial: ThreeElements['shaderMaterial'] & {
      uPhoto?: THREE.Texture
      uDepth?: THREE.Texture
      uHasDepth?: number
      uScanProgress?: number
      uPointer?: THREE.Vector2
      uDotScale?: number
      uResolution?: THREE.Vector2
      uAccentColor?: THREE.Color
      uPhotoScale?: THREE.Vector2
      uPhotoOffset?: THREE.Vector2
    }
  }
}
