import * as t from 'io-ts';
import ReconnectingWebSocket from 'reconnecting-websocket';
import stringify from 'json-stable-stringify';
import Multimap from 'multimap';
import { AliasError, EventMsg, ErrorBody, ServerSpec, ServerBaseSpec, ChannelSpec } from 'ts-alias-protocol';

export interface Config {
  onContext: ContextFn,
  url: string,
  WebSocket?: unknown,
}

class AliasClient<SpecT extends ServerBaseSpec & ServerSpec<any, SpecT>> {
  wsc: ReconnectingWebSocket;
  onContext: ContextFn;
  requestId: number;
  watchArgs: Multimap<SpecName<SpecT>, DoWatch<SpecT>>;
  watchConns: WatchedConns;
  openp: boolean;

  constructor(public config: Config) {
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

  async call<Name extends SpecName<SpecT>>(rpcName: Name, rpcArgs: SpecArgs<SpecT, Name>)
    : Promise<SpecRet<SpecT, Name>>
  {
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

    const p = new Promise<SpecRet<SpecT, Name>>((resolve, reject) => {
      ref.stopWatch = that.watch(
        rpcName, rpcArgs,
        (err) => {
          ref.timeoutId && clearTimeout(ref.timeoutId);
          ref.stopWatch && ref.stopWatch();
          reject(new AliasError(err.identifier, err.message));
        },
        (value: SpecRet<SpecT, Name>) => {
          ref.timeoutId && clearTimeout(ref.timeoutId);
          ref.stopWatch && ref.stopWatch();
          resolve(value);
        }
      );

      // in case a watch times out
      ref.timeoutId = setTimeout(() => {
        ref.stopWatch && ref.stopWatch();
        reject(new AliasError("timeout", "Request timed out"));
      }, 3000);
    });

    return await p;
  }

  watch<Name extends SpecName<SpecT>>(rpcName: Name, rpcArgs: SpecArgs<SpecT, Name>, onError: ErrorFn, onMessages: MessagesFn<SpecRet<SpecT, Name>>) {
    const key = computeKey(rpcName, rpcArgs);
    const obj = { rpcName, rpcArgs, onError, onMessages };

    this.watchArgs.set(key, obj);
    const cleanup = this.doWatch(obj)
    return () => {
      cleanup();
      this.watchArgs.delete(key, obj);
    };
  }

  doWatch({ rpcName, rpcArgs, onError, onMessages }: DoWatch<SpecT>) {
    if (!this.openp) {
      return () => {};
    }

    const [wsc, requestId, watchConns] = [this.wsc, this.requestId, this.watchConns];
    this.requestId++;

    watchConns.set(requestId, { onMessages: onMessages as any, onError });

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
type ContextFn = () => Promise<unknown> | unknown;

type ErrorFn = (err: ErrorBody) => void;
type MessagesFn<Event> = (msgs: Event) => void;

type WatchConn = {
  onError: ErrorFn,
  onMessages: MessagesFn<unknown>,
};

type WatchedConns = Map<number, WatchConn>;

type DoWatch<SpecT> = {
  rpcName: SpecName<SpecT>,
  rpcArgs: SpecArgs<SpecT, SpecName<SpecT>>,
  onError: ErrorFn,
  onMessages: MessagesFn<SpecRet<SpecT, SpecName<SpecT>>>,
};

type SpecName<SpecT> = keyof SpecT & string;
type SpecArgs<SpecT, Name extends SpecName<SpecT>> = SpecT[Name] extends ChannelSpec<infer _A, infer ArgSpecT, infer _B> ? t.TypeOf<ArgSpecT> : never;
type SpecRet<SpecT, Name extends SpecName<SpecT>> = SpecT[Name] extends ChannelSpec<infer _A, infer _B, infer RetT> ? RetT : never;

/*
  Helper functions
*/
const onMessage = (obj: EventMsg, watchConns: WatchedConns) => {
  const requestId = obj.echo;

  const watchConn = watchConns.get(requestId);
  if (watchConn) {
    const { onMessages, onError } = watchConn;
    if (obj.status == 'ok') {
      onMessages && onMessages(obj.message);
    } else {
      const serverError = obj.error;
      onError && onError(serverError);
    }
  } else {
    //console.log(`Unknown requestId ${requestId}, discarding`);
  }
}

const computeKey = (rpcName: string, rpcArgs: unknown) => {
  return stringify([rpcName, rpcArgs]);
}

export { AliasClient, AliasError };
