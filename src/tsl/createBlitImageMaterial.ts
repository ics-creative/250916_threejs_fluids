import * as THREE from "three";
import { screenCoordinate, uniform, uniformTexture, vec2 } from "three/tsl";
import { NodeMaterial } from "three/webgpu";
import { createClipSpaceVertexNode } from "./chunk/createClipSpaceVertexNode.ts";
import { assignUniforms } from "./assifnUniforms.ts";

export type BlitImageNodeMaterial = ReturnType<typeof createBlitImageMaterial>;

/**
 * テクスチャーをレンダリングするだけのシェーダー
 */
export const createBlitImageMaterial = (useWebGPUCoordinateSystem: boolean) => {
  // uniforms定義
  const uImage = uniformTexture(new THREE.Texture());
  const uTextureSize = uniform(new THREE.Vector2());
  const uImageScale = uniform(new THREE.Vector2());

  //========== TSLここから
  const uv0 = vec2(screenCoordinate.xy).mul(uTextureSize);
  // WebGL動作の場合はY反転する
  const uv1 = useWebGPUCoordinateSystem ? uv0 : vec2(uv0.x, uv0.y.oneMinus());
  const uv = uv1.sub(0.5).mul(uImageScale).add(0.5);

  const fragColor = uImage.sample(uv);
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
