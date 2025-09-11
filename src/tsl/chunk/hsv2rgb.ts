import { abs, clamp, float, Fn, fract, vec3 } from "three/tsl";
import type { FloatNode } from "../types.ts";

export const hsv2rgb = Fn(
  ([h = float(1.0), s = float(1.0), v = float(1.0)]: [
    FloatNode,
    FloatNode,
    FloatNode,
  ]) => {
    const k = vec3(0.0, 2.0, 1.0)
      .mul(1.0 / 3.0)
      .add(h);
    const c = clamp(abs(fract(k).mul(6.0).sub(3.0)).sub(1.0), 0.0, 1.0);
    return c.sub(1.0).mul(s).add(1.0).mul(v);
  },
);

// // 元GLSL
// language=GLSL
`
vec3 hsv2rgb(float h, float s, float v) {
  return ((clamp(abs(fract(h + vec3(0.0, 2.0, 1.0) / 3.0) * 6.0 - 3.0) - 1.0, 0.0, 1.0) - 1.0) * s + 1.0) * v;
}
`;
