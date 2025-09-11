import { NodeMaterial } from "three/webgpu";

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
