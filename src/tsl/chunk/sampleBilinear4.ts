import { clamp, Fn, mix, vec2 } from "three/tsl";
import type { SamplerNode, Vec2Node } from "../types.ts";

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

// // 元GLSL
// language=GLSL
`
// Bilinear補間でサンプリング（テクスチャーはNearest）
vec4 sampleBilinear4(sampler2D tex, vec2 uv, vec2 texelSize) {
  vec2 uv00 = (floor(uv / texelSize - 0.5) + 0.5) * texelSize;
  vec2 uv00Min = 0.5 * texelSize;
  vec2 uv00Max = 1.0 - 1.5 * texelSize;
  uv00 = clamp(uv00, uv00Min, uv00Max);
  
  vec2 uv10 = uv00 + vec2(texelSize.x, 0.0);
  vec2 uv01 = uv00 + vec2(0.0, texelSize.y);
  vec2 uv11 = uv00 + texelSize;

  vec4 c00 = texture(tex, uv00);
  vec4 c10 = texture(tex, uv10);
  vec4 c01 = texture(tex, uv01);
  vec4 c11 = texture(tex, uv11);

  vec2 f = clamp((uv - uv00) / texelSize, 0.0, 1.0);
  vec4 cx0 = mix(c00, c10, f.x);
  vec4 cx1 = mix(c01, c11, f.x);
  return mix(cx0, cx1, f.y);
}
`;
