import { Config, Request, OkEvent, ErrorEvent, Status, ErrorEventBody, ResponseT } from './interface';

/*
  Actual request handling (would be nice to break up this function)
*/
export const handleRequest = async <Context>(socket: any, message: string, config: Config<Context>) => {
  const emit = <statusT extends Status>(status: statusT, message: ResponseT[statusT]) => {
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
        const _message: ErrorEventBody = <ErrorEventBody>message;
        const event: ErrorEvent = {
          status: "error",
          echo: request.echo,
          message: _message,
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
  const channel = config.channels[request.channel];
  if (!channel) {
    const res: ErrorEventBody = {
      identifier: 'unknown_call',
    };
    emit('error', res);
    return;
  }

  // fire in the hole!
  const context = await config.onContext(request.metadata);
  return await channel({ emit }, request.args, context, request);
}