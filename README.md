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
assert(m == 5);
```

Everything is typechecked. When you type `await client.call("sq...` on the client, you get autocompletion with all available rpc calls, and the client knows the expected argument type and the return type. Attempting to make a non-existing rpc call, passing an argument of the wrong type, or expecting the wrong return type will not type check.

This makes programming client-server communication on typescript feel as easy and solid as a functional call. It's a delightful way to program.

# Installation and setup details

I deliberately avoided setup details in the `TLDR` section to give you a sense of how easy it is to program with `ts-alias` once you're set up. Let's look at these details here.

## Server

First, install the `ts-alias-server` library in your backend project:

```sh
npm i ts-alias-server io-ts
```

Then, add the following snippet to your utilities file somewhere in your project. (Typescript doesn't yet support partial type argument inference, and I haven't figured out how to avoid this step without this feature. Fortunately, you do this once per project and forget about it.)

```ts
import { _rpc } from 'ts-alias-server';

export type Context = void;
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
import { Server } from 'ts-alias-server';

const channels = { square, div };
export type channels = typeof channels;

const server = new Server<Context, channels>({
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
import { RpcClient } from 'ts-alias-client';
import type { channels } from './server.ts';

const client = new RpcClient<channels>({
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

# Context

# FAQ

