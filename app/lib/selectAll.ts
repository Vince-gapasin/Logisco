// Reading a whole table when the whole table is what you meant.
//
// PostgREST caps a response at 1,000 rows and says nothing about it. Several
// of these tables are past that - 2,065 stops, 1,748 trips - so a count taken
// from an unpaged select is quietly wrong, and wrong in the flattering
// direction: it always looks like less work than there was.
//
// This was a private helper inside the foul trip service until a second caller
// needed it. The pickup backfill learned the same lesson the expensive way,
// reporting "961 of 984" for a table holding 2,065 rows.

const PAGE = 1000;

interface Page {
  data: unknown[] | null;
  error: { message: string } | null;
}

export async function selectAll<T>(
  build: (from: number, to: number) => PromiseLike<Page>,
): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(error.message);

    const batch = (data ?? []) as T[];
    rows.push(...batch);
    if (batch.length < PAGE) return rows;
  }
}

/**
 * The same, for a filter with more values than a URL will carry.
 *
 * An `in` list of 1,700 ids makes a request long enough to be refused, so the
 * list is asked for in chunks and the answers joined.
 */
export async function selectAllIn<T, V>(
  values: V[],
  build: (chunk: V[], from: number, to: number) => PromiseLike<Page>,
  chunkSize = 100,
): Promise<T[]> {
  const rows: T[] = [];

  for (let start = 0; start < values.length; start += chunkSize) {
    const chunk = values.slice(start, start + chunkSize);
    rows.push(...(await selectAll<T>((from, to) => build(chunk, from, to))));
  }

  return rows;
}
