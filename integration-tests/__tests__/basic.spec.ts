import * as t from 'io-ts';
import WS from 'ws';
import { AliasClient } from 'ts-alias-client';
import { AliasServer } from 'ts-alias-server';
import { AliasError } from 'ts-alias-protocol';
import { _rpc, _channel } from 'ts-alias-server';

/*
  Type safe rpc calls
*/
type Context = void;
const channel = _channel<Context>();
const rpc = _rpc<Context>();

/*
  Test a call
*/
const Div = t.type({
  num: t.number,
  den: t.number,
});

const div = rpc(Div, (args, _): number => {
  return args.num / args.den;
});

test('', async () => {
  const x = await client.call("div", { num: 15, den: 3 });
  expect(x).toBe(5);
});

/*
  Bad arguments
*/
test('', async () => {
  await expect(client.call("div", {} as any))
    .rejects
    .toThrowError(
      new AliasError("bad_arguments",
`[
  "Invalid value undefined supplied to : { num: number, den: number }/num: number",
  "Invalid value undefined supplied to : { num: number, den: number }/den: number"
]`
      ));
});

/*
  Unknown call
*/
test('', async () => {
  await expect(client.call("does_not_exist" as any, {}))
    .rejects
    .toThrowError(
      new AliasError("unknown_call", "call to undefined channel does_not_exist"));
});

/*
  User API handler throws on the server
*/
const raise = rpc(t.type({}), (args, _): void => {
  throw new AliasError("go_fuck_yourself", "raising a `go_fuck_yourself` error");
});

test('', async () => {
  await expect(client.call("raise", {}))
    .rejects
    .toThrowError(
      new AliasError("go_fuck_yourself1", "raising a `go_fuck_yourself` error"));
});

/*
  Test a channel
*/
const triple = channel<typeof t.number, number>(t.number, async ({ emit }, args, _) => {
  emit("ok", args * 3);
});

test('', async () => {
  const x = await client.call("triple", 7);
  expect(x).toBe(21);
});

test('', async () => {
  const x = await new Promise((resolve, reject) => {
    client.watch("triple", 7, reject, resolve);
  });
  expect(x).toBe(21);
});

/*
  Optional argument fields
*/
const Incr = t.type({
  num: t.number,
  incr: t.union([t.number, t.undefined]),
});

const incr = rpc(Incr, (args, _): number => {
  return args.num + (args.incr || 1);
});

test('', async () => {
  let x = await client.call("incr", { num: 10, incr: 3 });
  expect(x).toBe(13);

  x = await client.call("incr", { num: 10 });
  expect(x).toBe(11);
});

type x = {
  i: number | undefined,
  j?: number
}

const y: x = {
  i: 4
};

/*
  Setup and teardown boilerplate
*/
const channels = { div, raise, triple, incr };

let server: AliasServer<Context, typeof channels>;
let client: AliasClient<typeof channels>;
beforeAll(() => {
  // start the server
  server = new AliasServer<Context, typeof channels>({
    onContext: () => {},
    channels,
    port: 443,
  });
  server.start();

  // connect
  client = new AliasClient<typeof channels>({
    WebSocket: WS,
    url: "ws://localhost:443",
    onContext: () => {}
  });
});

afterAll(async () => {
  client.close();
  await server.stop();
});

