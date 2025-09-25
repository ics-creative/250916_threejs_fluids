import * as THREE from "three";

/**
 * マウス・タッチイベントを管理して座標を保存するユーテリティー
 */
export class PointerManager extends EventTarget {
  private hasInteracted = false;
  private pixelRatio = 1.0;
  private flipHeight = 0;
  public pointer = new THREE.Vector2(-1, -1);
  public prevPointer = new THREE.Vector2(-1, -1);
  public isPointerDown = false;

  public init(target: HTMLElement) {
    target.addEventListener("mousedown", this.onPointerDown);
    target.addEventListener("mousemove", this.onPointerMove);
    target.addEventListener("mouseup", this.onPointerUp);
    target.addEventListener("touchstart", this.onTouchStart, {
      passive: false,
    });
    target.addEventListener("touchmove", this.onTouchMove, { passive: false });
    target.addEventListener("touchend", this.onTouchEnd, { passive: false });
  }

  public resizeTarget(pixelRatio: number, flipHeight: number) {
    this.pixelRatio = pixelRatio;
    this.flipHeight = flipHeight;
  }

  public updatePreviousPointer() {
    this.prevPointer.copy(this.pointer);
  }

  private onPointerDown = (event: MouseEvent) => {
    if (!this.hasInteracted) {
      this.hasInteracted = true;
      this.dispatchEvent(new Event("firstInteraction"));
    }

    this.isPointerDown = true;
    this.updatePointer(event.clientX, event.clientY);
    this.prevPointer.copy(this.pointer);
  };

  private onPointerMove = (event: MouseEvent) => {
    this.updatePointer(event.clientX, event.clientY);
  };

  private onPointerUp = () => {
    this.isPointerDown = false;
    this.pointer.set(-1, -1);
    this.prevPointer.set(-1, -1);
  };

  private onTouchStart = (event: TouchEvent) => {
    event.preventDefault();

    if (!this.hasInteracted) {
      this.hasInteracted = true;
      this.dispatchEvent(new Event("firstInteraction"));
    }

    this.isPointerDown = true;
    const touch = event.touches[0];
    this.updatePointer(touch.clientX, touch.clientY);
    this.prevPointer.copy(this.pointer);
  };

  private onTouchMove = (event: TouchEvent) => {
    event.preventDefault();
    const touch = event.touches[0];
    this.updatePointer(touch.clientX, touch.clientY);
  };

  private onTouchEnd = () => {
    this.isPointerDown = false;
    this.pointer.set(-1, -1);
    this.prevPointer.set(-1, -1);
  };

  private updatePointer = (cx: number, cy: number) => {
    const x = cx * window.devicePixelRatio * this.pixelRatio;
    const yBase = cy * window.devicePixelRatio * this.pixelRatio;
    // 常にY座標を反転してシェーダーの座標系と合わせる
    const y = this.flipHeight > 0 ? this.flipHeight - yBase : yBase;
    this.pointer.set(x, y);
  };
}

export interface PointerManager {
  addEventListener(
    type: "firstInteraction",
    listener: (this: PointerManager, event: Event) => any,
    options?: boolean | AddEventListenerOptions,
  ): void;

  removeEventListener(
    type: "firstInteraction",
    listener: (this: PointerManager, event: Event) => any,
    options?: boolean | EventListenerOptions,
  ): void;
}
