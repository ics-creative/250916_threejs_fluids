import * as THREE from "three";
import { NodeMaterial, WebGPURenderer } from "three/webgpu";
import { createDivergenceNodeMaterial } from "./tsl/createDivergenceMaterial";
import { createAddForceMaterial } from "./tsl/createAddForceMaterial";
import { createRenderMaterial1 } from "./tsl/createRenderMaterial1";
import { createAdvectVelocityMaterial } from "./tsl/createAdvectVelocityMaterial";
import { createPressureJacobiMaterial } from "./tsl/createPressureJacobiMaterial";
import { createSubtractGradientMaterial } from "./tsl/createSubtractGradientMaterial";
import { createAdvectSmokeDyeMaterial } from "./tsl/createAdvectSmokeDyeMaterial";
import { PointerManager } from "./PointerManager";
import { createInjectDyeMaterial } from "./tsl/createInjectDyeMaterial";

// シミュレーション用のパラメーター
const simulationConfig = {
  // データテクスチャー（格子）の画面サイズ比。大きいほど詳細になるが、負荷が高くなる
  pixelRatio: 0.5,
  // 1回のシミュレーションステップで行うヤコビ法の圧力計算の回数。大きいほど安定して正確性が増すが、負荷が高くなる
  solverIteration: 2,
  // マウスを外力として使用する際に影響を与える半径サイズ
  forceRadius: 40,
  // マウスを外力として使用する際のちからの係数
  forceCoefficient: 500,
  /**
   * 移流時の減衰
   * 1.0に近づけることで高粘度な流体のような見た目にできる
   * 1以上にはしない
   * あくまで粘度っぽさであり、粘性項とは無関係
   */
  dissipation: 0.999,
  // スプリング（参考実装準拠）
  pointerSpringK: 0.05, // ばね係数
  pointerSpringC: 5, // 減衰（0〜1）
  pointerSpringVisualGain: 1000, // 見た目の追従感向上のための速度
};

// 時間差分計算用の一時変数
let previousTime = 0.0;
// マウス・タッチイベントを管理するオブジェクト
const pointerManager = new PointerManager();
// ダンピング適用後のフィルタ座標
const filteredPointer = new THREE.Vector2(-1, -1);
const prevFilteredPointer = new THREE.Vector2(-1, -1);
let isPointerFilterActive = false;
const springTarget = new THREE.Vector2(-1, -1);
const filteredVelocity = new THREE.Vector2(0, 0);
// 半径アニメーション用の状態
const radiusGrowDuration = 0.3; // 拡大 0.3s
const radiusDecayDuration = 1.0; // 縮小 1.0s
let radiusAnimCurrent = 0.0;
let radiusAnimStart = 0.0;
let radiusAnimEnd = 0.0;
let radiusAnimStartTimeSec = 0.0;
let radiusAnimDuration = 0.0;
let wasPointerDown = false;
const lastInjectPointer = new THREE.Vector2(-1, -1);
const lastActiveFilteredPointer = new THREE.Vector2(-1, -1);

// Three.jsのレンダリングに必要な一式

// シミュレーションのサイズ定義。画面リサイズに応じて変更する。よく使用するので変数化しておく
let dataWidth = Math.round(
  window.innerWidth * window.devicePixelRatio * simulationConfig.pixelRatio,
);
let dataHeight = Math.round(
  window.innerHeight * window.devicePixelRatio * simulationConfig.pixelRatio,
);
const texelSize = new THREE.Vector2();
const screenSize = new THREE.Vector2();

// シミューレーション結果を格納するテクスチャー
let dataTexture: THREE.RenderTarget;
let dataRenderTarget: THREE.RenderTarget;

// 背景画像に使用するテクスチャー

// 背景画像の更新結果を格納するテクスチャー
let imageTexture: THREE.RenderTarget;
let imageRenderTarget: THREE.RenderTarget;

// シミュレーション及び描画に使用するTSLシェーダーを設定したマテリアル

// 初期化
// WebGPURendererの初期化
// 本デモはTSL及びNodeMaterialを使用しているため、WebGLRendererではなくWebGPURendererを使用する
// WebGPURendererはWebGPUが非対応の環境ではフォールバックとしてWebGLで表示される
// WebGPURendererで強制的にWebGL表示をしたい場合は、オプションのforceWebGLをtrueにする
const renderer = new WebGPURenderer({ antialias: true, forceWebGL: false });
await renderer.init();
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Three.js用のシーンとカメラを作成
// カメラは透視投影の必要がないのでOrthographicCamera
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

// 貼り付けるための平面メッシュを作成
// 使用したいシェーダーに対応したマテリアルを差し替えてrenderer.render()を都度呼び出す
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
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

// 背景の更新を書き込むテクスチャーをPing-Pong用に2つ作成。
const imageRtOptions = {
  wrapS: THREE.ClampToEdgeWrapping,
  wrapT: THREE.ClampToEdgeWrapping,
  minFilter: THREE.LinearFilter,
  magFilter: THREE.LinearFilter,
  format: THREE.RGBAFormat,
  type: THREE.HalfFloatType,
  depthBuffer: false,
  stencilBuffer: false,
};
imageTexture = new THREE.RenderTarget(
  window.innerWidth,
  window.innerHeight,
  imageRtOptions,
);
imageRenderTarget = new THREE.RenderTarget(
  window.innerWidth,
  window.innerHeight,
  imageRtOptions,
);

// シミュレーションで使用するシェーダーを作成
const addForceShader = createAddForceMaterial();
const advectVelShader = createAdvectVelocityMaterial();
const divergenceShader = createDivergenceNodeMaterial();
const pressureShader = createPressureJacobiMaterial();
const subtractGradientShader = createSubtractGradientMaterial();

// 描画に使用するシェーダーを作成
const injectDyeShader = createInjectDyeMaterial();
const advectImageShader = createAdvectSmokeDyeMaterial();
const renderShader = createRenderMaterial1();

// 確認のためレンダリング用のシェーダーをデバッグ表示
await debugShader(renderShader);

// 背景用テクスチャーのロード
const loader = new THREE.TextureLoader();
const sourceImageTexture = await loader.loadAsync("texture_demo1.jpg");
renderShader.uniforms.uBGSizePx.value.set(
  sourceImageTexture.width,
  sourceImageTexture.height,
);
sourceImageTexture.colorSpace = THREE.SRGBColorSpace;
renderShader.uniforms.uBackground.value = sourceImageTexture;

// イベントの登録・初期化時点でのサイズ設定処理
window.addEventListener("resize", onWindowResize);
pointerManager.init(renderer.domElement);
pointerManager.addEventListener("firstInteraction", () => {
  const element = document.querySelector<HTMLElement>("#overlay-hint")!;
  element.style.display = "none";
});
onWindowResize();

/**
 * 画面リサイズ時の挙動
 * シミュレーション用のデータテクスチャーを画面サイズに応じてリサイズする
 */
function onWindowResize() {
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);

  const newWidth = window.innerWidth * window.devicePixelRatio;
  const newHeight = window.innerHeight * window.devicePixelRatio;
  dataWidth = Math.round(newWidth * simulationConfig.pixelRatio);
  dataHeight = Math.round(newHeight * simulationConfig.pixelRatio);
  dataTexture.setSize(dataWidth, dataHeight);
  dataRenderTarget.setSize(dataWidth, dataHeight);
  imageTexture.setSize(newWidth, newHeight);
  imageRenderTarget.setSize(newWidth, newHeight);
  // WebGPU座標系の場合はポインタのY座標を反転する
  pointerManager.resizeTarget(
    simulationConfig.pixelRatio,
    renderer.backend.coordinateSystem === THREE.WebGPUCoordinateSystem
      ? dataHeight
      : 0,
  );

  // シェーダーで使用するデータテクスチャーの1ピクセルごとのサイズをシェーダー定数に設定し直す
  texelSize.set(1 / dataWidth, 1 / dataHeight);
  screenSize.set(1 / newWidth, 1 / newHeight);
  addForceShader.uniforms.uTexelSize.value.copy(texelSize);
  advectVelShader.uniforms.uTexelSize.value.copy(texelSize);
  divergenceShader.uniforms.uTexelSize.value.copy(texelSize);
  pressureShader.uniforms.uTexelSize.value.copy(texelSize);
  subtractGradientShader.uniforms.uTexelSize.value.copy(texelSize);
  injectDyeShader.uniforms.uTextureSize.value.copy(screenSize);
  advectImageShader.uniforms.uTexelSize.value.copy(texelSize);
  advectImageShader.uniforms.uTextureSize.value.copy(screenSize);

  renderShader.uniforms.uDyeTexel.value.copy(screenSize);
  renderShader.uniforms.uScreenTexel.value.copy(screenSize);
  renderShader.uniforms.uScreenSizePx.value.set(newWidth, newHeight);
}

// 実行開始
frame(performance.now());

/**
 * 毎フレーム実行する関数
 * シミュレーションの実行と画面へのレンダリングを行う
 */
function frame(time: number) {
  const deltaT = (time - previousTime) / 1000;
  const nowSec = time * 0.001;

  // マウス押下/解放の遷移検出を先に行う（座標リセット前に処理）
  if (pointerManager.isPointerDown && !wasPointerDown) {
    // ダウン: 現在値から1.0へ0.3s
    radiusAnimStart = radiusAnimCurrent;
    radiusAnimEnd = 1.0;
    radiusAnimStartTimeSec = nowSec;
    radiusAnimDuration = radiusGrowDuration;
  } else if (!pointerManager.isPointerDown && wasPointerDown) {
    // アップ: 現在値から0.0へ1.0s
    radiusAnimStart = radiusAnimCurrent;
    radiusAnimEnd = 0.0;
    radiusAnimStartTimeSec = nowSec;
    radiusAnimDuration = radiusDecayDuration;
    // 解放直前の有効なフィルタ座標をラッチ
    lastInjectPointer.copy(lastActiveFilteredPointer);
  }

  // マウス座標のスプリング更新（バネ-ダンパ 2次系, 参考実装形式）
  if (pointerManager.isPointerDown) {
    if (!isPointerFilterActive) {
      springTarget.copy(pointerManager.pointer);
      filteredPointer.copy(springTarget);
      prevFilteredPointer.copy(filteredPointer);
      filteredVelocity.set(0, 0);
      isPointerFilterActive = true;
    }
    // 押下中はターゲットを更新
    springTarget.copy(pointerManager.pointer);
  }

  // 押下かどうかに関わらず、アクティブならスプリングを更新
  if (isPointerFilterActive) {
    const k = simulationConfig.pointerSpringK;
    const c = simulationConfig.pointerSpringC;
    const visual = simulationConfig.pointerSpringVisualGain;
    const dt = Math.min(Math.max(deltaT, 0.0), 0.032);

    const diff = springTarget.clone().sub(filteredPointer);
    const ax = k * diff.x - c * filteredVelocity.x;
    const ay = k * diff.y - c * filteredVelocity.y;

    filteredVelocity.x += ax * dt;
    filteredVelocity.y += ay * dt;
    filteredPointer.x += filteredVelocity.x * dt * visual;
    filteredPointer.y += filteredVelocity.y * dt * visual;

    // 近傍スナップ（微小振動を即収束）
    if (
      diff.lengthSq() < 0.5 * 0.5 &&
      filteredVelocity.lengthSq() < 0.5 * 0.5
    ) {
      filteredPointer.copy(springTarget);
      filteredVelocity.set(0, 0);
    }

    // アップ後の終端条件: 半径がほぼ0かつ速度ほぼ0なら停止
    if (
      !pointerManager.isPointerDown &&
      radiusAnimCurrent <= 0.001 &&
      filteredVelocity.lengthSq() < 0.0001
    ) {
      isPointerFilterActive = false;
      filteredPointer.set(-1, -1);
      prevFilteredPointer.set(-1, -1);
      filteredVelocity.set(0, 0);
    }
  }

  // 半径アニメーション更新（easeOutCubic）
  if (radiusAnimDuration > 0.0) {
    const tRaw = Math.min(
      Math.max((nowSec - radiusAnimStartTimeSec) / radiusAnimDuration, 0.0),
      1.0,
    );
    const t = 1.0 - Math.pow(1.0 - tRaw, 3.0);
    radiusAnimCurrent = radiusAnimStart + (radiusAnimEnd - radiusAnimStart) * t;
  }

  // アクティブな間は中心を更新（アップ後もスプリング減衰を反映）
  if (isPointerFilterActive) {
    lastInjectPointer.copy(filteredPointer);
  }

  // 押下中の有効フィルタ座標を保存（アップ時にラッチ使用）
  if (isPointerFilterActive) {
    lastActiveFilteredPointer.copy(filteredPointer);
  }

  if (isPointerFilterActive) {
    // 外力の注入
    const shader = addForceShader;
    const uniforms = shader.uniforms;

    // ダンピング後の移動距離から速度の変化を計算
    const deltaV = filteredPointer
      .clone()
      .sub(prevFilteredPointer)
      .multiply(texelSize)
      .multiplyScalar(simulationConfig.forceCoefficient)
      .multiplyScalar(window.devicePixelRatio);
    uniforms.uData.value = dataTexture.texture;
    uniforms.uForceCenter.value.copy(
      filteredPointer.clone().multiply(texelSize),
    );
    uniforms.uForceDeltaV.value.copy(deltaV);
    uniforms.uForceRadius.value =
      simulationConfig.forceRadius * Math.max(radiusAnimCurrent, 0.0);

    render(shader, dataRenderTarget);
    swapTexture();
  }

  // タイムスケールに合わせてシミュレーションステップを実行
  const stepCount = Math.min(Math.max(Math.floor(deltaT * 240), 1), 8);
  for (let i = 0; i < stepCount; i++) {
    const simulationDeltaT = deltaT / stepCount;
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

  // 押下中 もしくは 半径が減衰中はインク注入を継続
  if (pointerManager.isPointerDown || radiusAnimCurrent > 0.001) {
    // インクの注入
    const shader = injectDyeShader;
    const uniforms = shader.uniforms;

    uniforms.uImage.value = imageTexture.texture;
    const injectCenter = (
      isPointerFilterActive ? filteredPointer : lastInjectPointer
    )
      .clone()
      .multiply(texelSize);
    uniforms.uForceCenter.value.copy(injectCenter);
    uniforms.uForceRadius.value =
      simulationConfig.forceRadius *
      window.devicePixelRatio *
      Math.max(radiusAnimCurrent, 0.0);
    uniforms.uInjectGain.value = 50;

    render(shader, imageRenderTarget);
    [imageTexture, imageRenderTarget] = [imageRenderTarget, imageTexture];
  }

  {
    // インクの移流
    const shader = advectImageShader;
    const uniforms = shader.uniforms;

    uniforms.uImage.value = imageTexture.texture;
    uniforms.uData.value = dataTexture.texture;
    uniforms.uDeltaT.value = deltaT;
    uniforms.uDyeAdvectScale.value = 10;
    uniforms.uHalfLife.value = 0.15;

    render(shader, imageRenderTarget);
    [imageTexture, imageRenderTarget] = [imageRenderTarget, imageTexture];
  }

  {
    // 描画
    const shader = renderShader;
    const uniforms = shader.uniforms;

    uniforms.uDye.value = imageTexture.texture;
    uniforms.uRefractAmp.value = 1.6; // 歪みの強さ
    // マルチスケール屈折の半径と減衰
    uniforms.uRefractRadius.value = 2.0; // 範囲を広げる
    uniforms.uRefractFalloff.value = 0.6; // 大半径の寄与も残す
    uniforms.uDensityK.value = 0.5; // 吸収を弱めて薄さを改善
    uniforms.uSmokeGain.value = 0.7; // 白の寄与を少し戻す
    // 加算合成の強さ（以前のオーバーレイ用のユニフォームを流用）
    uniforms.uOverlayStrength.value = 1.1; // 加算を強める
    uniforms.uOverlayGain.value = 1.4;

    render(shader, null);
  }

  // 次のフレームに備えて後処理
  pointerManager.updatePreviousPointer();
  if (isPointerFilterActive) {
    prevFilteredPointer.copy(filteredPointer);
  }
  previousTime = time;
  wasPointerDown = pointerManager.isPointerDown;
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
