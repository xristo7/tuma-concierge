import { redirect } from "next/navigation";

/** This standalone list-building form is retired — every "new list" entry
 * point (home, the Orders tab, the empty chat state) now opens the same
 * ShoppingListModal instead, so there's exactly one UI for creating an
 * order. This stays only so an old link/bookmark still lands somewhere. */
export default function NewOrderPage() {
  redirect("/");
}
