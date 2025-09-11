import * as THREE from "three";
import {
  screenCoordinate,
  uniform,
  uniformTexture,
  vec2,
  vec4,
} from "three/tsl";
import { NodeMaterial } from "three/webgpu";
import { createClipSpaceVertexNode } from "./chunk/createClipSpaceVertexNode.ts";
import { assignUniforms } from "./assifnUniforms.ts";
import { mirrorRepeatUV } from "./chunk/mirrorRepeatUV.ts";

export type AdvectDyeNodeMaterial = ReturnType<typeof createAdvectDyeMaterial>;

export const createAdvectDyeMaterial = () => {
  // uniforms定義
  const uData = uniformTexture(new THREE.Texture());
  const uImage = uniformTexture(new THREE.Texture());
  const uTexelSize = uniform(new THREE.Vector2());
  const uTextureSize = uniform(new THREE.Vector2());
  const uDeltaT = uniform(0.0);

  //========== TSLここから
  const uv = vec2(screenCoordinate.xy).mul(uTextureSize);
  const data = uData.sample(uv).toVar();

  const src = uv.sub(data.xy.mul(uDeltaT).mul(uTexelSize).mul(3.0));
  const srcWrapped = mirrorRepeatUV(src, uTextureSize);

  const dye = uImage.sample(srcWrapped).rgb;
  const fragColor = vec4(dye, 1.0);
  //========== TSLここまで

  // マテリアル作成
  const material = new NodeMaterial();
  material.vertexNode = createClipSpaceVertexNode();
  material.fragmentNode = fragColor;

  return assignUniforms(material, {
    uData,
    uImage,
    uTexelSize,
    uTextureSize,
    uDeltaT,
  });
};

// 元GLSL
// language=GLSL
`
precision highp float;
uniform sampler2D uData;
uniform sampler2D uImage;
uniform vec2 uTexelSize;
uniform vec2 uTextureSize;
uniform float uDeltaT;

void main() { 
  vec2 uv = gl_FragCoord.xy * uTextureSize;
  vec2 v = texture(uData, uv).xy;

  vec2 src = uv - (uDeltaT * v) * uTexelSize * 3.0;
  src = mirrorRepeatUV(src, uTextureSize);
  vec3 dye = texture(uImage, src).rgb;

  gl_FragColor = vec4(dye, 1.0);
}
`;
