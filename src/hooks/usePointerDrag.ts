import { useEffect, useLayoutEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import type { Point } from "../utils/geometry";

export interface DragSnapshot {
  /** Where the pointer is, in client coordinates. */
  readonly pointer: Point;
  /** How far the pointer has travelled since the gesture started. */
  readonly delta: Point;
}

export interface DragHandlers<TContext> {
  /**
   * Called when the primary button goes down. Returns whatever the gesture
   * needs to remember until it ends, or `null` to ignore this press.
   */
  onStart(event: ReactPointerEvent<HTMLElement>): TContext | null;
  onMove(context: TContext, drag: DragSnapshot): void;
  onEnd(context: TContext, drag: DragSnapshot): void;
  /** Called when the gesture is abandoned: Escape, a context menu, leaving the window, or pointercancel. */
  onCancel(context: TContext): void;
}

export interface DragBindings {
  readonly onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
}

interface Session {
  readonly removeListeners: () => void;
}

/**
 * The one drag primitive behind moving, resizing and drawing notes. Once a
 * gesture starts, it follows the pointer through listeners on `window`, which
 * keep receiving the events wherever the pointer goes. Pointer capture is also
 * requested, so that other elements show no hover effects during the drag, but
 * nothing depends on it: Chrome on a macOS trackpad can drop the capture in the
 * middle of a drag.
 */
export function usePointerDrag<TContext>(
  handlers: DragHandlers<TContext>,
): DragBindings {
  const sessionRef = useRef<Session | null>(null);
  // The window listeners are added when a gesture starts, so they read the handlers through a
  // ref to get those of the latest render.
  const handlersRef = useRef(handlers);
  useLayoutEffect(() => {
    handlersRef.current = handlers;
  });

  // A component that unmounts mid-gesture must not leave its listeners behind.
  useEffect(() => () => void endSession(sessionRef), []);

  return {
    onPointerDown(event) {
      if (sessionRef.current || event.button !== 0 || !event.isPrimary) return;

      const context = handlersRef.current.onStart(event);
      if (context === null) return;

      const { pointerId } = event;
      const origin = { x: event.clientX, y: event.clientY };
      const isOurs = (pointerEvent: PointerEvent) =>
        pointerEvent.pointerId === pointerId;

      const finish = (pointerEvent: PointerEvent) => {
        endSession(sessionRef);
        handlersRef.current.onEnd(context, snapshot(origin, pointerEvent));
      };
      const cancel = () => {
        endSession(sessionRef);
        handlersRef.current.onCancel(context);
      };

      // Only pointerup ends a drag. The `buttons` of a move are not trusted: Chrome on a macOS
      // trackpad can report the button as up for a moment while the finger is still pressing.
      const onPointerMove = (pointerEvent: PointerEvent) => {
        if (isOurs(pointerEvent))
          handlersRef.current.onMove(context, snapshot(origin, pointerEvent));
      };
      const onPointerUp = (pointerEvent: PointerEvent) => {
        if (isOurs(pointerEvent)) finish(pointerEvent);
      };
      const onPointerCancel = (pointerEvent: PointerEvent) => {
        if (isOurs(pointerEvent)) cancel();
      };
      const onKeyDown = (keyEvent: KeyboardEvent) => {
        if (keyEvent.key === "Escape") cancel();
      };
      // A context menu or a switch to another window can swallow the pointerup, so either one
      // calls the drag off rather than leave the note stuck to the pointer.
      const onInterrupt = () => cancel();

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerCancel);
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("contextmenu", onInterrupt);
      window.addEventListener("blur", onInterrupt);

      const element = event.currentTarget;
      element.setPointerCapture(pointerId);

      sessionRef.current = {
        removeListeners() {
          window.removeEventListener("pointermove", onPointerMove);
          window.removeEventListener("pointerup", onPointerUp);
          window.removeEventListener("pointercancel", onPointerCancel);
          window.removeEventListener("keydown", onKeyDown);
          window.removeEventListener("contextmenu", onInterrupt);
          window.removeEventListener("blur", onInterrupt);
          if (element.hasPointerCapture(pointerId))
            element.releasePointerCapture(pointerId);
        },
      };
    },
  };
}

function endSession(sessionRef: RefObject<Session | null>): void {
  const session = sessionRef.current;
  if (!session) return;
  sessionRef.current = null;
  session.removeListeners();
}

function snapshot(origin: Point, event: PointerEvent): DragSnapshot {
  return {
    pointer: { x: event.clientX, y: event.clientY },
    delta: { x: event.clientX - origin.x, y: event.clientY - origin.y },
  };
}
