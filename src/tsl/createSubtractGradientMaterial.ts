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
import { applyReflectiveBoundary } from "./chunk/applyRefelectiveBoundary.ts";

export type SubtractGradientNodeMaterial = ReturnType<
  typeof createSubtractGradientMaterial
>;

/**
 * Stable Fluidsシミュレーションで速度場から圧力勾配を減算するシェーダー
 */
export const createSubtractGradientMaterial = () => {
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

  const v0 = data.xy.sub(vec2(right.sub(left), down.sub(up)).mul(0.5));
  const v = applyReflectiveBoundary(uv, uTexelSize, v0, 1.0);

  const fragColor = vec4(v, data.zw);
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
