/** A snapshot of synced state: values plus the time each key was last changed. */
export interface Doc {
  data: Record<string, unknown>;
  updated: Record<string, number>;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Per-key last-write-wins merge.
 * - key only on one side: that side wins
 * - both: the newer timestamp wins; ties go to the cloud copy
 * Remote values that fail `accept` are treated as absent.
 */
export function mergeDocs(
  local: Doc,
  remote: Doc,
  keys: readonly string[],
  accept: (key: string, value: unknown) => boolean = () => true,
  now = Date.now(),
) {
  const merged: Doc = { data: { ...remote.data }, updated: { ...remote.updated } };
  const applyLocal: string[] = [];
  let remoteChanged = false;

  for (const k of keys) {
    const hasL = k in local.data;
    const hasR = k in remote.data && accept(k, remote.data[k]);
    if (!hasL && !hasR) continue;

    const lt = local.updated[k] ?? 0;
    const rt = hasR ? (remote.updated[k] ?? 0) : -1;

    if (hasR && (!hasL || rt >= lt)) {
      if (!hasL || !same(local.data[k], remote.data[k])) applyLocal.push(k);
      merged.data[k] = remote.data[k];
      merged.updated[k] = remote.updated[k] ?? 0;
    } else {
      merged.data[k] = local.data[k];
      merged.updated[k] = lt || now;
      remoteChanged = true;
    }
  }
  return { merged, applyLocal, remoteChanged };
}
