import * as t from 'io-ts';
import { isLeft } from 'fp-ts/Either';
import { PathReporter } from 'io-ts/PathReporter'
import { ConnectFn, Channel, ChannelSpec, Destructor } from './core/config';
import { ErrorBody } from 'ts-alias-wire';

/*
  Type safe channels
*/
export const _channel =
  <Context, Event, ArgSpecT extends t.Mixed>(
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

export const _rpc =
  <Context, ArgsT extends t.Mixed, RpcT extends RpcFn<Context, ArgsT, ReturnType<RpcT>>>(
    argsType: ArgsT,
    cb: RpcT,
  ) : ChannelSpec<Context, ArgsT, Event> =>
{
  const onSubscribe = _channel<Context, ReturnType<RpcT>, ArgsT>(argsType, async ({emit}, args, context) => {
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

/*
  Errors
*/
export class AliasError extends Error {
  constructor(public identifier: string, message?: string) {
    super(message);
    this.name = "AliasError";
  }
}
