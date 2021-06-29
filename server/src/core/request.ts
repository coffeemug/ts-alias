import { isLeft } from 'fp-ts/Either';
import { PathReporter } from 'io-ts/PathReporter'
import { Config, ServerBaseSpec } from './config';
import { Request, OkEvent, ErrorEvent, Status, ErrorBody } from 'ts-alias-wire';

/*
  Actual request handling (would be nice to break up this function)
*/
export const handleRequest = async <Context, SpecT extends ServerBaseSpec>(socket: any, message: string, config: Config<Context, SpecT>) => {
  const emit = (status: Status, message: unknown) => {
    try {
      // I think there is a typescript limitation that requires explicitly adding this
      // runtime branch. It should be possible to eventually remove it and have the
      // type system check this automatically. It should type check without the branch.
      if (status == 'ok') {
        const event: OkEvent = {
          status: "ok",
          echo: request.echo,
          message,
        };
        socket.send(JSON.stringify(event));
      } else if (status == 'error') {
        const _message: ErrorBody = <ErrorBody>message;
        const event: ErrorEvent = {
          status: "error",
          echo: request.echo,
          error: _message,
        };
        socket.send(JSON.stringify(event));
      }
    } catch (err) {
      console.error("Couldn't stringify message", event);
    }
  }

  // parse the message
  try {
    message = JSON.parse(message);
  } catch {
    emit("error", {
      identifier: "bad_request",
    });
    return;
  }

  // check that it's a valid request
  let request: Request;
  if (Request.is(message)) {
    request = message;
  } else {
    emit("error", {
      identifier: "bad_request",
    });
    return;
  }

  // grab the requested channel
  const channel = config.channels[request.channel as keyof SpecT];
  if (!channel) {
    const res: ErrorBody = {
      identifier: 'unknown_call',
    };
    emit('error', res);
    return;
  }

  // validate the incoming message
  const decoded = channel.argSpec.decode(request.args);
  if (isLeft(decoded)) {
    const parseErrors = PathReporter.report(decoded);
    const res: ErrorBody = {
      identifier: 'bad_arguments',
      message: JSON.stringify(parseErrors, null, 2),
    };
    emit('error', res);
    return;
  }

  // fire in the hole!
  try {
    const context = config.onContext && await config.onContext(request.metadata);
    return await channel.onConnect({ emit }, request.args, context, request);
  } catch (err: any) {
    console.log("ERRORING:", err.toString());
    const res: ErrorBody = {
      identifier: 'internal_server_error',
      message: err.toString(),
    }
    emit('error', res);
  }
}
