"use client";

import { useState } from "react";
import { FoodCard } from "./FoodCard";
import { ParcelCard } from "./ParcelCard";
import { ParcelModal } from "./ParcelModal";
import { RideCard } from "./RideCard";
import { RideModal } from "./RideModal";
import { ShoppingListCard } from "./ShoppingListCard";
import { ShoppingListModal } from "./ShoppingListModal";

export function OrderTypeCards() {
  const [open, setOpen] = useState<"shopping" | "parcel" | "ride" | null>(null);

  return (
    <>
      <div className="flex flex-col gap-3">
        <RideCard onClick={() => setOpen("ride")} />
        <FoodCard />
        <ShoppingListCard onClick={() => setOpen("shopping")} />
        <ParcelCard onClick={() => setOpen("parcel")} />
      </div>
      {open === "shopping" && <ShoppingListModal onClose={() => setOpen(null)} />}
      {open === "parcel" && <ParcelModal onClose={() => setOpen(null)} />}
      {open === "ride" && <RideModal onClose={() => setOpen(null)} />}
    </>
  );
}
