import * as THREE from "three";

export class PointerManager {
  private pixelRatio = 1.0;
  private flipHeight = 0;
  public pointer = new THREE.Vector2(-1, -1);
  public prevPointer = new THREE.Vector2(-1, -1);
  public isPointerDown = false;

  constructor() {}

  public init() {
    window.addEventListener("mousedown", this.onPointerDown);
    window.addEventListener("mousemove", this.onPointerMove);
    window.addEventListener("mouseup", this.onPointerUp);
    window.addEventListener("touchstart", this.onTouchStart, {
      passive: false,
    });
    window.addEventListener("touchmove", this.onTouchMove, { passive: false });
    window.addEventListener("touchend", this.onTouchEnd, { passive: false });
  }

  public resizeTarget(pixelRatio: number, flipHeight: number) {
    this.pixelRatio = pixelRatio;
    this.flipHeight = flipHeight;
  }

  public updatePreviousPointer() {
    this.prevPointer.copy(this.pointer);
  }

  private onPointerDown = (event: MouseEvent) => {
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
    const y = this.flipHeight > 0 ? this.flipHeight - yBase : yBase;
    this.pointer.set(x, y);
  };
}
