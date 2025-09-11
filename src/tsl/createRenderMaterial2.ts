import * as THREE from "three";
import {
  screenCoordinate,
  select,
  uniform,
  uniformTexture,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { NodeMaterial } from "three/webgpu";
import { createClipSpaceVertexNode } from "./chunk/createClipSpaceVertexNode.ts";
import { assignUniforms } from "./assifnUniforms.ts";
import { mirrorRepeatUV } from "./chunk/mirrorRepeatUV.ts";

export type RenderNodeMaterial2 = ReturnType<typeof createRenderMaterial2>;

export const createRenderMaterial2 = () => {
  // uniforms定義
  const uTexture = uniformTexture(new THREE.Texture());
  const uImage = uniformTexture(new THREE.Texture());
  const uTexelSize = uniform(new THREE.Vector2());
  const uTextureSize = uniform(new THREE.Vector2());
  const uImageScale = uniform(new THREE.Vector2(1, 1));

  //========== TSLここから
  const uv0 = vec2(screenCoordinate.xy).mul(uTextureSize);
  // WebGPUのスクリーン座標系にあわせてYを反転
  const uv = vec2(uv0.x, uv0.y.oneMinus());
  const data = uTexture.sample(uv).toVar();

  // data.xyに速度、data.zに圧力、data.wに発散が入っているので、これられの物理量をベースに見た目を作る

  const uvScaled = uv.sub(0.5).mul(uImageScale).add(0.5);

  const inX = uvScaled.x
    .greaterThanEqual(0.0)
    .and(uvScaled.x.lessThanEqual(1.0));
  const inY = uvScaled.y
    .greaterThanEqual(0.0)
    .and(uvScaled.y.lessThanEqual(1.0));
  const inBounds = inX.and(inY);

  const dUV = vec2(1.2).mul(data.xy).mul(uTexelSize);
  const uvB = mirrorRepeatUV(uvScaled.sub(dUV), uTexelSize);
  const col = uImage.sample(uvB).rgb;

  const colorIn = vec4(col.add(vec3(data.z.mul(0.01))), 1.0);
  const colorOut = vec4(0.0, 0.0, 0.0, 1.0);

  const fragColor = select(inBounds, colorIn, colorOut);
  //========== TSLここまで

  // マテリアル作成
  const material = new NodeMaterial();
  material.vertexNode = createClipSpaceVertexNode();
  material.fragmentNode = fragColor;

  return assignUniforms(material, {
    uTexture,
    uImage,
    uTexelSize,
    uTextureSize,
    uImageScale,
  });
};

// 元GLSL
// language=GLSL format=false
`
precision highp float;
uniform sampler2D uTexture;
uniform sampler2D uImage;
uniform vec2 uTexelSize;
uniform vec2 uTextureSize;
uniform vec2 uImageScale;

void main() {
  vec2 uv = gl_FragCoord.xy * uTextureSize;
  vec4 data = texture(uTexture, uv);
  vec3 vp = data.xyz;
  
  uv = (uv - 0.5) * uImageScale + 0.5;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }
  vec2 dUV = 1.2 * vp.xy * uTexelSize;
  vec2 uvB = mirrorRepeatUV(uv - dUV, uTexelSize);
  vec3 col2 = texture(uImage, uvB).rgb;
  gl_FragColor = vec4(col2 + vec3(vp.p * 0.01), 1.0);
}
`;
