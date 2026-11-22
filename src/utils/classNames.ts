/** Joins the truthy entries into a `className` string. */
export function classNames(...names: readonly (string | false | null | undefined)[]): string {
  return names.filter(Boolean).join(' ');
}
