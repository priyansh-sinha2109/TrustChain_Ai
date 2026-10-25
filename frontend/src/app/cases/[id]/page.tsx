import { redirect } from "next/navigation";

export default async function CaseIndexPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Default to findings if reviewed or standard case, or documents
  redirect(`/cases/${id}/findings`);
}
