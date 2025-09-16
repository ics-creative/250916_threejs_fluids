import * as THREE from "three";
import {
  atan,
  clamp,
  fract,
  screenCoordinate,
  uniform,
  uniformTexture,
  vec2,
  vec4,
  length,
} from "three/tsl";
import { NodeMaterial } from "three/webgpu";
import { createClipSpaceVertexNode } from "./chunk/createClipSpaceVertexNode.ts";
import { assignUniforms } from "./assifnUniforms.ts";
import { hsv2rgb } from "./chunk/hsv2rgb.ts";

export type RenderNodeMaterial2 = ReturnType<typeof createRenderMaterial2>;

/**
 * デモ2でシミューレーション結果に従ってレンダリングを行うシェーダー
 * 速度場を可視化する
 */
export const createRenderMaterial2 = () => {
  // uniforms定義
  const uTexture = uniformTexture(new THREE.Texture());
  const uTextureSize = uniform(new THREE.Vector2());
  const uTimeStep = uniform(1.0);

  //========== TSLここから
  const uv0 = vec2(screenCoordinate.xy).mul(uTextureSize);
  // WebGPUのスクリーン座標系にあわせてYを反転
  const uv = vec2(uv0.x, uv0.y.oneMinus());
  const data = uTexture.sample(uv).toVar();

  // data.xyに速度、data.zに圧力、data.wに発散が入っているので、これられの物理量をベースに見た目を作る

  // 速度の向きをhueに対応させる。360度の向きを0度から60度にマッピングし、切れ目で汚くならないよう折り返す。ベースは時間変化
  const hueBase = fract(atan(data.y, data.x).mul(1 / (Math.PI * 2.0)));
  const tri = hueBase.mul(2.0).sub(1.0).abs().mul(-1.0).add(1.0);
  const hue = tri.mul(1.0 / 6.0).add(uTimeStep);

  // 速度の絶対値をsaturationのベースにする
  const speed = length(data.xy);
  const sat = clamp(speed.mul(40.0), 0.3, 0.9);
  const fragColor = vec4(hsv2rgb(hue, sat, 0.9), 1.0);
  //========== TSLここまで

  // マテリアル作成
  const material = new NodeMaterial();
  material.vertexNode = createClipSpaceVertexNode();
  material.fragmentNode = fragColor;

  return assignUniforms(material, {
    uTexture,
    uTextureSize,
    uTimeStep,
  });
};
