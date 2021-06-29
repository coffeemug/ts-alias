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
export type RpcFn<ArgsT extends t.Mixed, Context> =
  (args: ArgsT, context: Context) => unknown | Promise<unknown>;

export const _rpc =
  <Context, ArgsT extends t.Mixed>(
    argsType: ArgsT,
    cb: RpcFn<t.TypeOf<ArgsT>, Context>
  ) : ChannelSpec<Context, ArgsT, Event> =>
{
  const onSubscribe = _channel<Context, ReturnType<typeof cb>, ArgsT>(argsType, async ({emit}, args, context) => {
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
