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
import { applyReflectiveBoundary } from "./chunk/applyRefelectiveBoundary.ts";
import { mirrorRepeatUV } from "./chunk/mirrorRepeatUV.ts";
import { sampleBilinear4 } from "./chunk/sampleBilinear4.ts";

export type AdvectVelocityNodeMaterial = ReturnType<
  typeof createAdvectVelocityMaterial
>;

/**
 * Stable Fluidsシミュレーションで速度を移流するシェーダー
 */
export const createAdvectVelocityMaterial = () => {
  // uniforms定義
  const uData = uniformTexture(new THREE.Texture());
  const uTexelSize = uniform(new THREE.Vector2());
  const uDeltaT = uniform(0.0);
  const uDissipation = uniform(1.0);

  //========== TSLここから
  const uv = vec2(screenCoordinate.xy).mul(uTexelSize);
  const data = uData.sample(uv).toVar();

  const backUV0 = uv.sub(data.xy.mul(uDeltaT).mul(uTexelSize));
  const backUV = mirrorRepeatUV(backUV0, uTexelSize);

  const advect0 = sampleBilinear4(uData, backUV, uTexelSize).xy;
  const advect1 = advect0.mul(uDissipation);
  const advect = applyReflectiveBoundary(uv, uTexelSize, advect1, 1.0);
  const fragColor = vec4(advect, data.zw);
  //========== TSLここまで

  // マテリアル作成
  const material = new NodeMaterial();
  material.vertexNode = createClipSpaceVertexNode();
  material.fragmentNode = fragColor;

  return assignUniforms(material, {
    uData,
    uTexelSize,
    uDeltaT,
    uDissipation,
  });
};
