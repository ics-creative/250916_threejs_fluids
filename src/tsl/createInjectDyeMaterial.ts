import * as THREE from "three";
import {
  clamp,
  dot,
  exp,
  max,
  screenCoordinate,
  uniform,
  uniformTexture,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { NodeMaterial } from "three/webgpu";
import { createClipSpaceVertexNode } from "./chunk/createClipSpaceVertexNode.ts";
import { assignUniforms } from "./assifnUniforms.ts";

export type InjectDyeNodeMaterial = ReturnType<typeof createInjectDyeMaterial>;

/**
 * Stable Fluidsシミュレーションで速度に外力を与えるシェーダー
 */
export const createInjectDyeMaterial = () => {
  // uniforms定義
  const uImage = uniformTexture(new THREE.Texture());
  const uTextureSize = uniform(new THREE.Vector2());
  const uForceCenter = uniform(new THREE.Vector2());
  const uForceRadius = uniform(0.0);
  const uInjectGain = uniform(0.0);

  //========== TSLここから
  const uv = vec2(screenCoordinate.xy).mul(uTextureSize);
  const base = uImage.sample(uv).rgb.toVar();

  const nd = uv
    .sub(uForceCenter)
    .div(max(vec2(uForceRadius).mul(uTextureSize), vec2(1e-6)));

  const dye = clamp(
    base.add(
      vec3(1.0)
        .mul(uInjectGain)
        .mul(exp(dot(nd, nd).mul(-1.0))),
    ),
    0.0,
    1.0,
  );

  const fragColor = vec4(dye, 1.0);
  //========== TSLここまで

  // マテリアル作成
  const material = new NodeMaterial();
  material.vertexNode = createClipSpaceVertexNode();
  material.fragmentNode = fragColor;

  return assignUniforms(material, {
    uImage,
    uTextureSize,
    uForceCenter,
    uForceRadius,
    uInjectGain,
  });
};
