import * as THREE from "three";
import type { ShaderNodeObject } from "three/tsl";
import {
  clamp,
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

export type RenderNodeMaterial1 = ReturnType<typeof createRenderMaterial1>;

/**
 * デモ1でシミューレーション結果に従ってレンダリングを行うシェーダー
 * 背景テクスチャと煙を合成する
 */
export const createRenderMaterial1 = () => {
  // uniforms定義
  const uDye = uniformTexture(new THREE.Texture());
  const uBackground = uniformTexture(new THREE.Texture());
  const uDyeTexel = uniform(new THREE.Vector2());
  const uScreenTexel = uniform(new THREE.Vector2());
  const uBGSizePx = uniform(new THREE.Vector2());
  const uScreenSizePx = uniform(new THREE.Vector2());

  const uRefractAmp = uniform(0.0);
  const uRefractRadius = uniform(1.0);
  const uRefractFalloff = uniform(0.5);
  const uDensityK = uniform(0.0);
  const uSmokeGain = uniform(0.0);
  const uOverlayStrength = uniform(1);
  const uOverlayGain = uniform(1);

  //========== TSLここから
  // const uvS = vec2(screenCoordinate.xy).mul(uScreenTexel);
  // const uvD = vec2(screenCoordinate.xy).mul(uDyeTexel);
  const uv0 = vec2(screenCoordinate.xy).mul(uScreenTexel);
  // WebGPUのスクリーン座標系にあわせてYを反転
  const uv = vec2(uv0.x, uv0.y.oneMinus());

  const sampleBGNode = (uvScreen: ShaderNodeObject<any>) => {
    const p = vec2(uvScreen).mul(uScreenSizePx);

    const sFit = max(
      uScreenSizePx.x.div(uBGSizePx.x),
      uScreenSizePx.y.div(uBGSizePx.y),
    );
    const size = vec2(uBGSizePx).mul(sFit);
    const off = vec2(uScreenSizePx).sub(size).mul(0.5);
    const q = vec2(p).sub(off).div(size);
    return uBackground.sample(q).rgb;
  };

  // 勾配（マルチスケール）
  const cC = uDye.sample(uv).r;
  // 半径スケール
  const r1 = uRefractRadius;
  const r2 = uRefractRadius.mul(5.0);
  const r3 = uRefractRadius.mul(10.0);

  // 1x 半径
  const cL1 = uDye.sample(uv.sub(vec2(uDyeTexel.x.mul(r1), 0.0))).r;
  const cR1 = uDye.sample(uv.add(vec2(uDyeTexel.x.mul(r1), 0.0))).r;
  const cB1 = uDye.sample(uv.sub(vec2(0.0, uDyeTexel.y.mul(r1)))).r;
  const cT1 = uDye.sample(uv.add(vec2(0.0, uDyeTexel.y.mul(r1)))).r;
  const grad1 = vec2(cR1.sub(cL1).mul(0.5), cT1.sub(cB1).mul(0.5));

  // 2x 半径
  const cL2 = uDye.sample(uv.sub(vec2(uDyeTexel.x.mul(r2), 0.0))).r;
  const cR2 = uDye.sample(uv.add(vec2(uDyeTexel.x.mul(r2), 0.0))).r;
  const cB2 = uDye.sample(uv.sub(vec2(0.0, uDyeTexel.y.mul(r2)))).r;
  const cT2 = uDye.sample(uv.add(vec2(0.0, uDyeTexel.y.mul(r2)))).r;
  const grad2 = vec2(cR2.sub(cL2).mul(0.5), cT2.sub(cB2).mul(0.5));

  // 3x 半径
  const cL3 = uDye.sample(uv.sub(vec2(uDyeTexel.x.mul(r3), 0.0))).r;
  const cR3 = uDye.sample(uv.add(vec2(uDyeTexel.x.mul(r3), 0.0))).r;
  const cB3 = uDye.sample(uv.sub(vec2(0.0, uDyeTexel.y.mul(r3)))).r;
  const cT3 = uDye.sample(uv.add(vec2(0.0, uDyeTexel.y.mul(r3)))).r;
  const grad3 = vec2(cR3.sub(cL3).mul(0.5), cT3.sub(cB3).mul(0.5));

  const w2 = exp(uRefractFalloff.mul(-1.0));
  const w3 = exp(uRefractFalloff.mul(-2.0));
  const wSum = w2.add(w3).add(1.0);
  const grad = grad1.mul(1.0).add(grad2.mul(w2)).add(grad3.mul(w3)).div(wSum);

  // 屈折
  const uvRefracted = uv.add(grad.mul(uRefractAmp));
  const bg = sampleBGNode(uvRefracted).toVar();

  // 透過（吸収）
  const transparent = exp(uDensityK.mul(cC).mul(-1.0));
  const smoke = vec3(1.0).mul(uSmokeGain.mul(vec3(1.0).sub(transparent)));

  // 加算合成（煙の濃度に応じて背景へ加算）
  const intensity = clamp(cC.mul(uOverlayGain), 0.0, 1.0);
  const addRGB = vec3(intensity).mul(uOverlayStrength);
  const blendedBG = clamp(bg.add(addRGB), 0.0, 1.0);

  // 合成
  const outCol = blendedBG.mul(transparent).add(smoke);

  const fragColor = vec4(outCol, 1.0);
  //========== TSLここまで

  // マテリアル作成
  const material = new NodeMaterial();
  material.vertexNode = createClipSpaceVertexNode();
  material.fragmentNode = fragColor;

  return assignUniforms(material, {
    uDye,
    uBackground,
    uDyeTexel,
    uScreenTexel,
    uBGSizePx,
    uScreenSizePx,
    uRefractAmp,
    uRefractRadius,
    uRefractFalloff,
    uDensityK,
    uSmokeGain,
    uOverlayStrength,
    uOverlayGain,
  });
};
