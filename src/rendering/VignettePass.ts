import * as THREE from "three";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

/**
 * Gentle vignette + slight cool-shadow grade. Runs in linear space before the
 * OutputPass, so values stay filmic.
 */
export const VignetteShader = {
  name: "VignetteShader",
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    offset: { value: 1.06 },
    darkness: { value: 0.92 },
    tint: { value: new THREE.Color(0x05070d) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float offset;
    uniform float darkness;
    uniform vec3 tint;
    varying vec2 vUv;
    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec2 uv = (vUv - 0.5) * vec2(offset);
      float vignette = smoothstep(0.85, 0.2, dot(uv, uv));
      float amount = mix(darkness, 1.0, vignette);
      vec3 color = mix(tint, texel.rgb, amount);
      gl_FragColor = vec4(color, texel.a);
    }
  `,
};

export function createVignettePass(): ShaderPass {
  return new ShaderPass(VignetteShader);
}
