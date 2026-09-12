import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export default async function HandoverStagePage({ params }: Props) {
  const { id } = await params;
  redirect(`/orders/${id}`);
}
