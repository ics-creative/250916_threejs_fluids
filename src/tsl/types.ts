import { Vector2 } from "three";
import type { ShaderNodeObject } from "three/tsl";
import { ConstNode, TextureNode } from "three/webgpu";

export type Vec2Node = ShaderNodeObject<ConstNode<Vector2>>;
export type FloatNode = ShaderNodeObject<ConstNode<number>>;
export type SamplerNode = ShaderNodeObject<TextureNode>;
