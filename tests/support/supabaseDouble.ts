// A stand-in for the Supabase client, for testing the rules around a query
// rather than the query itself.
//
// Every call in a chain - from().select().eq().maybeSingle() - returns the
// same object, and awaiting it anywhere takes the next queued answer. That is
// enough to ask the questions worth asking of these services: given a trip
// that is already on the road, does it refuse to re-assign it; given a
// booking that is finished, does it refuse to edit it.
//
// It deliberately does not emulate PostgREST. Filtering, ordering and
// embedding are the database's job and are checked against the real one.

export interface Answer {
  data?: unknown;
  error?: { message: string; code?: string } | null;
  count?: number | null;
}

export interface Call {
  table: string;
  /** The methods used, in order: select, eq, maybeSingle, and so on. */
  chain: string[];
  /** Whatever was passed to insert(), update() or upsert(). */
  payload?: unknown;
}

export interface SupabaseDouble {
  client: { from: (table: string) => unknown };
  /** Answers are taken in the order they are queued, one per awaited chain. */
  queue: (...answers: Answer[]) => void;
  calls: Call[];
  /** Every table written to, in order, with what was written. */
  writes: Call[];
}

const WRITES = new Set(["insert", "update", "upsert", "delete"]);

export function supabaseDouble(): SupabaseDouble {
  const answers: Answer[] = [];
  const calls: Call[] = [];
  const writes: Call[] = [];

  const next = (): Answer => answers.shift() ?? { data: null, error: null };

  const from = (table: string) => {
    const call: Call = { table, chain: [] };
    calls.push(call);

    const settle = () => {
      const answer = next();
      return Promise.resolve({
        data: answer.data ?? null,
        error: answer.error ?? null,
        count: answer.count ?? null,
      });
    };

    const chain: Record<string, unknown> = {
      // Awaiting the builder itself runs the query, as the real one does.
      then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
        settle().then(resolve, reject),
    };

    return new Proxy(chain, {
      get(target, property) {
        if (property in target) return target[property as string];

        const method = String(property);
        return (...args: unknown[]) => {
          call.chain.push(method);
          if (WRITES.has(method)) {
            const write: Call = { table, chain: [method], payload: args[0] };
            writes.push(write);
          }
          // These end a chain by returning a single row rather than a list.
          if (method === "maybeSingle" || method === "single") return settle();
          return new Proxy(target, this as ProxyHandler<typeof target>);
        };
      },
    });
  };

  return {
    client: { from },
    queue: (...items: Answer[]) => answers.push(...items),
    calls,
    writes,
  };
}
