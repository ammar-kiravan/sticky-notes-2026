import { useLayoutEffect, useState } from 'react';
import type { RefObject } from 'react';
import type { Size } from '../utils/geometry';

/** The element's inner size, kept current with a ResizeObserver. `null` until first measured. */
export function useElementSize(ref: RefObject<HTMLElement | null>): Size | null {
  const [size, setSize] = useState<Size | null>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    const measure = () => {
      const width = element.clientWidth;
      const height = element.clientHeight;
      setSize((current) =>
        current?.width === width && current.height === height ? current : { width, height },
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}
