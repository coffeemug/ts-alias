import ReconnectingWebSocket from 'reconnecting-websocket';
import stringify from 'json-stable-stringify';
import Multimap from 'multimap';
import { AliasError } from 'ts-alias-protocol';
import type {
  EventMsg, ErrorBody, ServerSpec, ServerBaseSpec,
  ChannelName, ChannelArgT, ChannelRetT
} from 'ts-alias-protocol';

export interface Config {
  onContext: ContextFn,
  url: string,
  WebSocket?: unknown,
}

class AliasClient<SpecT extends ServerBaseSpec & ServerSpec<any, SpecT>> {
  wsc: ReconnectingWebSocket;
  onContext: ContextFn;
  requestId: number;
  watchArgs: Multimap<ChannelName<SpecT>, DoWatch<SpecT>>;
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

  async call<Name extends ChannelName<SpecT>>(rpcName: Name, rpcArgs: ChannelArgT<SpecT, Name>)
    : Promise<ChannelRetT<SpecT, Name>>
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

    const p = new Promise<ChannelRetT<SpecT, Name>>((resolve, reject) => {
      ref.stopWatch = that.watch(
        rpcName, rpcArgs,
        (err) => {
          ref.timeoutId && clearTimeout(ref.timeoutId);
          ref.stopWatch && ref.stopWatch();
          reject(new AliasError(err.identifier, err.message));
        },
        (value: ChannelRetT<SpecT, Name>) => {
          ref.timeoutId && clearTimeout(ref.timeoutId);
          ref.stopWatch && ref.stopWatch();
          resolve(value);
        }
      );

      // in case a watch times out
      ref.timeoutId = setTimeout(() => {
        ref.stopWatch && ref.stopWatch();
        reject(new AliasError("timeout", `Request ${rpcName} timed out`));
      }, 3000);
    });

    return await p;
  }

  watch<Name extends ChannelName<SpecT>>(rpcName: Name, rpcArgs: ChannelArgT<SpecT, Name>, onError: ErrorFn, onMessages: MessagesFn<ChannelRetT<SpecT, Name>>) {
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
export type ContextFn = () => Promise<unknown> | unknown;
export type ErrorFn = (err: ErrorBody) => void;
export type MessagesFn<Event> = (msgs: Event) => void;

type WatchConn = {
  onError: ErrorFn,
  onMessages: MessagesFn<unknown>,
};

type WatchedConns = Map<number, WatchConn>;

type DoWatch<SpecT> = {
  rpcName: ChannelName<SpecT>,
  rpcArgs: ChannelArgT<SpecT, ChannelName<SpecT>>,
  onError: ErrorFn,
  onMessages: MessagesFn<ChannelRetT<SpecT, ChannelName<SpecT>>>,
};

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
