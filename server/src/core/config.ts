import { ServerBaseSpec, ServerSpec } from 'ts-alias-protocol';

export interface Config<Context, SpecT extends ServerBaseSpec> {
  channels: ServerSpec<Context, SpecT>,
  onContext: ContextFn<Context>,
  port?: number,
}

// Context
export type ContextFn<Context>
  = (metadata: unknown) => Promise<Context> | Context;

