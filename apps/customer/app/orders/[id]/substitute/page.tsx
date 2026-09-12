import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export default async function SubstituteStagePage({ params }: Props) {
  const { id } = await params;
  redirect(`/orders/${id}`);
}
