type Props = { params: Promise<{ id: string }> };

export default async function ShopStagePage({ params }: Props) {
  const { id } = await params;
  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold">Shop</h1>
      <p className="mt-2 text-sm text-zinc-600">Job {id} — stage placeholder.</p>
    </div>
  );
}
