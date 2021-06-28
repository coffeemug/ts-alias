import { isLeft } from 'fp-ts/Either';
import * as t from 'io-ts';
import { PathReporter } from 'io-ts/PathReporter'
import { ConnectFn, Channel, Destructor } from './core/config';
import { ErrorBody } from 'ts-alias-wire';

/*
  Type safe channels
*/
export type OnChannelFn<ArgsT extends t.Mixed, Context> =
  (controls: Channel, args: ArgsT, context: Context)
    => Promise<Destructor | void>;

export const fromChannel =
  <ArgsT extends t.Mixed, Context>
  (argsType: ArgsT, channel: OnChannelFn<ArgsT, Context>): ConnectFn<Context> =>
{
  const onSubscribe: ConnectFn<Context> = async ({emit}, args, context, _) => {
    const decoded = argsType.decode(args);
    if (isLeft(decoded)) {
      const parseErrors = PathReporter.report(decoded);
      const res: ErrorBody = {
        identifier: 'bad_arguments',
        message: JSON.stringify(parseErrors, null, 2),
      };
      emit('error', res);
      return;
    }

    try {
      return await channel({emit}, <t.TypeOf<ArgsT>>decoded.right, context);
    } catch (err: any) {
      if (err instanceof AliasError) {
        const res: ErrorBody = {
          identifier: err.identifier,
          message: err.message,
        }
        emit('error', res);
      } else {
        const res: ErrorBody = {
          identifier: 'internal_server_error',
          message: err.toString(),
        }
        emit('error', res);
      }
    }
  };
  return onSubscribe;
}

/*
  Type safe RPC calls
*/
export type OnRpcFn<ArgsT extends t.Mixed, Context> =
  (args: ArgsT, context: Context) => unknown | Promise<unknown>;

export const fromRpc =
    <ArgsT extends t.Mixed, Context>
    (argsType: ArgsT, onRpc: OnRpcFn<t.TypeOf<ArgsT>, Context>)
    : ConnectFn<Context> =>
{
  const onSubscribe = fromChannel<ArgsT, Context>(argsType, async ({emit}, args, context) => {
    const response = await onRpc(args, context);
    emit('ok', response);
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
