import { positionWorld, vec4 } from "three/tsl";

/**
 * 平面の投影をするだけの頂点シェーダーを作成する
 */
export const createClipSpaceVertexNode = () => vec4(positionWorld, 1.0);
