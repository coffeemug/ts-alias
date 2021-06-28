import * as t from 'io-ts';

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

export type EventMsg = ErrorEvent | OkEvent;

export interface ErrorEvent {
  echo: number,
  status: 'error',
  error: {
    identifier: string,
    message?: string,
  },
}

export interface OkEvent {
  echo: number,
  status: 'ok',
  message: unknown,
}

export type ErrorBody = ErrorEvent['error'];
export type Status = EventMsg['status'];
