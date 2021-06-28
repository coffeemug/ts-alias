import * as t from 'io-ts';
import WS from 'ws';
import { Server, AliasError } from 'ts-alias-server/';
import { fromRpc, OnRpcFn, fromChannel, OnChannelFn } from 'ts-alias-server';
import { RpcClient } from 'ts-alias-client';

/*
  Type safe rpc calls
*/
type Context = void;
const rpc = <ArgsT extends t.Mixed>(argsT: ArgsT, onRpc: OnRpcFn<t.TypeOf<ArgsT>, Context>) => fromRpc(argsT, onRpc);
const channel = <ArgsT extends t.Mixed>(args: ArgsT, onChannel: OnChannelFn<t.TypeOf<ArgsT>, Context>) => fromChannel(args, onChannel);

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
  await expect(client.call("div", {}))
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
  await expect(client.call("foo", {}))
    .rejects
    .toThrowError(
      new AliasError("unknown_call"));
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

test('', async () => {
  const x = await client.call("raise", {}, { silent: true });
  expect(x).toBe(undefined);
});

/*
  Setup and teardown boilerplate
*/
const channels = { div, raise };
let server: Server<Context>;
let client: RpcClient<Context>;
beforeAll(() => {
  // start the server
  server = new Server<Context>({
    onContext: () => {},
    channels,
    port: 443,
  });
  server.start();

  // connect
  client = new RpcClient({
    WebSocket: WS,
    url: "ws://localhost:443",
    onContext: () => {}
  });
});

afterAll(async () => {
  client.close();
  await server.stop();
});

