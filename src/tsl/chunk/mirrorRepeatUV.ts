import { abs, float, Fn, fract, vec2 } from "three/tsl";
import type { Vec2Node } from "../types.ts";

/**
 * UVをミラーリピートで無限反射させて区間内に収める
 */
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
