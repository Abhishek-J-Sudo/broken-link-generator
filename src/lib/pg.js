/**
 * Plain-Postgres data layer.
 *
 * Replaces @supabase/supabase-js with a thin, dependency-light client backed by
 * `pg`. It implements ONLY the subset of the Supabase/PostgREST query-builder
 * API that this app actually uses, so existing route code and the `db` helpers
 * keep working with (almost) no changes:
 *
 *   from(table)
 *     .select(cols, { count: 'exact' })
 *     .insert(obj | obj[])
 *     .update(obj)
 *     .upsert(obj[], { onConflict, ignoreDuplicates })
 *     .delete()
 *     .eq / .gt / .gte / .lt / .lte / .in / .ilike / .is / .or
 *     .order(col, { ascending }) / .range(from, to) / .limit(n) / .single()
 *
 * Awaiting (or .then()-ing) a builder resolves to { data, error, count } —
 * matching the shape route code destructures today.
 */

import { Pool } from 'pg';

// The pool is created lazily on first query — NOT at import time — so that
// `next build` (which evaluates route modules) doesn't require a live
// DATABASE_URL. Reused across HMR reloads in dev and across the process in prod.
function getPool() {
  if (globalThis.__seoscrubPgPool) return globalThis.__seoscrubPgPool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Missing environment variable: DATABASE_URL');
  }

  globalThis.__seoscrubPgPool = new Pool({
    connectionString,
    // Enable TLS only when explicitly requested (Coolify-internal Postgres
    // typically runs without it). Set DATABASE_SSL=true for external/managed DBs.
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
    max: Number(process.env.DATABASE_POOL_MAX || 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  return globalThis.__seoscrubPgPool;
}

export function query(text, params) {
  return getPool().query(text, params);
}

/** Serialize objects/arrays so they land in JSONB columns correctly. */
function encodeValue(v) {
  if (v !== null && typeof v === 'object' && !(v instanceof Date)) {
    return JSON.stringify(v);
  }
  return v;
}

/** Identifiers (table/column names) are developer-controlled, never user input. */
class QueryBuilder {
  constructor(table) {
    this.table = table;
    this._op = 'select';
    this._columns = '*';
    this._count = null;
    this._values = null;
    this._onConflict = null;
    this._ignoreDuplicates = false;
    this._returning = true; // always RETURNING * on mutations; harmless if unused
    this._wheres = [];
    this._order = null;
    this._limit = null;
    this._offset = null;
    this._single = false;
  }

  select(columns = '*', opts = {}) {
    // On a mutation, .select() just requests the returned row(s); on a read it
    // sets the projection.
    if (this._op === 'select') this._columns = columns;
    if (opts && opts.count) this._count = opts.count;
    return this;
  }

  insert(values) {
    this._op = 'insert';
    this._values = values;
    return this;
  }

  update(values) {
    this._op = 'update';
    this._values = values;
    return this;
  }

  upsert(values, opts = {}) {
    this._op = 'upsert';
    this._values = values;
    this._onConflict = opts.onConflict || null;
    this._ignoreDuplicates = !!opts.ignoreDuplicates;
    return this;
  }

  delete() {
    this._op = 'delete';
    return this;
  }

  eq(col, val) { this._wheres.push({ kind: 'cmp', col, opr: '=', val }); return this; }
  neq(col, val) { this._wheres.push({ kind: 'cmp', col, opr: '<>', val }); return this; }
  gt(col, val) { this._wheres.push({ kind: 'cmp', col, opr: '>', val }); return this; }
  gte(col, val) { this._wheres.push({ kind: 'cmp', col, opr: '>=', val }); return this; }
  lt(col, val) { this._wheres.push({ kind: 'cmp', col, opr: '<', val }); return this; }
  lte(col, val) { this._wheres.push({ kind: 'cmp', col, opr: '<=', val }); return this; }
  in(col, arr) { this._wheres.push({ kind: 'in', col, val: arr }); return this; }
  ilike(col, val) { this._wheres.push({ kind: 'ilike', col, val }); return this; }
  is(col, val) { this._wheres.push({ kind: 'is', col, val }); return this; }
  or(expr) { this._wheres.push({ kind: 'or', expr }); return this; }

  order(col, opts = {}) {
    this._order = { col, ascending: opts.ascending !== false };
    return this;
  }

  limit(n) { this._limit = n; return this; }

  range(from, to) {
    this._offset = from;
    this._limit = to - from + 1;
    return this;
  }

  single() { this._single = true; return this; }

  // Thenable: `await builder` / `builder.then(...)`
  then(resolve, reject) {
    return this._execute().then(resolve, reject);
  }

  catch(reject) {
    return this._execute().catch(reject);
  }

  // -- SQL construction --------------------------------------------------

  _buildWhere(params) {
    if (this._wheres.length === 0) return '';
    const clauses = this._wheres.map((w) => {
      switch (w.kind) {
        case 'cmp': {
          params.push(w.val);
          return `${w.col} ${w.opr} $${params.length}`;
        }
        case 'in': {
          params.push(w.val);
          return `${w.col} = ANY($${params.length})`;
        }
        case 'ilike': {
          params.push(w.val);
          return `${w.col} ILIKE $${params.length}`;
        }
        case 'is': {
          if (w.val === null) return `${w.col} IS NULL`;
          if (w.val === true) return `${w.col} IS TRUE`;
          if (w.val === false) return `${w.col} IS FALSE`;
          params.push(w.val);
          return `${w.col} = $${params.length}`;
        }
        case 'or':
          return `(${this._parseOr(w.expr, params)})`;
        default:
          return '';
      }
    });
    return ` WHERE ${clauses.join(' AND ')}`;
  }

  // Minimal PostgREST .or() parser: "col.op.val,col.op.val" -> "a OR b"
  _parseOr(expr, params) {
    return expr
      .split(',')
      .map((token) => {
        const [col, op, ...rest] = token.split('.');
        const raw = rest.join('.');
        if (op === 'is') {
          if (raw === 'null') return `${col} IS NULL`;
          if (raw === 'true') return `${col} IS TRUE`;
          if (raw === 'false') return `${col} IS FALSE`;
        }
        // eq / neq / gt / ...
        const opMap = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=' };
        const sqlOp = opMap[op] || '=';
        let val = raw;
        if (raw === 'true') val = true;
        else if (raw === 'false') val = false;
        else if (raw === 'null') return `${col} IS NULL`;
        params.push(val);
        return `${col} ${sqlOp} $${params.length}`;
      })
      .join(' OR ');
  }

  async _execute() {
    try {
      const { text, params } = this._toSql();
      const res = await getPool().query(text, params);

      if (this._op === 'select' && this._isCountStar()) {
        return { data: res.rows, error: null, count: res.rows[0] ? Number(res.rows[0].count) : 0 };
      }

      let rows = res.rows;
      let count = null;

      if (this._count === 'exact') {
        count = rows[0]?.__total_count != null ? Number(rows[0].__total_count) : rows.length;
        rows = rows.map(({ __total_count, ...rest }) => rest);
      } else if (this._op === 'delete') {
        count = res.rowCount;
      }

      if (this._single) {
        if (rows.length === 0) {
          return {
            data: null,
            error: { message: 'No rows found', code: 'PGRST116' },
            count,
          };
        }
        return { data: rows[0], error: null, count };
      }

      return { data: rows, error: null, count };
    } catch (error) {
      return { data: null, error: { message: error.message, code: error.code }, count: null };
    }
  }

  _isCountStar() {
    return typeof this._columns === 'string' && this._columns.trim() === 'count(*)';
  }

  _toSql() {
    const params = [];
    switch (this._op) {
      case 'insert':
      case 'upsert':
        return this._toInsertSql(params);
      case 'update':
        return this._toUpdateSql(params);
      case 'delete':
        return { text: `DELETE FROM ${this.table}${this._buildWhere(params)}`, params };
      default:
        return this._toSelectSql(params);
    }
  }

  _toSelectSql(params) {
    if (this._isCountStar()) {
      return {
        text: `SELECT COUNT(*)::int AS count FROM ${this.table}${this._buildWhere(params)}`,
        params,
      };
    }
    let cols = this._columns || '*';
    if (this._count === 'exact') cols = `${cols}, COUNT(*) OVER() AS __total_count`;

    let text = `SELECT ${cols} FROM ${this.table}${this._buildWhere(params)}`;
    if (this._order) {
      text += ` ORDER BY ${this._order.col} ${this._order.ascending ? 'ASC' : 'DESC'}`;
    }
    if (this._limit != null) text += ` LIMIT ${Number(this._limit)}`;
    if (this._offset != null) text += ` OFFSET ${Number(this._offset)}`;
    return { text, params };
  }

  _toInsertSql(params) {
    const rows = Array.isArray(this._values) ? this._values : [this._values];
    if (rows.length === 0) {
      // Nothing to insert — mimic an empty successful result.
      return { text: `SELECT 1 WHERE false`, params };
    }
    const columns = Object.keys(rows[0]);
    const valuesSql = rows
      .map(
        (row) =>
          `(${columns
            .map((c) => {
              params.push(encodeValue(row[c]));
              return `$${params.length}`;
            })
            .join(', ')})`
      )
      .join(', ');

    let text = `INSERT INTO ${this.table} (${columns.join(', ')}) VALUES ${valuesSql}`;
    if (this._op === 'upsert') {
      const conflict = this._onConflict ? `(${this._onConflict})` : '';
      text += this._ignoreDuplicates
        ? ` ON CONFLICT ${conflict} DO NOTHING`
        : ` ON CONFLICT ${conflict} DO UPDATE SET ${columns
            .filter((c) => !this._onConflict?.split(',').map((s) => s.trim()).includes(c))
            .map((c) => `${c} = EXCLUDED.${c}`)
            .join(', ')}`;
    }
    text += ` RETURNING *`;
    return { text, params };
  }

  _toUpdateSql(params) {
    const cols = Object.keys(this._values);
    const setSql = cols
      .map((c) => {
        params.push(encodeValue(this._values[c]));
        return `${c} = $${params.length}`;
      })
      .join(', ');
    const text = `UPDATE ${this.table} SET ${setSql}${this._buildWhere(params)} RETURNING *`;
    return { text, params };
  }
}

/** A drop-in replacement for the Supabase client's `.from(table)` entrypoint. */
export const pgClient = {
  from(table) {
    return new QueryBuilder(table);
  },
};
