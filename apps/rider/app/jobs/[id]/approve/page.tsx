import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export default async function ApproveStagePage({ params }: Props) {
  const { id } = await params;
  redirect(`/jobs/${id}`);
}
