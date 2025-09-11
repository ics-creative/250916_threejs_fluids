import { abs, float, Fn, fract, vec2 } from "three/tsl";
import type { Vec2Node } from "../types.ts";

export const mirrorRepeatUV = Fn(
  ([uv = vec2(), texelSize = vec2()]: [Vec2Node, Vec2Node]) => {
    const uvMin = texelSize.mul(0.5).toVar();
    const uvMax = vec2(1.0).sub(uvMin).toVar();
    const span = uvMax.sub(uvMin).toVar();

    const t = uv.sub(uvMin).div(span);
    const tri = float(1.0).sub(abs(float(1.0).sub(fract(t.mul(0.5)).mul(2.0))));

    return uvMin.add(tri.mul(span));
  },
);

// // 元GLSL
// language=GLSL
`
// 無限回の鏡像反射で座標取得
vec2 mirrorRepeatUV(vec2 uv, vec2 texelSize){
  vec2 uvMin = 0.5 * texelSize;
  vec2 uvMax = 1.0 - uvMin;
  vec2 span  = uvMax - uvMin;
  // 区間[uvMin, uvMax]を[0,1]に正規化
  vec2 t = (uv - uvMin) / span;
  // tを周期2の三角波に畳み込む（無限回の鏡映）
  vec2 tri = 1.0 - abs(1.0 - 2.0 * fract(0.5 * t));
  // 正規化した区間[0,1]を区間[uvMin, uvMax]に戻す
  return uvMin + tri * span;
}
`;
