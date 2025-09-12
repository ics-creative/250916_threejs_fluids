import * as THREE from "three";
import {
  length,
  max,
  pow,
  screenCoordinate,
  smoothstep,
  uniform,
  uniformTexture,
  vec2,
  vec4,
} from "three/tsl";
import { NodeMaterial } from "three/webgpu";
import { createClipSpaceVertexNode } from "./chunk/createClipSpaceVertexNode.ts";
import { assignUniforms } from "./assifnUniforms.ts";
import { mirrorRepeatUV } from "./chunk/mirrorRepeatUV.ts";

export type AdvectSmokeDyeNodeMaterial = ReturnType<
  typeof createAdvectSmokeDyeMaterial
>;

/**
 * 速度場に従ってピクセルを移流するシェーダー
 */
export const createAdvectSmokeDyeMaterial = () => {
  // uniforms定義
  const uData = uniformTexture(new THREE.Texture());
  const uImage = uniformTexture(new THREE.Texture());
  const uTexelSize = uniform(new THREE.Vector2());
  const uTextureSize = uniform(new THREE.Vector2());
  const uDeltaT = uniform(0.0);
  const uDyeAdvectScale = uniform(0.0);
  const uHalfLife = uniform(0.0);

  //========== TSLここから
  const uv = vec2(screenCoordinate.xy).mul(uTextureSize);
  const data = uData.sample(uv).toVar();

  // 低速域ゲート
  const dispCells = uDeltaT.mul(length(data.xy));
  const gate = smoothstep(0.02, 0.1, dispCells);

  const src = uv.sub(
    data.xy.mul(uDyeAdvectScale).mul(uDeltaT).mul(uTexelSize).mul(gate),
  );
  const srcWrapped = mirrorRepeatUV(src, uTextureSize);

  const dye = uImage.sample(srcWrapped).rgb;
  const diss = pow(0.5, uDeltaT.div(max(uHalfLife, 1e-6)));
  const fragColor = vec4(dye.mul(diss), 1.0);
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
    uDyeAdvectScale,
    uHalfLife,
  });
};
