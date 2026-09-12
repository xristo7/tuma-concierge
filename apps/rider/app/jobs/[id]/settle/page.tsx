import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export default async function SettleStagePage({ params }: Props) {
  const { id } = await params;
  redirect(`/jobs/${id}`);
}
