import { Status, Request, ErrorBody } from 'ts-alias-wire';

/*
  Server configuration
*/
export interface Config<Context> {
  onContext: ContextFn<Context>,
  channels: { [k: string]: ConnectFn<Context> | undefined },
  port: number,
}

// Context
export type ContextFn<Context>
  = (metadata: unknown) => Promise<Context> | Context;

// New connection
export type ConnectFn<Context> = (
    controls: Channel,
    args: unknown,
    context: Context,
    request: Request
  ) => Promise<Destructor | void>;

// Channel interface
export interface Channel {
  emit: <statusT extends Status>(
      status: statusT,
      response: ResponseT[statusT]
    ) => void;
}

export type Destructor = () => void;

// type util
export type ResponseT = {
  ok: unknown,
  error: ErrorBody,
};

