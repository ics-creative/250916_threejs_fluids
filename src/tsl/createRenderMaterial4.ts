import * as THREE from "three";
import { screenCoordinate, uniform, uniformTexture, vec2 } from "three/tsl";
import { NodeMaterial } from "three/webgpu";
import { createClipSpaceVertexNode } from "./chunk/createClipSpaceVertexNode.ts";
import { assignUniforms } from "./assifnUniforms.ts";

export type RenderNodeMaterial4 = ReturnType<typeof createRenderMaterial4>;

/**
 * デモ4でシミューレーション結果に従ってレンダリングを行うシェーダー
 * 入力テクスチャーをそのままレンダリングする
 */
export const createRenderMaterial4 = () => {
  // uniforms定義
  const uImage = uniformTexture(new THREE.Texture());
  const uTextureSize = uniform(new THREE.Vector2());

  //========== TSLここから
  const uv0 = vec2(screenCoordinate.xy).mul(uTextureSize);
  // WebGPUのスクリーン座標系にあわせてYを反転
  const uv = vec2(uv0.x, uv0.y.oneMinus());
  const fragColor = uImage.sample(uv);
  //========== TSLここまで

  // マテリアル作成
  const material = new NodeMaterial();
  material.vertexNode = createClipSpaceVertexNode();
  material.fragmentNode = fragColor;

  return assignUniforms(material, {
    uImage,
    uTextureSize,
  });
};
