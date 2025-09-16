import * as THREE from "three";
import {
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
import { mirrorRepeatUV } from "./chunk/mirrorRepeatUV.ts";

export type RenderNodeMaterial3 = ReturnType<typeof createRenderMaterial3>;

/**
 * デモ3でシミューレーション結果に従ってレンダリングを行うシェーダー
 * 入力テクスチャーを速度場に従って歪ませる
 */
export const createRenderMaterial3 = () => {
  // uniforms定義
  const uTexture = uniformTexture(new THREE.Texture());
  const uImage = uniformTexture(new THREE.Texture());
  const uTexelSize = uniform(new THREE.Vector2());
  const uTextureSize = uniform(new THREE.Vector2());
  const uImageScale = uniform(new THREE.Vector2(1, 1));

  //========== TSLここから
  const uv0 = vec2(screenCoordinate.xy).mul(uTextureSize);
  // WebGPUのスクリーン座標系にあわせてYを反転
  const uv = vec2(uv0.x, uv0.y.oneMinus());
  const data = uTexture.sample(uv).toVar();

  // data.xyに速度、data.zに圧力、data.wに発散が入っているので、これられの物理量をベースに見た目を作る

  const uvScaled = uv.sub(0.5).mul(uImageScale).add(0.5);

  const dUV = vec2(1.2).mul(data.xy).mul(uTexelSize);
  const uvB = mirrorRepeatUV(uvScaled.sub(dUV), uTextureSize);
  const col = uImage.sample(uvB).rgb;

  const fragColor = vec4(col.add(vec3(data.z.mul(0.01))), 1.0);
  //========== TSLここまで

  // マテリアル作成
  const material = new NodeMaterial();
  material.vertexNode = createClipSpaceVertexNode();
  material.fragmentNode = fragColor;

  return assignUniforms(material, {
    uTexture,
    uImage,
    uTexelSize,
    uTextureSize,
    uImageScale,
  });
};
