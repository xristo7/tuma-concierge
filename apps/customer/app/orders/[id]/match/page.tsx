import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export default async function MatchStagePage({ params }: Props) {
  const { id } = await params;
  redirect(`/orders/${id}/pay`);
}
