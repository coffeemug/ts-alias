import * as t from 'io-ts';
import { Status, Request, ErrorBody } from 'ts-alias-wire';

/*
  Server configuration
*/
export interface Config<Context, SpecT extends ServerBaseSpec> {
  channels: ServerSpec<Context, SpecT>,
  onContext: ContextFn<Context>,
  port?: number,
}

export type ServerSpec<Context, SpecT extends ServerBaseSpec> = {
  [Key in keyof SpecT]: SpecT[Key] extends ChannelSpec<Context, SpecT[Key]['argSpec'], infer _> ? SpecT[Key] : never;
};

export type ServerBaseSpec = Record<string, { argSpec: t.Mixed, onConnect: unknown }>;

export type ChannelSpec<Context, ArgSpecT extends t.Mixed, Event> = {
  argSpec: ArgSpecT,
  onConnect: ConnectFn<Context, t.TypeOf<ArgSpecT>, Event>
}

// New connection
export type ConnectFn<Context, ArgT, Event> = (
    controls: Channel<Event>,
    args: ArgT,
    context: Context,
    request: Request
  ) => Promise<Destructor | void>;

// Channel interface
export interface Channel<OkBody> {
  emit: <statusT extends Status>(
      status: statusT,
      response: ResponseT<OkBody>[statusT]
    ) => void;
}

export type Destructor = () => void;

// Context
export type ContextFn<Context>
  = (metadata: unknown) => Promise<Context> | Context;

// type util
export type ResponseT<Event> = {
  ok: Event,
  error: ErrorBody,
};

