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
  emailOtps?: Row[];
  staffAccessKeys?: Row[];
  adminAuditLogs?: Row[];
}

const MODELS = ['user', 'tenant', 'paymentOrder', 'depositRequest', 'withdrawalRequest', 'walletLedger', 'tournament', 'tournamentSlot', 'matchResult', 'emailOtp', 'staffAccessKey', 'adminAuditLog'] as const;
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
    const bound = (v: unknown) => (v instanceof Date ? v.getTime() : plain(v));
    // Every operator present in the object must hold (Prisma ANDs them).
    const checks: boolean[] = [];
    if ('lt' in ops) checks.push(ms < bound(ops.lt));
    if ('lte' in ops) checks.push(ms <= bound(ops.lte));
    if ('gt' in ops) checks.push(ms > bound(ops.gt));
    if ('gte' in ops) checks.push(ms >= bound(ops.gte));
    if ('equals' in ops) checks.push(value === ops.equals);
    if ('startsWith' in ops) checks.push(String(value ?? '').startsWith(String(ops.startsWith)));
    if ('endsWith' in ops) checks.push(String(value ?? '').endsWith(String(ops.endsWith)));
    if ('contains' in ops) {
      const haystack = String(value ?? '');
      const needle = String(ops.contains);
      // Prisma supports `{ contains, mode: 'insensitive' }`.
      checks.push(
        (ops as Row).mode === 'insensitive'
          ? haystack.toLowerCase().includes(needle.toLowerCase())
          : haystack.includes(needle),
      );
    }
    return checks.length === 0 || checks.every(Boolean);
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
      emailOtp: (options.emailOtps ?? []).map((r) => ({ ...r })),
      staffAccessKey: (options.staffAccessKeys ?? []).map((r) => ({ ...r })),
      adminAuditLog: (options.adminAuditLogs ?? []).map((r) => ({ ...r })),
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
        let out = rows.map((r) => project(r, args.select) as Row);
        // `distinct: ['referenceId']` keeps the first row per key (like Prisma).
        if (Array.isArray(args.distinct)) {
          const seen = new Set<string>();
          out = out.filter((r) => {
            const key = args.distinct.map((f: string) => String(r[f])).join('|');
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        }
        const skip = typeof args.skip === 'number' ? args.skip : 0;
        const taken = typeof args.take === 'number' ? out.slice(skip, skip + args.take) : out.slice(skip);
        const withRelations = args.include
          ? taken.map((r) => this.withIncludes(model, r, args.include) as Row)
          : taken;
        const countSelect = (args.select as Row | undefined)?._count as Row | undefined;
        if (!countSelect) return withRelations;
        // `select: { _count: { select: { slots: true } } }`
        const relation = (countSelect.select as Row | undefined)?.slots;
        if (!relation) return withRelations;
        return withRelations.map((r) => ({
          ...r,
          _count: { slots: this.store.tournamentSlot.filter((s) => s.userId === r.id).length },
        }));
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
        for (const op of ['_max', '_min'] as const) {
          const spec = args[op] as Row | undefined;
          if (!spec) continue;
          out[op] = {} as Row;
          for (const [field, enabled] of Object.entries(spec)) {
            if (!enabled) continue;
            const values = rows
              .map((r) => r[field])
              .filter((v) => v !== null && v !== undefined)
              .map((v) => (v instanceof Date ? v.getTime() : plain(v)));
            let best: number | null = null;
            for (const value of values) {
              if (best === null) best = value;
              else if (op === '_max' ? value > best : value < best) best = value;
            }
            (out[op] as Row)[field] = best;
          }
        }
        if (args._count === true) out._count = rows.length;
        else if (args._count && typeof args._count === 'object') {
          // `_count: { _all: true, field: true }` -> counts, like Prisma.
          const spec = args._count as Row;
          const counts: Row = { _all: rows.length };
          for (const [field, enabled] of Object.entries(spec)) {
            if (!enabled || field === '_all') continue;
            counts[field] = rows.filter((r) => r[field] !== null && r[field] !== undefined).length;
          }
          out._count = counts;
        }
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
        return this.withIncludes(model, project(row, args.select), args.include) as Row;
      },
      upsert: async (args: any = {}) => {
        this.log(model, 'upsert', args);
        const found = this.rows(model).find((r) => matches(r, args.where));
        if (found) {
          applyData(found, args.update);
          return this.withIncludes(model, project(found, args.select), args.include) as Row;
        }
        const row = { id: `${model}-${++this.idSeq}`, createdAt: new Date(), ...args.create };
        this.rows(model).push(row);
        return this.withIncludes(model, project(row, args.select), args.include) as Row;
      },
      update: async (args: any = {}) => {
        this.log(model, 'update', args);
        const row = this.rows(model).find((r) => matches(r, args.where));
        if (!row) throw new Error(`${model}.update: not found`);
        applyData(row, args.data);
        return this.withIncludes(model, project(row, args.select), args.include) as Row;
      },
      delete: async (args: any = {}) => {
        this.log(model, 'delete', args);
        const rows = this.rows(model);
        const idx = rows.findIndex((r) => matches(r, args.where));
        if (idx === -1) throw new Error(`${model}.delete: not found`);
        return rows.splice(idx, 1)[0];
      },
      deleteMany: async (args: any = {}) => {
        this.log(model, 'deleteMany', args);
        const rows = this.rows(model);
        const keep = rows.filter((r) => !matches(r, args.where));
        const removed = rows.length - keep.length;
        rows.length = 0;
        rows.push(...keep);
        return { count: removed };
      },
      updateMany: async (args: any = {}) => {
        this.log(model, 'updateMany', args);
        const rows = this.rows(model).filter((r) => matches(r, args.where));
        rows.forEach((r) => applyData(r, args.data));
        return { count: rows.length };
      },
      /** `groupBy({ by: ['deviceIdSnapshot'], where, _count: { _all: true } })` */
      groupBy: async (args: any = {}) => {
        this.log(model, 'groupBy', args);
        const by: string[] = args.by ?? [];
        const groups = new Map<string, { key: Row; rows: Row[] }>();
        for (const row of this.rows(model).filter((r) => matches(r, args.where))) {
          const key: Row = {};
          for (const field of by) key[field] = row[field];
          const id = JSON.stringify(key);
          if (!groups.has(id)) groups.set(id, { key, rows: [] });
          groups.get(id)!.rows.push(row);
        }
        return [...groups.values()].map(({ key, rows }) => ({
          ...key,
          _sum: args._sum
            ? Object.fromEntries(
                Object.keys(args._sum)
                  .filter((field) => args._sum[field])
                  .map((field) => [field, rows.reduce((total, row) => total + plain(row[field] ?? 0), 0)]),
              )
            : undefined,
          _count: args._count?._all ? { _all: rows.length } : undefined,
        }));
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
  get emailOtp() { return this.delegate('emailOtp'); }
  get matchResult() { return this.delegate('matchResult'); }
  get staffAccessKey() { return this.delegate('staffAccessKey'); }
  get adminAuditLog() { return this.delegate('adminAuditLog'); }

  /** Resolve `where: { user: { inGameUid } }` style relation filters. */
  private static readonly RELATIONAL: readonly ModelName[] = ['tournamentSlot', 'matchResult', 'walletLedger'];

  private resolveRelations(model: ModelName, row: Row, where: Row | undefined): Row {
    if (!where || !FakePrisma.RELATIONAL.includes(model) || !where.user) return row;
    const owner = this.store.user.find((u) => u.id === row.userId);
    return { ...row, user: owner };
  }

  /** Resolve `include: { user: true }`. */
  private withIncludes(model: ModelName, row: Row | null, include: Row | undefined): Row | null {
    if (!row || !include) return row;

    let result: Row = row;
    if (FakePrisma.RELATIONAL.includes(model) && include.user) {
      const userInclude = include.user as Row;
      const select = userInclude.select as Row | undefined;
      let owner: Row | undefined = this.store.user.find((u) => u.id === result.userId);
      if (owner) {
        owner = { ...owner };
        // Nested relation inside `include: { user: { select: { matchResults } } }`.
        const nested = select?.matchResults as Row | undefined;
        if (nested) {
          const rows = this.store.matchResult
            .filter((m) => m.userId === owner!.id && matches(m, nested.where as Row | undefined))
            .map((m) => project(m, nested.select as Row | undefined) ?? {});
          owner.matchResults = rows;
        }
      }
      result = { ...result, user: owner };
    }

    // `include: { _count: { select: { slots: true } } }`
    const countSelect = (include._count as Row | undefined)?.select as Row | undefined;
    if (countSelect?.slots) {
      const slots = this.store.tournamentSlot.filter((s) =>
        model === 'tournament' ? s.tournamentId === result.id : s.userId === result.id,
      );
      result = { ...result, _count: { ...(result._count as Row | undefined), slots: slots.length } };
    }
    return result;
  }

  /**
   * Raw SQL emulation for the three statements the services actually run:
   *  1. `SELECT ... FROM "Tournament" t ... generate_series(...)` — join context
   *     (match row + booked count + lowest free seat).
   *  2. `UPDATE "User" SET ... RETURNING ...` — conditional wallet debit.
   *  3. `SELECT ... FOR UPDATE` on a tournament row (returns id + status).
   */
  async $queryRaw(strings?: unknown, ...values: unknown[]): Promise<Row[]> {
    this.log('$queryRaw', 'query', {});
    const sql = Array.isArray(strings) ? strings.join('?') : String(strings ?? '');

    if (sql.includes('UPDATE "User"')) {
      return this.rawDebit(sql, values);
    }

    // Post-commit "is this match full now?" reconciliation.
    if (sql.includes('UPDATE "Tournament"') && sql.includes('SLOTS_FULL')) {
      const tournamentId = String(values.filter((v) => typeof v === 'string')[0] ?? '');
      const match = this.store.tournament.find((t) => t.id === tournamentId);
      if (!match) return [];
      const booked = this.store.tournamentSlot.filter((s) => s.tournamentId === match.id).length;
      const full = booked >= Number(match.totalSlots ?? 48);
      const preMatch = ['OPEN', 'UPCOMING', 'DRAFT'].includes(String(match.status));
      if (full && preMatch) {
        match.status = 'SLOTS_FULL';
        return [{ status: 'SLOTS_FULL' }];
      }
      return [];
    }

    // The free-seat sub-query now arrives as an interpolated `Prisma.sql`
    // fragment, so its text is not part of `strings` any more — match on the
    // outer select instead.
    if (sql.includes('generate_series') || sql.includes('bookedCount') || sql.includes('freeSlot')) {
      return this.rawJoinContext(values);
    }

    return this.store.tournament.map((t) => ({ id: t.id, status: t.status }));
  }

  /** Free-seat lookup fallback (older callers pass totalSlots + tournamentId). */
  private rawFreeSeat(totalSlots: number, tournamentId: string): Row[] {
    const booked = new Set(
      this.store.tournamentSlot
        .filter((slot) => slot.tournamentId === tournamentId)
        .map((slot) => slot.slotNumber),
    );
    for (let slot = 1; slot <= totalSlots; slot += 1) {
      if (!booked.has(slot)) return [{ slot }];
    }
    return [];
  }

  /** `SELECT ... FROM "Tournament" t` with booked count + lowest free seat. */
  private rawJoinContext(values: unknown[]): Row[] {
    // The real query interpolates a `Prisma.sql` fragment for the free-seat
    // sub-query (lowest seat, or a random one on a retry), so plain string
    // params have to be filtered out of the value list here.
    const params = values.filter((v) => typeof v === 'string') as string[];
    const [tournamentId, tenantId] = params;
    const match = this.store.tournament.find(
      (t) => t.id === tournamentId && (!tenantId || t.tenantId === tenantId),
    );
    if (!match) return [];
    const slots = this.store.tournamentSlot.filter((s) => s.tournamentId === match.id);
    const totalSlots = Number(match.totalSlots ?? 48);
    return [
      {
        ...match,
        entryFee: String(match.entryFee ?? 0),
        totalSlots,
        bookedCount: slots.length,
        freeSlot: slots.length >= totalSlots ? null : this.rawFreeSeat(totalSlots, match.id)[0]?.slot ?? null,
      },
    ];
  }

  /** `UPDATE "User" SET "depositBalance" = ... RETURNING ...` with the balance guard. */
  private rawDebit(sql: string, values: unknown[]): Row[] {
    const column = sql.includes('"winningBalance" = "winningBalance" -')
      ? 'winningBalance'
      : 'depositBalance';
    const fee = plain(values[0]);
    const userId = String(values[1]);
    const row = this.store.user.find((u) => u.id === userId);
    if (!row || row.isBanned === true) return [];
    if (plain(row[column]) < fee) return [];
    row[column] = round2(plain(row[column]) - fee);
    this.log('user', 'update', { id: userId, [column]: { decrement: fee } });
    return [
      {
        depositBalance: String(row.depositBalance),
        winningBalance: String(row.winningBalance),
        inGameName: row.inGameName ?? null,
        inGameUid: row.inGameUid ?? null,
        deviceId: row.deviceId ?? null,
      },
    ];
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
