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
const config = {
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
const radiusGrowDuration = 0.3; // 拡大　時間（秒）
const radiusDecayDuration = 2.0; // 縮小　時間（秒）
let radiusAnimCurrent = 0.0;
let radiusAnimStart = 0.0;
let radiusAnimEnd = 0.0;
let radiusAnimStartTimeSec = 0.0;
let radiusAnimDuration = 0.0;
let wasPointerDown = false;
const lastInjectPointer = new THREE.Vector2(-1, -1);

// シミュレーションのサイズ
let dataWidth = 0;
let dataHeight = 0;
const texelSize = new THREE.Vector2();
const screenSize = new THREE.Vector2();

// シミューレーション結果を格納するテクスチャー
let dataTexture: THREE.RenderTarget;
let dataRenderTarget: THREE.RenderTarget;

// 背景画像の更新結果を格納するテクスチャー
let imageTexture: THREE.RenderTarget;
let imageRenderTarget: THREE.RenderTarget;

// シミュレーション及び描画に使用するTSLシェーダーを設定したマテリアル

const renderer = new WebGPURenderer({ antialias: true });
await renderer.init();
renderer.setPixelRatio(devicePixelRatio);
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

// カメラは透視投影の必要がないのでOrthographicCamera
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

// 貼り付けるための平面メッシュを作成
// 使用したいシェーダーに対応したマテリアルを差し替えてrenderer.render()を都度呼び出す
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
scene.add(quad);

// シミュレーションデータを書き込むテクスチャーをPing-Pong用に2つ作成。
const renderTargetOptions = {
  type: THREE.FloatType,
  // minFilter / magFilter は計算のため、THREE.NearestFilter を指定
  minFilter: THREE.NearestFilter,
  magFilter: THREE.NearestFilter,
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
const optionB = { type: THREE.HalfFloatType };
imageTexture = new THREE.RenderTarget(innerWidth, innerHeight, optionB);
imageRenderTarget = new THREE.RenderTarget(innerWidth, innerHeight, optionB);

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

// 固定パラメータは初期化時に設定
renderShader.uniforms.uRefractAmp.value = 1.6;
renderShader.uniforms.uRefractRadius.value = 2.0;
renderShader.uniforms.uRefractFalloff.value = 0.6;
renderShader.uniforms.uDensityK.value = 0.5;
renderShader.uniforms.uSmokeGain.value = 0.7;
renderShader.uniforms.uOverlayStrength.value = 1.1;
renderShader.uniforms.uOverlayGain.value = 1.4;

// 背景用テクスチャーのロード
const loader = new THREE.TextureLoader();
const sourceImageTexture = await loader.loadAsync("texture_demo1.avif");
renderShader.uniforms.uBGSizePx.value.set(
  sourceImageTexture.width,
  sourceImageTexture.height,
);
sourceImageTexture.colorSpace = THREE.SRGBColorSpace;
renderShader.uniforms.uBackground.value = sourceImageTexture;

// イベントの登録・初期化時点でのサイズ設定処理
addEventListener("resize", onWindowResize);
pointerManager.init(renderer.domElement);
pointerManager.addEventListener("firstInteraction", () => {
  document.querySelector<HTMLElement>("#overlay-hint")!.style.display = "none";
});
onWindowResize();

/**
 * 画面リサイズ時の挙動
 * シミュレーション用のデータテクスチャーを画面サイズに応じてリサイズする
 */
function onWindowResize() {
  renderer.setPixelRatio(devicePixelRatio);
  renderer.setSize(innerWidth, innerHeight);

  const newWidth = innerWidth * devicePixelRatio;
  const newHeight = innerHeight * devicePixelRatio;
  dataWidth = Math.round(newWidth * config.pixelRatio);
  dataHeight = Math.round(newHeight * config.pixelRatio);
  dataTexture.setSize(dataWidth, dataHeight);
  dataRenderTarget.setSize(dataWidth, dataHeight);
  imageTexture.setSize(newWidth, newHeight);
  imageRenderTarget.setSize(newWidth, newHeight);
  // シェーダーの座標系に合わせてポインタのY座標を反転する
  pointerManager.resizeTarget(config.pixelRatio, dataHeight);

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

//================ ヘルパー関数 ================
function easeOutCubic(t: number) {
  return 1.0 - Math.pow(1.0 - t, 3.0);
}

function updateRadius(nowSec: number) {
  if (radiusAnimDuration <= 0.0) return;
  const tRaw = Math.min(
    Math.max((nowSec - radiusAnimStartTimeSec) / radiusAnimDuration, 0.0),
    1.0,
  );
  const t = easeOutCubic(tRaw);
  radiusAnimCurrent = radiusAnimStart + (radiusAnimEnd - radiusAnimStart) * t;
}

function updateSpring(deltaT: number) {
  if (pointerManager.isPointerDown) {
    if (!isPointerFilterActive) {
      springTarget.copy(pointerManager.pointer);
      filteredPointer.copy(springTarget);
      prevFilteredPointer.copy(filteredPointer);
      filteredVelocity.set(0, 0);
      isPointerFilterActive = true;
    }
    springTarget.copy(pointerManager.pointer);
  }

  if (isPointerFilterActive) {
    const k = config.pointerSpringK;
    const c = config.pointerSpringC;
    const visual = config.pointerSpringVisualGain;
    const dt = Math.min(Math.max(deltaT, 0.0), 0.032);

    const diff = springTarget.clone().sub(filteredPointer);
    const ax = k * diff.x - c * filteredVelocity.x;
    const ay = k * diff.y - c * filteredVelocity.y;

    filteredVelocity.x += ax * dt;
    filteredVelocity.y += ay * dt;
    filteredPointer.x += filteredVelocity.x * dt * visual;
    filteredPointer.y += filteredVelocity.y * dt * visual;

    if (
      diff.lengthSq() < 0.5 * 0.5 &&
      filteredVelocity.lengthSq() < 0.5 * 0.5
    ) {
      filteredPointer.copy(springTarget);
      filteredVelocity.set(0, 0);
    }

    lastInjectPointer.copy(filteredPointer);

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
}

function renderToData(material: NodeMaterial) {
  render(material, dataRenderTarget);
  swapTexture();
}

function renderToImage(material: NodeMaterial) {
  render(material, imageRenderTarget);
  [imageTexture, imageRenderTarget] = [imageRenderTarget, imageTexture];
}

function applyExternalForce() {
  if (!isPointerFilterActive) return;
  const shader = addForceShader;
  const uniforms = shader.uniforms;

  const deltaV = filteredPointer
    .clone()
    .sub(prevFilteredPointer)
    .multiply(texelSize)
    .multiplyScalar(config.forceCoefficient)
    .multiplyScalar(devicePixelRatio);
  uniforms.uData.value = dataTexture.texture;
  uniforms.uForceCenter.value.copy(filteredPointer.clone().multiply(texelSize));
  uniforms.uForceDeltaV.value.copy(deltaV);
  uniforms.uForceRadius.value =
    config.forceRadius * Math.max(radiusAnimCurrent, 0.0);

  renderToData(shader);
}

function simulate(deltaT: number) {
  const stepCount = Math.min(Math.max(Math.floor(deltaT * 240), 1), 8);
  for (let i = 0; i < stepCount; i++) {
    const simulationDeltaT = deltaT / stepCount;
    {
      const shader = advectVelShader;
      const uniforms = shader.uniforms;
      uniforms.uData.value = dataTexture.texture;
      uniforms.uDeltaT.value = simulationDeltaT;
      uniforms.uDissipation.value = config.dissipation;
      renderToData(shader);
    }
    {
      const shader = divergenceShader;
      shader.uniforms.uData.value = dataTexture.texture;
      renderToData(shader);
    }
    for (let j = 0; j < config.solverIteration; j++) {
      const shader = pressureShader;
      shader.uniforms.uData.value = dataTexture.texture;
      renderToData(shader);
    }
    {
      const shader = subtractGradientShader;
      shader.uniforms.uData.value = dataTexture.texture;
      renderToData(shader);
    }
  }
}

function injectDye() {
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
    config.forceRadius * devicePixelRatio * Math.max(radiusAnimCurrent, 0.0);
  uniforms.uInjectGain.value = 50;

  renderToImage(shader);
}

function advectDye(deltaT: number) {
  const shader = advectImageShader;
  const uniforms = shader.uniforms;

  uniforms.uImage.value = imageTexture.texture;
  uniforms.uData.value = dataTexture.texture;
  uniforms.uDeltaT.value = deltaT;
  uniforms.uDyeAdvectScale.value = 10;
  uniforms.uHalfLife.value = 0.15;

  renderToImage(shader);
}

function compose() {
  const shader = renderShader;
  const uniforms = shader.uniforms;

  uniforms.uDye.value = imageTexture.texture;
  uniforms.uRefractAmp.value = 1.6;
  uniforms.uRefractRadius.value = 2.0;
  uniforms.uRefractFalloff.value = 0.6;
  uniforms.uDensityK.value = 0.5;
  uniforms.uSmokeGain.value = 0.7;
  uniforms.uOverlayStrength.value = 1.1;
  uniforms.uOverlayGain.value = 1.4;

  render(shader, null);
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

  // 押下/解放遷移検出
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
    // 解放直前の座標をラッチ
    lastInjectPointer.copy(filteredPointer);
  }
  updateSpring(deltaT);
  updateRadius(nowSec);

  applyExternalForce();

  // タイムスケールに合わせてシミュレーションステップを実行
  simulate(deltaT);

  // 押下中 もしくは 半径が減衰中はインク注入を継続
  if (pointerManager.isPointerDown || radiusAnimCurrent > 0.001) {
    injectDye();
  }

  // インクの移流
  advectDye(deltaT);

  // 合成
  compose();

  // 次のフレームに備えて後処理
  pointerManager.updatePreviousPointer();
  if (isPointerFilterActive) {
    prevFilteredPointer.copy(filteredPointer);
  }
  previousTime = time;
  wasPointerDown = pointerManager.isPointerDown;
  requestAnimationFrame(frame);
}

/**  レンダーターゲットに書かれた内容をリセット */
function clearRenderTarget(renderTarget: THREE.RenderTarget) {
  renderer.setRenderTarget(renderTarget);
  renderer.clearColor();
  renderer.setRenderTarget(null);
}

/** 指定したNodeMaterialで指定したターゲット（テクスチャーかフレームバッファー）にレンダリング */
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
