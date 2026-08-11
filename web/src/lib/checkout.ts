export async function startCheckout(
  quoteIds: number[],
): Promise<string | null> {
  const res = await fetch("/api/create-checkout-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quoteIds }),
  });

  if (!res.ok) return null;

  const data = (await res.json()) as { url?: string };
  return data.url ?? null;
}
