// PostgREST caps a single response at 1000 rows by default, silently. Any query
// that feeds a total, average, or unique-count must page past that cap or it
// will quietly undercount once the table grows — a bug that hides for months
// and then misstates grant/donor numbers.
//
// Pass a builder that applies `.range(from, to)` to your query; this loops until
// a short page comes back, then returns every row. Example:
//
//   const regs = await fetchAllRows((from, to) =>
//     supabase.from("youth_registrations").select("id, child_sex").range(from, to)
//   );
//
// The builder is called once per page, so filters/selects stay in the caller.

const PAGE_SIZE = 1000;

export async function fetchAllRows<T = any>(
  build: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: unknown }>
): Promise<T[]> {
  const all: any[] = [];
  let from = 0;
  // Hard stop well above any realistic row count, so a misbehaving query can
  // never spin forever.
  for (let page = 0; page < 1000; page++) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all as T[];
}
