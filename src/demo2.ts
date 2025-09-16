import * as THREE from "three";
import { WebGPURenderer, NodeMaterial } from "three/webgpu";
import {
  createDivergenceNodeMaterial,
  type DivergenceNodeMaterial,
} from "./tsl/createDivergenceMaterial.ts";
import {
  type AddForceNodeMaterial,
  createAddForceMaterial,
} from "./tsl/createAddForceMaterial.ts";
import {
  createRenderMaterial2,
  type RenderNodeMaterial2,
} from "./tsl/createRenderMaterial2.ts";
import {
  type AdvectVelocityNodeMaterial,
  createAdvectVelocityMaterial,
} from "./tsl/createAdvectVelocityMaterial.ts";
import {
  createPressureJacobiMaterial,
  type PressureJacobiNodeMaterial,
} from "./tsl/createPressureJacobiMaterial.ts";
import {
  createSubtractGradientMaterial,
  type SubtractGradientNodeMaterial,
} from "./tsl/createSubtractGradientMaterial.ts";
import { PointerManager } from "./PointerManager.ts";

// シミュレーション用のパラメーター
const simulationConfig = {
  // データテクスチャー（格子）の画面サイズ比。大きいほど詳細になるが、負荷が高くなる
  pixelRatio: 0.5,
  // 1回のシミュレーションステップで行うヤコビ法の圧力計算の回数。大きいほど安定して正確性が増すが、負荷が高くなる
  solverIteration: 5,
  // マウスを外力として使用する際に影響を与える半径サイズ
  forceRadius: 20,
  // マウスを外力として使用する際のちからの係数
  forceCoefficient: 1000,
  /**
   * 移流時の減衰
   * 1.0に近づけることで高粘度な流体のような見た目にできる
   * 1以上にはしない
   * あくまで粘度っぽさであり、粘性項とは無関係
   */
  dissipation: 0.996,
};

// 時間差分計算用の一時変数
let previousTime = 0.0;
// マウス・タッチイベントを管理するオブジェクト
const pointerManager = new PointerManager();

// Three.jsのレンダリングに必要な一式
let renderer: WebGPURenderer;
let scene: THREE.Scene;
let camera: THREE.OrthographicCamera;
let quad: THREE.Mesh;

// シミュレーションのサイズ定義。画面リサイズに応じて変更する。よく使用するので変数化しておく
let dataWidth = Math.round(
  window.innerWidth * window.devicePixelRatio * simulationConfig.pixelRatio,
);
let dataHeight = Math.round(
  window.innerHeight * window.devicePixelRatio * simulationConfig.pixelRatio,
);
let texelSize = new THREE.Vector2();

// シミューレーション結果を格納するテクスチャー
let dataTexture: THREE.RenderTarget;
let dataRenderTarget: THREE.RenderTarget;

// 背景画像に使用するテクスチャー
let sourceImageTexture: THREE.Texture;

// シミュレーション及び描画に使用するTSLシェーダーを設定したマテリアル
let addForceShader: AddForceNodeMaterial;
let advectVelShader: AdvectVelocityNodeMaterial;
let divergenceShader: DivergenceNodeMaterial;
let pressureShader: PressureJacobiNodeMaterial;
let subtractGradientShader: SubtractGradientNodeMaterial;
let renderShader: RenderNodeMaterial2;

// 初期化
await init();
// 実行開始
frame(performance.now());

/**
 * 初期化
 */
async function init() {
  // WebGPURendererの初期化
  // 本デモはTSL及びNodeMaterialを使用しているため、WebGLRendererではなくWebGPURendererを使用する
  // WebGPURendererはWebGPUが非対応の環境ではフォールバックとしてWebGLで表示される
  // WebGPURendererで強制的にWebGL表示をしたい場合は、オプションのforceWebGLをtrueにする
  renderer = new WebGPURenderer({ antialias: false, forceWebGL: false });
  await renderer.init();
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // Three.js用のシーンとカメラを作成
  // カメラは透視投影の必要がないのでOrthographicCamera
  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // 貼り付けるための平面メッシュを作成
  // 使用したいシェーダーに対応したマテリアルを差し替えてrenderer.render()を都度呼び出す
  quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  scene.add(quad);

  // シミュレーションデータを書き込むテクスチャーをPing-Pong用に2つ作成。
  const renderTargetOptions = {
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
    type: THREE.FloatType,
    depthBuffer: false,
    stencilBuffer: false,
  };
  dataTexture = new THREE.RenderTarget(
    dataWidth,
    dataHeight,
    renderTargetOptions,
  );
  dataRenderTarget = new THREE.RenderTarget(
    dataWidth,
    dataHeight,
    renderTargetOptions,
  );
  clearRenderTarget(dataTexture);
  clearRenderTarget(dataRenderTarget);

  // シミュレーションで使用するシェーダーを作成
  addForceShader = createAddForceMaterial();
  advectVelShader = createAdvectVelocityMaterial();
  divergenceShader = createDivergenceNodeMaterial();
  pressureShader = createPressureJacobiMaterial();
  subtractGradientShader = createSubtractGradientMaterial();

  // 描画に使用するシェーダーを作成
  renderShader = createRenderMaterial2();

  // 確認のためレンダリング用のシェーダーをデバッグ表示
  await debugShader(renderShader);

  // 背景用テクスチャーのロード
  const loader = new THREE.TextureLoader();
  sourceImageTexture = loader.load("texture_demo2.jpg", () => {
    onWindowResize();
  });
  sourceImageTexture.minFilter = THREE.LinearMipMapLinearFilter;
  sourceImageTexture.magFilter = THREE.LinearFilter;
  sourceImageTexture.colorSpace = THREE.SRGBColorSpace;

  // イベントの登録・初期化時点でのサイズ設定処理
  window.addEventListener("resize", onWindowResize);
  pointerManager.init(renderer.domElement);
  pointerManager.addEventListener("firstInteraction", () => {
    (document.querySelector("#overlay-hint") as HTMLElement)!.style.display =
      "none";
  });
  onWindowResize();
}

/**
 * 画面リサイズ時の挙動
 * シミュレーション用のデータテクスチャーを画面サイズに応じてリサイズする
 */
function onWindowResize() {
  // リサイズ時のお約束処理
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);

  // シミュレーション用のデータテクスチャーを画面サイズに応じてリサイズする
  const newWidth = window.innerWidth * window.devicePixelRatio;
  const newHeight = window.innerHeight * window.devicePixelRatio;
  dataWidth = Math.round(newWidth * simulationConfig.pixelRatio);
  dataHeight = Math.round(newHeight * simulationConfig.pixelRatio);
  dataTexture.setSize(dataWidth, dataHeight);
  dataRenderTarget.setSize(dataWidth, dataHeight);
  // WebGPU座標系の場合はポインタのY座標を反転する
  pointerManager.resizeTarget(
    simulationConfig.pixelRatio,
    renderer.backend.coordinateSystem === THREE.WebGPUCoordinateSystem
      ? dataHeight
      : 0,
  );

  // シェーダーで使用するデータテクスチャーの1ピクセルごとのサイズをシェーダー定数に設定し直す
  texelSize.set(1 / dataWidth, 1 / dataHeight);
  addForceShader.uniforms.uTexelSize.value.copy(texelSize);
  advectVelShader.uniforms.uTexelSize.value.copy(texelSize);
  divergenceShader.uniforms.uTexelSize.value.copy(texelSize);
  pressureShader.uniforms.uTexelSize.value.copy(texelSize);
  subtractGradientShader.uniforms.uTexelSize.value.copy(texelSize);
  renderShader.uniforms.uTexelSize.value.copy(texelSize);
  renderShader.uniforms.uTextureSize.value.set(1 / newWidth, 1 / newHeight);

  // 背景用テクスチャーをセンタリングするためのパラメーターをシェーダー定数に設定
  if (renderShader.uniforms.uImage.value.source?.data) {
    renderShader.uniforms.uImageScale.value.copy(
      getImageScale(
        newWidth,
        newHeight,
        renderShader.uniforms.uImage.value.width,
        renderShader.uniforms.uImage.value.height,
      ),
    );
  }
}

/**
 * 画面サイズとテクスチャーサイズに応じて縦横比を保ったままセンタリングできるパラメータを取得する
 */
function getImageScale(
  screenW: number,
  screenH: number,
  imageW: number,
  imageH: number,
) {
  const screenRatio = screenW / screenH;
  const imageRatio = imageW / imageH;
  const w = screenRatio >= imageRatio ? screenRatio / imageRatio : 1.0;
  const h = screenRatio >= imageRatio ? 1.0 : imageRatio / screenRatio;
  return new THREE.Vector2(w, h);
}

/**
 * 毎フレーム実行する関数
 * シミュレーションの実行と画面へのレンダリングを行う
 */
function frame(time: number) {
  const deltaT = (time - previousTime) / 1000;

  if (pointerManager.isPointerDown) {
    // 外力の注入
    const shader = addForceShader;
    const uniforms = shader.uniforms;

    // マウスの移動距離から速度の変化を計算
    const deltaV = pointerManager.pointer
      .clone()
      .sub(pointerManager.prevPointer)
      .multiply(texelSize)
      .multiplyScalar(simulationConfig.forceCoefficient);
    uniforms.uData.value = dataTexture.texture;
    uniforms.uForceCenter.value.copy(
      pointerManager.pointer.clone().multiply(texelSize),
    );
    uniforms.uForceDeltaV.value.copy(deltaV);
    uniforms.uForceRadius.value = simulationConfig.forceRadius;

    render(shader, dataRenderTarget);
    swapTexture();
  }

  // タイムスケールに合わせてシミュレーションステップを実行
  const stepCount = Math.min(Math.max(Math.floor(deltaT * 240), 1), 8);
  const simulationDeltaT = deltaT / stepCount;
  for (let i = 0; i < stepCount; i++) {
    {
      // 速度の移流
      const shader = advectVelShader;
      const uniforms = shader.uniforms;

      uniforms.uData.value = dataTexture.texture;
      uniforms.uDeltaT.value = simulationDeltaT;
      uniforms.uDissipation.value = simulationConfig.dissipation;
      render(shader, dataRenderTarget);
      swapTexture();
    }

    {
      // 発散の計算
      const shader = divergenceShader;
      const uniforms = shader.uniforms;

      uniforms.uData.value = dataTexture.texture;
      render(shader, dataRenderTarget);
      swapTexture();
    }

    for (let i = 0; i < simulationConfig.solverIteration; i++) {
      // 圧力の計算
      const shader = pressureShader;
      const uniforms = shader.uniforms;

      uniforms.uData.value = dataTexture.texture;
      render(shader, dataRenderTarget);
      swapTexture();
    }

    {
      // 圧力勾配の減算
      const shader = subtractGradientShader;
      const uniforms = shader.uniforms;

      uniforms.uData.value = dataTexture.texture;
      render(shader, dataRenderTarget);
      swapTexture();
    }
  }

  {
    // 描画
    const shader = renderShader;
    const uniforms = shader.uniforms;

    uniforms.uTexture.value = dataTexture.texture;
    renderShader.uniforms.uImage.value = sourceImageTexture;
    render(shader, null);
  }

  // 次のフレームに備えて後処理
  pointerManager.updatePreviousPointer();
  previousTime = time;
  requestAnimationFrame(frame);
}

/**
 * レンダーターゲットに書かれた内容をリセットする
 */
function clearRenderTarget(renderTarget: THREE.RenderTarget) {
  renderer.setRenderTarget(renderTarget);
  renderer.clearColor();
  renderer.setRenderTarget(null);
}

/**
 * 指定したNodeMaterialで指定したターゲット（テクスチャーかフレームバッファー）にレンダリングする
 */
function render(material: NodeMaterial, target: THREE.RenderTarget | null) {
  quad.material = material;
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
}

/**
 * 参照用テクスチャーとレンダーターゲット用テクスチャーを入れ替える
 * Ping-Pong用
 */
function swapTexture() {
  [dataTexture, dataRenderTarget] = [dataRenderTarget, dataTexture];
}

/**
 * デバッグ表示
 * TSLを実行する3D APIのシェーダー言語に翻訳したものをコンソール出力して確認する
 */
async function debugShader(material: NodeMaterial) {
  quad.material = material;
  const rawShader = await renderer.debug.getShaderAsync(scene, camera, quad);
  console.log(rawShader.vertexShader);
  console.log(rawShader.fragmentShader);
}
