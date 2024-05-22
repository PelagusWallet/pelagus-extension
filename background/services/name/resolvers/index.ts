import addressBookResolverFor from "./address-book"

const resolvers = {
  addressBookResolverFor,
}

type ResolverConstructors = ReturnType<typeof resolvers[keyof typeof resolvers]>

export type NameResolverSystem = ResolverConstructors["type"]

export { addressBookResolverFor }
