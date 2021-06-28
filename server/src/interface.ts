import * as t from 'io-ts';

/*
  Server configuration
*/
export interface Config<Context> {
  onContext: OnContextFn<Context>,
  channels: { [k: string]: OnSubscribeFn<Context> | undefined },
  port: number,
}

export type OnContextFn<Context> = (metadata: unknown) => Promise<Context> | Context;

export type OnSubscribeFn<Context>
  = (controls: Subscription, args: unknown, context: Context, request: Request)
      => Promise<Destructor | void>;
export interface Subscription {
  emit: <statusT extends Status>(status: statusT, response: ResponseT[statusT]) => void;
}
export type ResponseT = {
  ok: unknown,
  error: ErrorEventBody,
};
export type Destructor = () => void;

/*
  Wire protocol
*/
export const Request = t.type({
  echo: t.number,
  channel: t.string,
  args: t.unknown,
  metadata: t.unknown,
});
export type Request = t.TypeOf<typeof Request>;

export interface OkEvent {
  status: 'ok',
  echo: number,
  message: unknown,
}

export type OkEventBody = unknown;

export interface ErrorEvent {
  status: 'error',
  echo: number,
  message: ErrorEventBody,
}

export type ErrorEventBody = {
  identifier: string,
  message?: string,
};

export type Event = ErrorEvent | OkEvent;

export type Status = Event['status'];