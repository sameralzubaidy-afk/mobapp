import { fn } from 'jest-mock';
import { createFunctionsMock, resetFunctionsMock } from './supabase/functions';

type MockResponse = {
  data: any;
  error: any;
};

type TableOperation = 'select' | 'insert' | 'update' | 'upsert' | 'delete';

const tableOperationResponses = new Map<string, Partial<Record<TableOperation, MockResponse>>>();
let rpcResponse: MockResponse = { data: null, error: null };

const cloneResponse = (response: MockResponse): MockResponse => ({
  data: response.data,
  error: response.error,
});

const defaultResponseFor = (operation: TableOperation, expectSingle: boolean): MockResponse => {
  if (expectSingle) {
    return { data: { id: 'mock-row-id', value: true }, error: null };
  }

  if (operation === 'insert' || operation === 'update' || operation === 'upsert') {
    return { data: [{ id: 'mock-row-id' }], error: null };
  }

  return { data: [], error: null };
};

const resolveTableResponse = (
  table: string,
  operation: TableOperation,
  expectSingle: boolean
): MockResponse => {
  const tableOverrides = tableOperationResponses.get(table);
  const operationOverride = tableOverrides?.[operation];
  const base = operationOverride ?? defaultResponseFor(operation, expectSingle);

  if (expectSingle && Array.isArray(base.data)) {
    return {
      data: base.data[0] ?? null,
      error: base.error,
    };
  }

  return cloneResponse(base);
};

const makeQueryBuilder = (table: string) => {
  let currentOperation: TableOperation = 'select';

  const builder: any = {};

  const setOperation = (operation: TableOperation) => {
    currentOperation = operation;
    return builder;
  };

  const passthrough = () => builder;

  builder.select = fn((_columns?: string) => setOperation('select'));
  builder.insert = fn((_values?: any) => setOperation('insert'));
  builder.update = fn((_values?: any) => setOperation('update'));
  builder.upsert = fn((_values?: any) => setOperation('upsert'));
  builder.delete = fn(() => setOperation('delete'));

  builder.eq = fn(passthrough);
  builder.neq = fn(passthrough);
  builder.in = fn(passthrough);
  builder.or = fn(passthrough);
  builder.and = fn(passthrough);
  builder.not = fn(passthrough);
  builder.is = fn(passthrough);
  builder.gte = fn(passthrough);
  builder.gt = fn(passthrough);
  builder.lte = fn(passthrough);
  builder.lt = fn(passthrough);
  builder.ilike = fn(passthrough);
  builder.like = fn(passthrough);
  builder.contains = fn(passthrough);
  builder.overlaps = fn(passthrough);
  builder.match = fn(passthrough);
  builder.order = fn(passthrough);
  builder.limit = fn(passthrough);
  builder.range = fn(passthrough);
  builder.filter = fn(passthrough);

  builder.single = fn(async () => resolveTableResponse(table, currentOperation, true));
  builder.maybeSingle = fn(async () => {
    const response = resolveTableResponse(table, currentOperation, true);
    return {
      data: response.data ?? null,
      error: response.error,
    };
  });

  builder.then = (onFulfilled: any, onRejected: any) =>
    Promise.resolve(resolveTableResponse(table, currentOperation, false)).then(onFulfilled, onRejected);

  return builder;
};

const makeChannel = () => {
  const channel: any = {};
  channel.on = fn(() => channel);
  channel.subscribe = fn(() => channel);
  channel.unsubscribe = fn(async () => ({ error: null }));
  channel.send = fn(async () => ({ error: null }));
  channel.track = fn(async () => ({ error: null }));
  return channel;
};

export const supabase = {
  auth: {
    getUser: fn(async () => ({ data: { user: null }, error: null })),
    getSession: fn(async () => ({ data: { session: null }, error: null })),
    signUp: fn(async () => ({ data: { user: null, session: null }, error: null })),
    signInWithPassword: fn(async () => ({ data: { user: null, session: null }, error: null })),
    signOut: fn(async () => ({ error: null })),
  },
  from: fn((table: string) => makeQueryBuilder(table)),
  rpc: fn(async () => cloneResponse(rpcResponse)),
  functions: createFunctionsMock(),
  channel: fn(() => makeChannel()),
  removeChannel: fn(async () => ({ error: null })),
  removeAllChannels: fn(async () => ({ error: null })),
};

export const __setSupabaseTableResponse = (
  table: string,
  operation: TableOperation,
  response: MockResponse
) => {
  const existing = tableOperationResponses.get(table) ?? {};
  existing[operation] = response;
  tableOperationResponses.set(table, existing);
};

export const __setSupabaseRpcResponse = (response: MockResponse) => {
  rpcResponse = response;
};

export const __resetSupabaseMocks = () => {
  tableOperationResponses.clear();
  rpcResponse = { data: null, error: null };
  resetFunctionsMock();

  supabase.auth.getUser.mockReset();
  supabase.auth.getSession.mockReset();
  supabase.auth.signUp.mockReset();
  supabase.auth.signInWithPassword.mockReset();
  supabase.auth.signOut.mockReset();
  supabase.from.mockClear();
  supabase.rpc.mockReset();
  supabase.channel.mockClear();
  supabase.removeChannel.mockReset();
  supabase.removeAllChannels.mockReset();

  supabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
  supabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
  supabase.auth.signUp.mockResolvedValue({ data: { user: null, session: null }, error: null });
  supabase.auth.signInWithPassword.mockResolvedValue({
    data: { user: null, session: null },
    error: null,
  });
  supabase.auth.signOut.mockResolvedValue({ error: null });
  supabase.rpc.mockResolvedValue({ data: null, error: null });
  supabase.removeChannel.mockResolvedValue({ error: null });
  supabase.removeAllChannels.mockResolvedValue({ error: null });
};

__resetSupabaseMocks();
