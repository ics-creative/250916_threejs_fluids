import * as THREE from "three";
import {
  dot,
  exp,
  max,
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

export type AddForceNodeMaterial = ReturnType<typeof createAddForceMaterial>;

/**
 * Stable Fluidsシミュレーションで速度に外力を与えるシェーダー
 */
export const createAddForceMaterial = () => {
  // uniforms定義
  const uData = uniformTexture(new THREE.Texture());
  const uTexelSize = uniform(new THREE.Vector2());
  const uForceCenter = uniform(new THREE.Vector2());
  const uForceDeltaV = uniform(new THREE.Vector2());
  const uForceRadius = uniform(0.0);

  //========== TSLここから
  const uv = vec2(screenCoordinate.xy).mul(uTexelSize);
  const data = uData.sample(uv).toVar();

  const nd = uv
    .sub(uForceCenter)
    .div(max(vec2(uForceRadius).mul(uTexelSize), vec2(1e-6)));

  // vOldに外力として好きな速度を与える
  const vOld = data.xy;

  // ポインタダウン時の移動距離を速度差分として与える
  const vPointer = vOld.add(uForceDeltaV.mul(exp(dot(nd, nd).mul(-1.0))));

  const vBounded = applyReflectiveBoundary(uv, uTexelSize, vPointer, 1.0);
  const fragColor = vec4(vBounded, data.zw);
  //========== TSLここまで

  // マテリアル作成
  const material = new NodeMaterial();
  material.vertexNode = createClipSpaceVertexNode();
  material.fragmentNode = fragColor;

  return assignUniforms(material, {
    uData,
    uTexelSize,
    uForceCenter,
    uForceDeltaV,
    uForceRadius,
  });
};
