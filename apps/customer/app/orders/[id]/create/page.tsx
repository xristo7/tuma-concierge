import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export default async function CreateStagePage({ params }: Props) {
  const { id } = await params;
  redirect(`/orders/${id}`);
}
