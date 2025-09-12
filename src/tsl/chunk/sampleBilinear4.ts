import { clamp, Fn, mix, vec2 } from "three/tsl";
import type { SamplerNode, Vec2Node } from "../types.ts";

/**
 * テクスチャーを手動のBilinear補間でサンプリングする
 */
export const sampleBilinear4 = Fn(
  ([tex, uv = vec2(), texelSize = vec2()]: [
    SamplerNode,
    Vec2Node,
    Vec2Node,
  ]) => {
    const uv00 = uv
      .div(texelSize)
      .sub(0.5)
      .floor()
      .add(0.5)
      .mul(texelSize)
      .toVar();
    const uv00Min = texelSize.mul(0.5);
    const uv00Max = vec2(1.0).sub(texelSize.mul(1.5));
    uv00.assign(clamp(uv00, uv00Min, uv00Max));

    const uv10 = uv00.add(vec2(texelSize.x, 0.0));
    const uv01 = uv00.add(vec2(0.0, texelSize.y));
    const uv11 = uv00.add(texelSize);

    const c00 = tex.sample(uv00);
    const c10 = tex.sample(uv10);
    const c01 = tex.sample(uv01);
    const c11 = tex.sample(uv11);

    const f = clamp(uv.sub(uv00).div(texelSize), 0.0, 1.0).toVar();
    const cx0 = mix(c00, c10, f.x);
    const cx1 = mix(c01, c11, f.x);
    return mix(cx0, cx1, f.y);
  },
);
