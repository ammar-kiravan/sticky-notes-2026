import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { flushSync } from 'react-dom';
import type { Point } from '../domain/geometry';

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
  /** Called at most once per animation frame while the pointer moves. */
  onMove(context: TContext, drag: DragSnapshot): void;
  onEnd(context: TContext, drag: DragSnapshot): void;
  /** Called when the gesture is abandoned: Escape, a system interruption, or lost capture. */
  onCancel(context: TContext): void;
}

type DragEventHandler = (event: ReactPointerEvent<HTMLElement>) => void;

/** Props to spread onto the element that starts the gesture. */
export interface DragBindings {
  readonly onPointerDown: DragEventHandler;
  readonly onPointerMove: DragEventHandler;
  readonly onPointerUp: DragEventHandler;
  readonly onPointerCancel: DragEventHandler;
  readonly onLostPointerCapture: DragEventHandler;
}

interface Session<TContext> {
  readonly pointerId: number;
  readonly element: HTMLElement;
  readonly origin: Point;
  readonly context: TContext;
  readonly onKeyDown: (event: KeyboardEvent) => void;
  pointer: Point;
  frame: number | null;
}

const PRIMARY_BUTTON = 1;

/**
 * The one drag primitive behind moving, resizing and drawing notes. The element
 * captures the pointer, so the gesture keeps working when the pointer leaves
 * the element or the window, and no document-level listeners are needed.
 */
export function usePointerDrag<TContext>(handlers: DragHandlers<TContext>): DragBindings {
  const handlersRef = useRef(handlers);
  const sessionRef = useRef<Session<TContext> | null>(null);

  // Lets a gesture that is already running call the handlers of the latest render.
  useLayoutEffect(() => {
    handlersRef.current = handlers;
  });

  // Kept in state rather than in a memo: React may discard a memoised value, and a new
  // controller in the middle of a gesture would abandon it.
  const [controller] = useState(() => {
    function stop(): Session<TContext> | null {
      const session = sessionRef.current;
      if (!session) return null;

      sessionRef.current = null;
      if (session.frame !== null) cancelAnimationFrame(session.frame);
      window.removeEventListener('keydown', session.onKeyDown);
      if (session.element.hasPointerCapture(session.pointerId)) {
        session.element.releasePointerCapture(session.pointerId);
      }
      return session;
    }

    function cancel(): void {
      const session = stop();
      if (session) handlersRef.current.onCancel(session.context);
    }

    function sessionOf(event: ReactPointerEvent<HTMLElement>): Session<TContext> | null {
      const session = sessionRef.current;
      return session?.pointerId === event.pointerId ? session : null;
    }

    const bindings: DragBindings = {
      onPointerDown(event) {
        if (sessionRef.current || event.button !== 0 || !event.isPrimary) return;

        const context = handlersRef.current.onStart(event);
        if (context === null) return;

        event.currentTarget.setPointerCapture(event.pointerId);
        const onKeyDown = (keyEvent: KeyboardEvent) => {
          if (keyEvent.key === 'Escape') cancel();
        };
        window.addEventListener('keydown', onKeyDown);

        const origin = { x: event.clientX, y: event.clientY };
        sessionRef.current = {
          pointerId: event.pointerId,
          element: event.currentTarget,
          origin,
          context,
          onKeyDown,
          pointer: origin,
          frame: null,
        };
      },

      onPointerMove(event) {
        const session = sessionOf(event);
        if (!session) return;

        // The button is up although no pointerup reached us, which happens when
        // a context menu or another window swallows it.
        if ((event.buttons & PRIMARY_BUTTON) === 0) {
          cancel();
          return;
        }

        session.pointer = { x: event.clientX, y: event.clientY };
        session.frame ??= requestAnimationFrame(() => {
          session.frame = null;
          // Rendering synchronously gets the update into this very frame. A state
          // update merely scheduled from here would be painted one frame late.
          flushSync(() => handlersRef.current.onMove(session.context, snapshot(session)));
        });
      },

      onPointerUp(event) {
        const session = sessionOf(event);
        if (!session) return;

        session.pointer = { x: event.clientX, y: event.clientY };
        stop();
        handlersRef.current.onEnd(session.context, snapshot(session));
      },

      onPointerCancel(event) {
        if (sessionOf(event)) cancel();
      },

      onLostPointerCapture(event) {
        if (sessionOf(event)) cancel();
      },
    };

    return { bindings, stop };
  });

  // A component that unmounts mid-gesture must not leave a frame or key listener behind.
  useEffect(() => () => void controller.stop(), [controller]);

  return controller.bindings;
}

function snapshot<TContext>(session: Session<TContext>): DragSnapshot {
  return {
    pointer: session.pointer,
    delta: {
      x: session.pointer.x - session.origin.x,
      y: session.pointer.y - session.origin.y,
    },
  };
}
