import { float, Fn, If, vec2 } from "three/tsl";
import type { FloatNode, SamplerNode, Vec2Node } from "../types.ts";

/**
 * 隣接セルの圧力をサンプリングする
 * 境界外は同値（圧力勾配ゼロ）を適用
 */
export const sampleNeighborPressureNeumann = Fn(
  ([tex, uv = vec2(), texelSize = vec2(), dir = vec2(), pCenter = float(0.0)]: [
    SamplerNode,
    Vec2Node,
    Vec2Node,
    Vec2Node,
    FloatNode,
  ]) => {
    const edgeUV = texelSize.mul(0.5).toVar();
    const pNeighbor = tex.sample(uv.add(dir.mul(texelSize))).z.toVar();

    If(uv.x.lessThanEqual(edgeUV.x).and(dir.x.lessThan(0.0)), () => {
      pNeighbor.assign(pCenter);
    });
    If(
      uv.x
        .greaterThanEqual(float(1.0).sub(edgeUV.x))
        .and(dir.x.greaterThan(0.0)),
      () => {
        pNeighbor.assign(pCenter);
      },
    );
    If(uv.y.lessThanEqual(edgeUV.y).and(dir.y.lessThan(0.0)), () => {
      pNeighbor.assign(pCenter);
    });
    If(
      uv.y
        .greaterThanEqual(float(1.0).sub(edgeUV.y))
        .and(dir.y.greaterThan(0.0)),
      () => {
        pNeighbor.assign(pCenter);
      },
    );

    return pNeighbor;
  },
);
