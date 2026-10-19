/** Draws the template. `art` resolves a demo image name to its bundled URL. */
export function mountPersonne(
  root: HTMLElement,
  art: (name: string) => string,
): () => void
