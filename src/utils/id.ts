export function createId(): string {
  // Not `crypto.randomUUID`: it exists only in secure contexts, so it is missing when the
  // dev server is opened over plain HTTP from another machine.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}
