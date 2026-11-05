/**
 * Minimal in-memory Prisma stand-in for unit tests.
 *
 * Only the models/operators our money services actually use are implemented:
 * where-matching (scalars, `in`, `not`, `lt`, `lte`, `gt`, `gte`, `AND`),
 * `increment` / `decrement` updates, `updateMany` counts and `$transaction`
 * (which simply runs the callback against the same fake).
 *
 * Tests import the real `prisma` singleton with `mock.module()` and inject this
 * object instead, so the service code under test is byte-for-byte production code.
 */

type Row = Record<string, any>;
type Store = Record<string, Row[]>;

export interface FakePrismaOptions {
  users?: Row[];
  tenants?: Row[];
  paymentOrders?: Row[];
  depositRequests?: Row[];
  withdrawalRequests?: Row[];
  walletLedger?: Row[];
  tournaments?: Row[];
  tournamentSlots?: Row[];
  matchResults?: Row[];
}

const MODELS = ['user', 'tenant', 'paymentOrder', 'depositRequest', 'withdrawalRequest', 'walletLedger', 'tournament', 'tournamentSlot', 'matchResult'] as const;
type ModelName = (typeof MODELS)[number];

const plain = (v: unknown) => (typeof v === 'number' ? v : Number(String(v)));

/** Postgres stores balances as NUMERIC — keep fake maths exact to 2 decimals. */
const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

function matches(row: Row, where: Row | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, condition]) => {
    if (key === 'AND') return (condition as Row[]).every((c) => matches(row, c));
    if (key === 'OR') return (condition as Row[]).some((c) => matches(row, c));
    // Compound unique key, e.g. `{ tournamentId_userId: { tournamentId, userId } }`.
    if (key.includes('_') && !(key in row) && condition && typeof condition === 'object') {
      return matches(row, condition as Row);
    }
    const value = row[key];
    if (condition === null || typeof condition !== 'object' || condition instanceof Date) {
      return value instanceof Date && condition instanceof Date
        ? value.getTime() === condition.getTime()
        : value === condition;
    }
    const ops = condition as Row;
    // Nested relation filter, e.g. `{ user: { inGameUid } }`.
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      const knownOp = ['in', 'not', 'lt', 'lte', 'gt', 'gte', 'equals', 'startsWith', 'endsWith', 'contains']
        .some((op) => op in ops);
      if (!knownOp) return matches(value as Row, ops);
    }
    if ('in' in ops) return (ops.in as unknown[]).some((c) => c === value);
    if ('not' in ops) {
      const notValue = ops.not;
      if (notValue && typeof notValue === 'object' && 'in' in (notValue as Row)) {
        return !(notValue as Row).in.includes(value);
      }
      return value !== notValue;
    }
    const ms = value instanceof Date ? value.getTime() : plain(value);
    if ('lt' in ops) return ms < (ops.lt instanceof Date ? ops.lt.getTime() : plain(ops.lt));
    if ('lte' in ops) return ms <= (ops.lte instanceof Date ? ops.lte.getTime() : plain(ops.lte));
    if ('gt' in ops) return ms > (ops.gt instanceof Date ? ops.gt.getTime() : plain(ops.gt));
    if ('gte' in ops) return ms >= (ops.gte instanceof Date ? ops.gte.getTime() : plain(ops.gte));
    if ('equals' in ops) return value === ops.equals;
    if ('startsWith' in ops) return String(value ?? '').startsWith(String(ops.startsWith));
    if ('endsWith' in ops) return String(value ?? '').endsWith(String(ops.endsWith));
    if ('contains' in ops) return String(value ?? '').includes(String(ops.contains));
    return true;
  });
}

function applyData(row: Row, data: Row): void {
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === 'object' && !(value instanceof Date) && !Array.isArray(value)) {
      if ('increment' in (value as Row)) { row[key] = round2(plain(row[key] ?? 0) + plain((value as Row).increment)); continue; }
      if ('decrement' in (value as Row)) { row[key] = round2(plain(row[key] ?? 0) - plain((value as Row).decrement)); continue; }
      if ('set' in (value as Row)) { row[key] = (value as Row).set; continue; }
    }
    row[key] = value;
  }
}

function project(row: Row | null, select?: Row): Row | null {
  if (!row) return null;
  if (!select) return { ...row };
  const out: Row = {};
  for (const [key, on] of Object.entries(select)) {
    if (on) out[key] = row[key];
  }
  return out;
}

export class FakePrisma {
  store: Store;
  private idSeq = 0;
  /** Every write recorded, so tests can assert "no second ledger row", etc. */
  calls: { model: string; op: string; args: any; at: number }[] = [];

  constructor(options: FakePrismaOptions = {}) {
    this.store = {
      user: (options.users ?? []).map((r) => ({ depositBalance: 0, winningBalance: 0, isBanned: false, ...r })),
      tenant: (options.tenants ?? []).map((r) => ({ minDeposit: 10, ...r })),
      paymentOrder: (options.paymentOrders ?? []).map((r) => ({ ...r })),
      depositRequest: (options.depositRequests ?? []).map((r) => ({ ...r })),
      withdrawalRequest: (options.withdrawalRequests ?? []).map((r) => ({ ...r })),
      walletLedger: (options.walletLedger ?? []).map((r) => ({ ...r })),
      tournament: (options.tournaments ?? []).map((r) => ({ ...r })),
      tournamentSlot: (options.tournamentSlots ?? []).map((r) => ({ ...r })),
      matchResult: (options.matchResults ?? []).map((r) => ({ ...r })),
    };
  }

  private log(model: string, op: string, args: any) {
    this.calls.push({ model, op, args, at: Date.now() });
  }

  private rows(model: ModelName): Row[] {
    return this.store[model];
  }

  private delegate(model: ModelName) {
    return {
      findUnique: async (args: any = {}) => {
        this.log(model, 'findUnique', args);
        const found = this.rows(model).find((r) => matches(r, args.where)) ?? null;
        return this.withIncludes(model, project(found, args.select), args.include);
      },
      findFirst: async (args: any = {}) => {
        this.log(model, 'findFirst', args);
        const found = this.rows(model).find((r) => matches(this.resolveRelations(model, r, args.where), args.where));
        return this.withIncludes(model, project(found ?? null, args.select), args.include);
      },
      findUniqueOrThrow: async (args: any = {}) => {
        this.log(model, 'findUniqueOrThrow', args);
        const found = this.rows(model).find((r) => matches(r, args.where));
        if (!found) throw new Error(`${model}.findUniqueOrThrow: not found`);
        return project(found, args.select);
      },
      findMany: async (args: any = {}) => {
        this.log(model, 'findMany', args);
        let rows = this.rows(model).filter((r) => matches(this.resolveRelations(model, r, args.where), args.where));
        const orderBy = Array.isArray(args.orderBy) ? args.orderBy : args.orderBy ? [args.orderBy] : [];
        if (orderBy.length > 0) {
          rows = [...rows].sort((a, b) => {
            for (const clause of orderBy) {
              const [field, dir] = Object.entries(clause)[0] as [string, 'asc' | 'desc'];
              const av = a[field] instanceof Date ? a[field].getTime() : a[field];
              const bv = b[field] instanceof Date ? b[field].getTime() : b[field];
              if (av === bv) continue;
              const cmp = av > bv ? 1 : -1;
              return dir === 'desc' ? -cmp : cmp;
            }
            return 0;
          });
        }
        const out = rows.map((r) => project(r, args.select) as Row);
        const skip = typeof args.skip === 'number' ? args.skip : 0;
        const taken = typeof args.take === 'number' ? out.slice(skip, skip + args.take) : out.slice(skip);
        return args.include ? taken.map((r) => this.withIncludes(model, r, args.include) as Row) : taken;
      },
      count: async (args: any = {}) => {
        this.log(model, 'count', args);
        return this.rows(model).filter((r) => matches(r, args.where)).length;
      },
      aggregate: async (args: any = {}) => {
        this.log(model, 'aggregate', args);
        const rows = this.rows(model).filter((r) => matches(r, args.where));
        const out: Row = {};
        const sum = args._sum as Row | undefined;
        if (sum) {
          out._sum = {} as Row;
          for (const [field, enabled] of Object.entries(sum)) {
            if (!enabled) continue;
            (out._sum as Row)[field] = rows.reduce((acc, r) => acc + (Number(r[field]) || 0), 0);
          }
        }
        if (args._count) out._count = rows.length;
        if (args._avg) {
          out._avg = {} as Row;
          for (const [field, enabled] of Object.entries(args._avg as Row)) {
            if (!enabled) continue;
            (out._avg as Row)[field] = rows.length
              ? rows.reduce((acc, r) => acc + (Number(r[field]) || 0), 0) / rows.length
              : null;
          }
        }
        return out;
      },
      create: async (args: any = {}) => {
        this.log(model, 'create', args);
        // The real schema generates ids server-side; mirror that here.
        const row = { id: `${model}-${++this.idSeq}`, createdAt: new Date(), ...args.data };
        this.rows(model).push(row);
        return project(row, args.select);
      },
      upsert: async (args: any = {}) => {
        this.log(model, 'upsert', args);
        const found = this.rows(model).find((r) => matches(r, args.where));
        if (found) { applyData(found, args.update); return project(found, args.select); }
        const row = { createdAt: new Date(), ...args.create };
        this.rows(model).push(row);
        return project(row, args.select);
      },
      update: async (args: any = {}) => {
        this.log(model, 'update', args);
        const row = this.rows(model).find((r) => matches(r, args.where));
        if (!row) throw new Error(`${model}.update: not found`);
        applyData(row, args.data);
        return project(row, args.select);
      },
      updateMany: async (args: any = {}) => {
        this.log(model, 'updateMany', args);
        const rows = this.rows(model).filter((r) => matches(r, args.where));
        rows.forEach((r) => applyData(r, args.data));
        return { count: rows.length };
      },
    };
  }

  get user() { return this.delegate('user'); }
  get tenant() { return this.delegate('tenant'); }
  get paymentOrder() { return this.delegate('paymentOrder'); }
  get depositRequest() { return this.delegate('depositRequest'); }
  get withdrawalRequest() { return this.delegate('withdrawalRequest'); }
  get walletLedger() { return this.delegate('walletLedger'); }
  get tournament() { return this.delegate('tournament'); }
  get tournamentSlot() { return this.delegate('tournamentSlot'); }
  get matchResult() { return this.delegate('matchResult'); }

  /** Resolve `where: { user: { inGameUid } }` style relation filters. */
  private static readonly RELATIONAL: readonly ModelName[] = ['tournamentSlot', 'matchResult'];

  private resolveRelations(model: ModelName, row: Row, where: Row | undefined): Row {
    if (!where || !FakePrisma.RELATIONAL.includes(model) || !where.user) return row;
    const owner = this.store.user.find((u) => u.id === row.userId);
    return { ...row, user: owner };
  }

  /** Resolve `include: { user: true }`. */
  private withIncludes(model: ModelName, row: Row | null, include: Row | undefined): Row | null {
    if (!row || !include || !FakePrisma.RELATIONAL.includes(model) || !include.user) return row;
    const owner = this.store.user.find((u) => u.id === row.userId);
    return { ...row, user: owner };
  }

  /** `SELECT ... FOR UPDATE` used to lock the tournament row. */
  async $queryRaw(): Promise<Row[]> {
    this.log('$queryRaw', 'query', {});
    return this.store.tournament.map((t) => ({ id: t.id, status: t.status }));
  }

  async $transaction<T>(cb: (tx: FakePrisma) => Promise<T>, _options?: unknown): Promise<T> {
    this.log('$transaction', 'run', {});
    return cb(this);
  }

  $on(): void {}
  $disconnect(): Promise<void> { return Promise.resolve(); }

  /** Convenience for assertions. */
  rowsOf(model: ModelName): Row[] { return this.rows(model); }
  writesTo(model: string, op?: string): number {
    return this.calls.filter((c) => c.model === model && (!op || c.op === op)).length;
  }
}
