import { useEffect, useLayoutEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import type { Point } from '../utils/geometry';

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
  /** Called when the gesture is abandoned: Escape, a system interruption, or lost capture. */
  onCancel(context: TContext): void;
}

type DragEventHandler = (event: ReactPointerEvent<HTMLElement>) => void;

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
}

const PRIMARY_BUTTON = 1;

/**
 * The one drag primitive behind moving, resizing and drawing notes. The element
 * captures the pointer, so the gesture keeps working when the pointer leaves
 * the element or the window, and no document-level listeners are needed.
 */
export function usePointerDrag<TContext>(handlers: DragHandlers<TContext>): DragBindings {
  const sessionRef = useRef<Session<TContext> | null>(null);
  // The Escape listener is added when a gesture starts, so it reads the handlers through a ref
  // to get those of the latest render.
  const handlersRef = useRef(handlers);
  useLayoutEffect(() => {
    handlersRef.current = handlers;
  });

  // A component that unmounts mid-gesture must not leave its Escape listener behind.
  useEffect(() => () => void endSession(sessionRef), []);

  const cancel = () => {
    const session = endSession(sessionRef);
    if (session) handlersRef.current.onCancel(session.context);
  };

  const sessionOf = (event: ReactPointerEvent<HTMLElement>) => {
    const session = sessionRef.current;
    return session?.pointerId === event.pointerId ? session : null;
  };

  return {
    onPointerDown(event) {
      if (sessionRef.current || event.button !== 0 || !event.isPrimary) return;

      const context = handlers.onStart(event);
      if (context === null) return;

      event.currentTarget.setPointerCapture(event.pointerId);
      const onKeyDown = (keyEvent: KeyboardEvent) => {
        if (keyEvent.key === 'Escape') cancel();
      };
      window.addEventListener('keydown', onKeyDown);
      sessionRef.current = {
        pointerId: event.pointerId,
        element: event.currentTarget,
        origin: { x: event.clientX, y: event.clientY },
        context,
        onKeyDown,
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
      handlers.onMove(session.context, snapshot(session, event));
    },

    onPointerUp(event) {
      const session = sessionOf(event);
      if (!session) return;

      endSession(sessionRef);
      handlers.onEnd(session.context, snapshot(session, event));
    },

    onPointerCancel(event) {
      if (sessionOf(event)) cancel();
    },

    onLostPointerCapture(event) {
      if (sessionOf(event)) cancel();
    },
  };
}

function endSession<TContext>(
  sessionRef: RefObject<Session<TContext> | null>,
): Session<TContext> | null {
  const session = sessionRef.current;
  if (!session) return null;

  // Cleared first, so that the `lostpointercapture` caused by releasing below is ignored.
  sessionRef.current = null;
  window.removeEventListener('keydown', session.onKeyDown);
  if (session.element.hasPointerCapture(session.pointerId)) {
    session.element.releasePointerCapture(session.pointerId);
  }
  return session;
}

function snapshot<TContext>(
  session: Session<TContext>,
  event: ReactPointerEvent<HTMLElement>,
): DragSnapshot {
  return {
    pointer: { x: event.clientX, y: event.clientY },
    delta: { x: event.clientX - session.origin.x, y: event.clientY - session.origin.y },
  };
}
