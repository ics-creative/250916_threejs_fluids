import { positionWorld, vec4 } from "three/tsl";

export const createClipSpaceVertexNode = () => vec4(positionWorld, 1.0);

// 元GLSL
// language=GLSL
`
void main() {
  gl_Position = vec4(position, 1.0);
}
`;
