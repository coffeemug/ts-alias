# TLDR

Adding API endpoints takes a lot more time than writing functions, which in turn makes programming modern apps slow and frustrating. This project includes a server and client libraries that make it dramatically easier to do client-server communication.

On the server:

```ts
import * as t from 'io-ts';

const square = rpc(t.number, (n): number => {
  return n * n;
});
```

On the client:

```ts
const m = await client.call("square", 5);
assert(m == 25);
```

Everything is typechecked. When you type `await client.call("sq...` on the client, you get autocompletion with all available rpc calls, and the client knows the expected argument type and the return type. Attempting to make a non-existing rpc call, passing an argument of the wrong type, or expecting the wrong return type will not type check.

This makes programming client-server communication in typescript feel as easy and solid as a functional call. It's a delightful way to program.

# Installation and setup details

I deliberately avoided setup details in the `TLDR` section to give you a sense of how easy it is to program with `ts-alias` once you're set up. Let's look at these details here.

## Server

First, install the `ts-alias-server` library in your backend project:

```sh
npm i ts-alias-server io-ts
```

Then, add the following snippet to your utilities file somewhere in your project. (Typescript doesn't yet support partial type argument inference, and I haven't figured out how to avoid this step without this feature. Fortunately, you do this once per project and forget about it.)

```ts
import { _channel, _rpc } from 'ts-alias-server';

export type Context = void;
export const channel = _channel<Context>();
export const rpc = _rpc<Context>();
```

You can now use the `rpc` function you defined above to create rpc calls:

```ts
import * as t from 'io-ts';

// Square a number
const square = rpc(t.number, (n): number => {
  return n * n;
});

// Divide one number by another
const DivArgs = t.type({
  num: t.number,
  den: t.number,
});

const div = rpc(DivArgs, (args, _): number => {
  return args.num / args.den;
});
```

Finally, let's pull these together and start the server:

```ts
import { AliasServer } from 'ts-alias-server';

const channels = { square, div };
export type channels = typeof channels;

const server = new AliasServer<Context, channels>({
  channels,
  port: 443,
  onContext: () => {},
});
server.start();
```

That's it! The server should be up and running, waiting to respond to client requests.

## Client

Now install the `ts-alias-client` library in your frontend project:

```sh
npm i ts-alias-client
```

Create a client connection like this:

```ts
import { AliasClient } from 'ts-alias-client';
import type { channels } from './SERVER_PROJECT/TYPE_DEFINITIONS.ts';

const client = new AliasClient<channels>({
  url: "ws://localhost:443",
  onContext: () => {},
  WebSocket,
});
```

That's it! You can start making rpc calls:

```ts
const k = await client.call("div", { num: 30, den: 6 });
```

# Channels

The Alias server and client are built on websockets, so the protocol supports push communication from the server to the client. This is done via a primitive called a `channel`. In fact, the `rpc` interface above is syntactic sugar built on channels-- an rpc call opens a channel, listens for a single message, and ends. To send messages from the server to the client (e.g. to do push notifications), you can use the underlying channel primitive directly.

On the server:

```ts
const EmptyArg = t.type({});
const counter = channel<typeof EmptyArg, number>(EmptyArg, async ({ emit }) => {
  let x = 0;
  setInterval(() => {
    emit("ok", x++);
  }, 1000);
});
```

When a client connects to this channel, it will start receiving monotonically increasing numbers, starting with zero, from the server. Here is how you connect on the client side:

```ts
client.watch("counter", {}, console.error, console.log);
```

Again, everything is type checked. If you replace `console.log` with your own function, the type checker will ensure it can accept an argument of type `number`. You will get a type error if it can't. 

# Context

It's often useful for the client to pass some information to the server and for the server to do some processing on every request. For example, the client may want to pass a user token and the server may want to validate the token before executing the request. You can do it with `ts-alias` using the `context` primitive.

Client configuration accepts the `onContext` field, which expects a function of no arguments that returns any serializable type. Above, we passed a function that returns nothing. Here is how you can construct a client to send some context information to the server:

```ts
const client = new AliasClient<channels>({
  url: "ws://localhost:443",
  onContext: () => "USER_TOKEN_GOES_HERE",
  WebSocket,
});
```

Recall that we've constructed the Alias server like this:

```ts
export type Context = void;
export const channel = _channel<Context>();
export const rpc = _rpc<Context>();

const server = new AliasServer<Context, channels>({
  channels,
  port: 443,
  onContext: () => {},
});
```

For every request, the server-side `onContext` function gets called with the context information sent from the client as the only argument, and is expected to transform it into a value of type `Context`. We've constructed the server with `Context` set to `void`, but we might want to, e.g. convert the user token sent from the client into a full-fledged user object.

To do that you'd construct the server like this:

```ts
export type Context = SomeUserObjectType;

const server = new AliasServer<Context, channels>({
  channels,
  port: 443,
  onContext: (userToken: unknown) => {
    const user: SomeUserObjectType = lookupUser(userToken);
    return user;
  },
});
```

