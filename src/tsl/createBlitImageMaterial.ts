import * as THREE from "three";
import {
  screenCoordinate,
  select,
  uniform,
  uniformTexture,
  vec2,
  vec4,
} from "three/tsl";
import { NodeMaterial } from "three/webgpu";
import { createClipSpaceVertexNode } from "./chunk/createClipSpaceVertexNode.ts";
import { assignUniforms } from "./assifnUniforms.ts";

export type BlitImageNodeMaterial = ReturnType<typeof createBlitImageMaterial>;

/**
 * テクスチャーをレンダリングするだけのシェーダー
 */
export const createBlitImageMaterial = () => {
  // uniforms定義
  const uImage = uniformTexture(new THREE.Texture());
  const uTextureSize = uniform(new THREE.Vector2());
  const uImageScale = uniform(new THREE.Vector2());

  //========== TSLここから
  const uv0 = vec2(screenCoordinate.xy).mul(uTextureSize);
  const uv = uv0.sub(0.5).mul(uImageScale).add(0.5);

  const inX = uv.x.greaterThanEqual(0.0).and(uv.x.lessThanEqual(1.0));
  const inY = uv.y.greaterThanEqual(0.0).and(uv.y.lessThanEqual(1.0));
  const inBounds = inX.and(inY);
  const colorIn = uImage.sample(uv);
  const colorOut = vec4(0.0, 0.0, 0.0, 1.0);
  const fragColor = select(inBounds, colorIn, colorOut);
  //========== TSLここまで

  // マテリアル作成
  const material = new NodeMaterial();
  material.vertexNode = createClipSpaceVertexNode();
  material.fragmentNode = fragColor;

  return assignUniforms(material, {
    uImage,
    uTextureSize,
    uImageScale,
  });
};
