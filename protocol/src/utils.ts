
// Typescript doesn't treat `T | undefined` properties as optional
export type OnlyRequired<T> = Pick<T, NonUndefinedPropertyNames<T>> & Partial<Pick<T, UndefinedPropertyNames<T>>>

type NonUndefinedPropertyNames<T> = {
  [K in keyof T]: undefined extends T[K] ? never : K
}[keyof T];

type UndefinedPropertyNames<T> = {
  [K in keyof T]: undefined extends T[K] ? K : never
}[keyof T];

// Autocompletion for complex types can suck. These utilities are
// hacks that tend to make it much better.
export type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;
export type DeepExpand<T> = T extends object
  ? T extends infer O ? { [K in keyof O]: DeepExpand<O[K]> } : never
  : T;
