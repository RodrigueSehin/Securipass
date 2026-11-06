/** Neutralise les jokers LIKE saisis par l'utilisateur. */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}
