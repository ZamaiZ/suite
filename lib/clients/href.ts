export function isClientId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
}

export function clientsListHref(input: { client?: string } = {}): string {
  const params = new URLSearchParams()
  if (input.client && isClientId(input.client)) {
    params.set("client", input.client)
  }
  const query = params.toString()
  return query.length > 0 ? `/clients?${query}` : "/clients"
}
