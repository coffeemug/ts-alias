import * as t from 'io-ts';
import { Status, Request, ErrorBody } from './wire';
import type { Expand, OnlyRequired } from './utils';

/*
  Endpoints spec
*/
export type ServerSpec<Context, SpecT extends ServerBaseSpec> = {
  [Key in keyof SpecT]: SpecT[Key] extends ChannelSpec<Context, SpecT[Key]['argSpec'], infer _> ? SpecT[Key] : never;
};

export type ServerBaseSpec = Record<string, { argSpec: t.Mixed, onConnect: unknown }>;

export type ChannelSpec<Context, ArgSpecT extends t.Mixed, Event> = {
  argSpec: ArgSpecT,
  onConnect: ConnectFn<Context, t.TypeOf<ArgSpecT>, Event>
}

// Helper types to detruct the spec/channel spec
export type ChannelName<SpecT> = keyof SpecT & string;
export type ChannelArgT<SpecT, Name extends ChannelName<SpecT>> = SpecT[Name] extends ChannelSpec<infer _A, infer ArgSpecT, infer _B> ? OnlyRequired<t.TypeOf<ArgSpecT>> : never;
export type ChannelRetT<SpecT, Name extends ChannelName<SpecT>> = SpecT[Name] extends ChannelSpec<infer _A, infer _B, infer RetT> ? RetT : never;

// New connection
export type ConnectFn<Context, ArgT, Event> = (
    controls: Channel<Event>,
    args: ArgT,
    context: Context,
    request: Request
  ) => Promise<Destructor | void>;

// Channel interface
export interface Channel<Event> {
  emit: <statusT extends Status>(
      status: statusT,
      response: ResponseT<Event>[statusT]
    ) => void;
}

export type Destructor = () => void;

// type util
export type ResponseT<Event> = {
  ok: Event,
  error: ErrorBody,
};

