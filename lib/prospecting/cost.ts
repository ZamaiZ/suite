import {
  findDataForSeoPrice,
  type DataForSeoPriceEntry,
} from "@/lib/dataforseo/usage"

export type BusinessListingsRate = {
  fn: string
  perRequest: number
  perResult: number
}

export function businessListingsRate(
  prices: readonly DataForSeoPriceEntry[],
): BusinessListingsRate | null {
  const price = findDataForSeoPrice(
    prices,
    "business_data",
    "business_listings/search/live",
  )
  if (
    !price ||
    price.perRequest === null ||
    price.perResult === null ||
    !Number.isFinite(price.perRequest) ||
    !Number.isFinite(price.perResult) ||
    price.perRequest < 0 ||
    price.perResult < 0
  ) {
    return null
  }
  return {
    fn: price.fn,
    perRequest: price.perRequest,
    perResult: price.perResult,
  }
}

export function estimateBusinessListingsPageCost(
  rate: BusinessListingsRate,
  itemLimit: number,
): number {
  if (!Number.isInteger(itemLimit) || itemLimit < 0 || itemLimit > 1000) {
    throw new RangeError("O limite da página deve estar entre 0 e 1.000.")
  }
  return rate.perRequest + rate.perResult * itemLimit
}
