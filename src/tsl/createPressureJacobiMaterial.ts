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
import { sampleNeighborPressureNeumann } from "./chunk/sampleNeighborPressureNeumann.ts";

export type PressureJacobiNodeMaterial = ReturnType<
  typeof createPressureJacobiMaterial
>;

/**
 * Stable FluidsシミュレーションでJacobi法で圧力を計算するシェーダー
 */
export const createPressureJacobiMaterial = () => {
  // uniforms定義
  const uData = uniformTexture(new THREE.Texture());
  const uTexelSize = uniform(new THREE.Vector2());

  //========== TSLここから
  const uv = vec2(screenCoordinate.xy).mul(uTexelSize);
  const data = uData.sample(uv).toVar();

  const left = sampleNeighborPressureNeumann(
    uData,
    uv,
    uTexelSize,
    vec2(-1.0, 0.0),
    data.z,
  );
  const right = sampleNeighborPressureNeumann(
    uData,
    uv,
    uTexelSize,
    vec2(1.0, 0.0),
    data.z,
  );
  const up = sampleNeighborPressureNeumann(
    uData,
    uv,
    uTexelSize,
    vec2(0.0, -1.0),
    data.z,
  );
  const down = sampleNeighborPressureNeumann(
    uData,
    uv,
    uTexelSize,
    vec2(0.0, 1.0),
    data.z,
  );

  const p = left.add(right).add(up).add(down).sub(data.w).mul(0.25);
  const fragColor = vec4(data.xy, p, data.w);
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
