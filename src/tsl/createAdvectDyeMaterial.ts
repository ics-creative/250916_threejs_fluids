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

/**
 * 速度場に従ってピクセルを移流するシェーダー
 */
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
