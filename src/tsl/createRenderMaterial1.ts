import * as THREE from "three";
import {
  exp,
  min,
  screenCoordinate,
  step,
  uniform,
  uniformTexture,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { NodeMaterial } from "three/webgpu";
import { createClipSpaceVertexNode } from "./chunk/createClipSpaceVertexNode.ts";
import { assignUniforms } from "./assifnUniforms.ts";
import { hsv2rgb } from "./chunk/hsv2rgb.ts";

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
  const uDensityK = uniform(0.0);
  const uSmokeGain = uniform(0.0);
  const uTimeStep = uniform(0.0);

  //========== TSLここから
  // const uvS = vec2(screenCoordinate.xy).mul(uScreenTexel);
  // const uvD = vec2(screenCoordinate.xy).mul(uDyeTexel);
  const uv0 = vec2(screenCoordinate.xy).mul(uScreenTexel);
  // WebGPUのスクリーン座標系にあわせてYを反転
  const uv = vec2(uv0.x, uv0.y.oneMinus());

  const sampleBGNode = (uvScreen: any) => {
    const p = vec2(uvScreen).mul(uScreenSizePx);

    const sFit = min(
      uScreenSizePx.x.div(uBGSizePx.x),
      uScreenSizePx.y.div(uBGSizePx.y),
    );
    const size = vec2(uBGSizePx).mul(sFit);
    const off = vec2(uScreenSizePx).sub(size).mul(0.5);
    const q = vec2(p).sub(off).div(size);
    const m = step(0.0, q.x)
      .mul(step(0.0, q.y))
      .mul(step(q.x, 1.0))
      .mul(step(q.y, 1.0));
    return uBackground.sample(q).rgb.mul(m);
  };

  // 勾配
  const cC = uDye.sample(uv).r;
  const cL = uDye.sample(uv.sub(vec2(uDyeTexel.x, 0.0))).r;
  const cR = uDye.sample(uv.add(vec2(uDyeTexel.x, 0.0))).r;
  const cB = uDye.sample(uv.sub(vec2(0.0, uDyeTexel.y))).r;
  const cT = uDye.sample(uv.add(vec2(0.0, uDyeTexel.y))).r;
  const grad = vec2(cR.sub(cL).mul(0.5), cT.sub(cB).mul(0.5)); // ∇ρ

  // 屈折
  const uvRefracted = uv.add(grad.mul(uRefractAmp));
  const bg = sampleBGNode(uvRefracted);

  // 透過
  const transparent = exp(uDensityK.mul(cC).mul(-1.0));
  const smoke = hsv2rgb(uTimeStep, 0.5, 1.0).mul(
    uSmokeGain.mul(vec3(1.0).sub(transparent)),
  );

  // 合成
  const outCol = bg.mul(transparent).add(smoke);

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
    uDensityK,
    uSmokeGain,
    uTimeStep,
  });
};
