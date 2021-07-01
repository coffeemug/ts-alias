
// Typescript doesn't treat `T | undefined` properties as optional
export type OnlyRequired<T> = Pick<T, NonUndefinedPropertyNames<T>> & Partial<Pick<T, UndefinedPropertyNames<T>>>

type NonUndefinedPropertyNames<T> = {
  [K in keyof T]: undefined extends T[K] ? never : K
}[keyof T];

type UndefinedPropertyNames<T> = {
  [K in keyof T]: undefined extends T[K] ? K : never
}[keyof T];

type t = {
  i?: number,
  j: number | undefined,
  k: number
}

