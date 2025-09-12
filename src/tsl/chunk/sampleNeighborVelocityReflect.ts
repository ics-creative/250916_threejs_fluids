import { float, Fn, If, vec2 } from "three/tsl";
import type { SamplerNode, Vec2Node } from "../types.ts";

/**
 * 隣接セルの速度をサンプリングする
 * 境界外は法線成分の反射を適用
 */
export const sampleNeighborVelocityReflect = Fn(
  ([tex, uv = vec2(), texelSize = vec2(), dir = vec2(), vCenter = vec2()]: [
    SamplerNode,
    Vec2Node,
    Vec2Node,
    Vec2Node,
    Vec2Node,
  ]) => {
    const edgeUV = texelSize.mul(0.5).toVar();
    const vNeighbor = tex.sample(uv.add(dir.mul(texelSize))).xy.toVar();

    If(uv.x.lessThanEqual(edgeUV.x).and(dir.x.lessThan(0.0)), () => {
      vNeighbor.assign(vec2(vCenter.x.mul(-1), vCenter.y));
    });
    If(
      uv.x
        .greaterThanEqual(float(1.0).sub(edgeUV.x))
        .and(dir.x.greaterThan(0.0)),
      () => {
        vNeighbor.assign(vec2(vCenter.x.mul(-1), vCenter.y));
      },
    );
    If(uv.y.lessThanEqual(edgeUV.y).and(dir.y.lessThan(0.0)), () => {
      vNeighbor.assign(vec2(vCenter.x, vCenter.y.mul(-1)));
    });
    If(
      uv.y
        .greaterThanEqual(float(1.0).sub(edgeUV.y))
        .and(dir.y.greaterThan(0.0)),
      () => {
        vNeighbor.assign(vec2(vCenter.x, vCenter.y.mul(-1)));
      },
    );

    return vNeighbor;
  },
);
