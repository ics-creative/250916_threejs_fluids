import { NodeMaterial } from "three/webgpu";

/**
 * 型推論できる形でNodeMaterialにuniformsを追加するユーティリティ関数
 */
export const assignUniforms = <
  M extends NodeMaterial,
  U extends Record<string, object>,
>(
  mat: M,
  uniforms: U,
) => {
  Object.assign(mat, { uniforms });
  return mat as M & { uniforms: U };
};
