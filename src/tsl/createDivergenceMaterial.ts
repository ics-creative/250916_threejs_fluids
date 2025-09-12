import * as THREE from "three";
import {
  screenCoordinate,
  uniform,
  uniformTexture,
  vec2,
  vec4,
} from "three/tsl";
import { NodeMaterial } from "three/webgpu";
import { sampleNeighborVelocityReflect } from "./chunk/sampleNeighborVelocityReflect.ts";
import { createClipSpaceVertexNode } from "./chunk/createClipSpaceVertexNode.ts";
import { assignUniforms } from "./assifnUniforms.ts";

export type DivergenceNodeMaterial = ReturnType<
  typeof createDivergenceNodeMaterial
>;

/**
 * Stable Fluidsシミュレーションで速度場の発散を計算するシェーダー
 */
export const createDivergenceNodeMaterial = () => {
  // uniforms定義
  const uData = uniformTexture(new THREE.Texture());
  const uTexelSize = uniform(new THREE.Vector2());

  //========== TSLここから
  const uv = vec2(screenCoordinate.xy).mul(uTexelSize);
  const data = uData.sample(uv).toVar();

  const left = sampleNeighborVelocityReflect(
    uData,
    uv,
    uTexelSize,
    vec2(-1.0, 0.0),
    data.xy,
  ).x;
  const right = sampleNeighborVelocityReflect(
    uData,
    uv,
    uTexelSize,
    vec2(1.0, 0.0),
    data.xy,
  ).x;
  const up = sampleNeighborVelocityReflect(
    uData,
    uv,
    uTexelSize,
    vec2(0.0, -1.0),
    data.xy,
  ).y;
  const down = sampleNeighborVelocityReflect(
    uData,
    uv,
    uTexelSize,
    vec2(0.0, 1.0),
    data.xy,
  ).y;

  const div = right.sub(left).add(down.sub(up)).mul(0.5);
  const fragColor = vec4(data.xyz, div);
  //========== TSLここまで

  // マテリアル作成
  const material = new NodeMaterial();
  material.vertexNode = createClipSpaceVertexNode();
  material.fragmentNode = fragColor;

  return assignUniforms(material, {
    uData,
    uTexelSize,
  });
};
