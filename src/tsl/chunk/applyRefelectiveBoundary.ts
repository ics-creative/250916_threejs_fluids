import { float, Fn, If, vec2 } from "three/tsl";
import type { FloatNode, Vec2Node } from "../types.ts";

export const applyReflectiveBoundary = Fn(
  ([uv = vec2(), texelSize = vec2(), v = vec2(), e = float(1.0)]: [
    Vec2Node,
    Vec2Node,
    Vec2Node,
    FloatNode,
  ]) => {
    const edgeUV = texelSize.mul(0.5).toVar();
    const vOut = v.toVar();

    If(uv.x.lessThanEqual(edgeUV.x).and(vOut.x.lessThan(0.0)), () => {
      vOut.assign(vec2(vOut.x.mul(e).mul(-1.0), vOut.y));
    });
    If(
      uv.x
        .greaterThanEqual(float(1.0).sub(edgeUV.x))
        .and(vOut.x.greaterThan(0.0)),
      () => {
        vOut.assign(vec2(vOut.x.mul(e).mul(-1.0), vOut.y));
      },
    );
    If(uv.y.lessThanEqual(edgeUV.y).and(vOut.y.lessThan(0.0)), () => {
      vOut.assign(vec2(vOut.x, vOut.y.mul(e).mul(-1.0)));
    });
    If(
      uv.y
        .greaterThanEqual(float(1.0).sub(edgeUV.y))
        .and(vOut.y.greaterThan(0.0)),
      () => {
        vOut.assign(vec2(vOut.x, vOut.y.mul(e).mul(-1.0)));
      },
    );

    return vOut;
  },
);

// // 元GLSL
// language=GLSL
`
vec2 applyReflectiveBoundary(vec2 uv, vec2 texelSize, vec2 v, float e) {
  vec2 edgeUV = texelSize * 0.5;
  if(uv.x <= edgeUV.x && v.x < 0.0) {
    v.x *= -e;
  }
  if(uv.x >= 1.0 - edgeUV.x && v.x > 0.0) {
    v.x *= -e;
  }
  if(uv.y <= edgeUV.y && v.y < 0.0) {
    v.y *= -e;
  }
  if(uv.y >= 1.0 - edgeUV.y && v.y > 0.0) {
    v.y *= -e;
  }
  return v;
}
`;
