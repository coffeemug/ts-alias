
// Typescript doesn't treat `T | undefined` properties as optional
export type OnlyRequired<T> =
  T extends Record<any, any> ?
    (Pick<T, NonUndefinedPropertyNames<T>>
      & Partial<Pick<T, UndefinedPropertyNames<T>>>) : T;

type NonUndefinedPropertyNames<T> = {
  [K in keyof T]: undefined extends T[K] ? never : K
}[keyof T];

type UndefinedPropertyNames<T> = {
  [K in keyof T]: undefined extends T[K] ? K : never
}[keyof T];

// Autocompletion for complex types can suck. These utilities are
// hacks that tend to make it much better.
export type Expand<T> =
  T extends (unknown | any) ? T :
    (T extends infer O ? { [K in keyof O]: O[K] } : never);
