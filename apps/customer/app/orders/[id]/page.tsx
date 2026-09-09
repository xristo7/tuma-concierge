type Props = { params: Promise<{ id: string }> };

export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params;
  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold">Order {id}</h1>
      <p className="mt-2 text-sm text-zinc-600">Placeholder order summary.</p>
    </div>
  );
}
