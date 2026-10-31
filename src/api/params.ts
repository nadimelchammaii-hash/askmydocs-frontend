/** Drops undefined and empty-string params, so the URL only carries real filters. */
export function withoutEmpty (params: object): Record<string, string | number> {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== ''),
  ) as Record<string, string | number>
}
