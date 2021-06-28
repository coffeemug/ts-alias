import ReconnectingWebSocket from 'reconnecting-websocket';
import stringify from 'json-stable-stringify';
import Multimap from 'multimap';

export class AliasError extends Error {
  constructor(public identifier: string, message?: string) {
    super(message);
    this.name = "AliasError";
  }
}

export type OnContextFn<Context> = () => Promise<Context> | Context;

export interface Config<Context> {
  onContext: OnContextFn<Context>,
  url: string,
  WebSocket?: unknown,
}

class RpcClient<Context> {
  wsc: ReconnectingWebSocket;
  onContext: OnContextFn<Context>;
  requestId: number;
  watchArgs: Multimap<string, DoWatch>;
  watchConns: WatchConns;
  openp: boolean;

  constructor(public config: Config<Context>) {
    this.wsc = new ReconnectingWebSocket(config.url, [], {
      maxEnqueuedMessages: 0,
      startClosed: true,
      WebSocket: config.WebSocket,
    });
    this.onContext = config.onContext ?? (() => {});
    this.requestId = 0;
    this.watchArgs = new Multimap();
    this.watchConns = new Map<number, WatchConn>();
    this.openp = false;

    const that = this;
    this.wsc.addEventListener('open', () => {
      that.openp = true;
      that.watchArgs.forEach(v => {
        that.doWatch(v);
      });
    });

    this.wsc.addEventListener('close', () => {
      that.openp = false;
      this.watchConns.clear();
    });

    this.wsc.addEventListener('message', ({ data }) => {
      const obj = JSON.parse(data);
      onMessage(obj, that.watchConns);
    });

    this.wsc.reconnect();
  }

  close() {
    this.wsc.close();
  }

  async call(rpcName: string, rpcArgs: unknown, opts?: { silent?: boolean }) {
    type StopWatch = () => void;
    type Ref = {
      timeoutId: null | ReturnType<typeof setTimeout>,
      stopWatch: null | StopWatch,
    }
    const that = this;
    const ref: Ref = {
      timeoutId: null,
      stopWatch: null,
    };

    const p = new Promise((resolve, reject) => {
      ref.stopWatch = that.watch(
        rpcName, rpcArgs,
        (err) => {
          ref.timeoutId && clearTimeout(ref.timeoutId);
          ref.stopWatch && ref.stopWatch();
          if (opts?.silent) {
            resolve(undefined);
          } else {
            reject(new AliasError(err.identifier, err.message));
          }
        },
        (value: unknown) => {
          ref.timeoutId && clearTimeout(ref.timeoutId);
          ref.stopWatch && ref.stopWatch();
          resolve(value);
        }
      );

      // in case a watch times out
      ref.timeoutId = setTimeout(() => {
        ref.stopWatch && ref.stopWatch();
        if(opts?.silent) {
          resolve(undefined);
        } else {
          reject(new AliasError("timeout", "Request timed out"));
        }
      }, 3000);
    });

    return await p;
  }

  watch(rpcName: string, rpcArgs: unknown, onError: OnErrorFn, onMessages: OnMessagesFn) {
    const key = computeKey(rpcName, rpcArgs);
    const obj = { rpcName, rpcArgs, onError, onMessages };

    this.watchArgs.set(key, obj);
    const cleanup = this.doWatch(obj)
    return () => {
      cleanup();
      this.watchArgs.delete(key, obj);
    };
  }

  doWatch({ rpcName, rpcArgs, onError, onMessages }: DoWatch) {
    if (!this.openp) {
      return () => {};
    }

    const [wsc, requestId, watchConns] = [this.wsc, this.requestId, this.watchConns];
    this.requestId++;

    watchConns.set(requestId, { onMessages, onError });

    Promise.resolve(this.onContext()).then((rpcContext) => {
      const request = JSON.stringify({
        echo: requestId,
        channel: rpcName,
        args: rpcArgs ?? null,
        metadata: rpcContext ?? null,
      });
      wsc.send(request);
    });

    return () => {
      watchConns.delete(requestId);
    };
  }
};

/*
  Helper interfaces
*/
type OnErrorFn = (err: ServerError) => unknown;
type OnMessagesFn = (msgs: unknown) => unknown;

type WatchConn = {
  onError: OnErrorFn,
  onMessages: OnMessagesFn,
};

type WatchConns = Map<number, WatchConn>;

type DoWatch = {
  rpcName: string,
  rpcArgs: unknown,
  onError: OnErrorFn,
  onMessages: OnMessagesFn,
};

type ServerResponse = {
  echo: number,
  status: "ok" | "error",
  message: unknown,
};

export type ServerError = {
  identifier: string,
  message?: string,
}

/*
  Helper functions
*/
const onMessage = (obj: ServerResponse, watchConns: WatchConns) => {
  const requestId = obj.echo;
  const events = obj.message;

  const watchConn = watchConns.get(requestId);
  if (watchConn) {
    const { onMessages, onError } = watchConn;
    if (obj.status == 'ok') {
      onMessages && onMessages(events);
    } else {
      const serverError = <ServerError>events;
      onError && onError(serverError);
    }
  } else {
    //console.log(`Unknown requestId ${requestId}, discarding`);
  }
}

const computeKey = (rpcName: string, rpcArgs: unknown) => {
  return stringify([rpcName, rpcArgs]);
}

export { RpcClient };