import * as t from 'io-ts';
import { ConnectFn, ChannelSpec, ErrorBody, AliasError } from 'ts-alias-protocol';

/*
  Type safe channels
*/
export const _channel = <Context>() =>
  <ArgSpecT extends t.Mixed, Event>(
    argsType: ArgSpecT,
    start: ConnectFn<Context, t.TypeOf<ArgSpecT>, Event>
  ): ChannelSpec<Context, ArgSpecT, Event> => ({
    argSpec: argsType,
    onConnect: start,
});

/*
  Type safe RPC calls
*/
export type RpcFn<Context, ArgsT extends t.Mixed, RetT> =
  (args: ArgsT, context: Context) => RetT | Promise<RetT>;

export const _rpc = <Context>() =>
  <ArgsT extends t.Mixed, RpcT extends RpcFn<Context, t.TypeOf<ArgsT>, ReturnType<RpcT>>>(
    argsType: ArgsT,
    cb: RpcT,
  ) : ChannelSpec<Context, ArgsT, ReturnType<RpcT>> =>
{
  const onSubscribe = _channel<Context>()<ArgsT, ReturnType<RpcT>>(argsType, async ({emit}, args, context) => {
    try {
      const response = await cb(args, context);
      emit('ok', response);
    } catch (err: unknown) {
      if (err instanceof AliasError) {
        const res: ErrorBody = {
          identifier: err.identifier,
          message: err.message,
        }
        emit('error', res);
      } else {
        throw err;
      }
    }
  });
  return onSubscribe;
}

