import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export default async function ShopStagePage({ params }: Props) {
  const { id } = await params;
  redirect(`/jobs/${id}`);
}
