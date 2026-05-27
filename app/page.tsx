import { redirect } from "next/navigation";
import { EasyParkingApp } from "@/components/easy-parking-app";
import { toParkingLot, type ParkingLotRow } from "@/lib/parking";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .from("parking_lots")
    .select(
      "id, owner_id, name, address, latitude, longitude, size, current_status, last_report_at, created_at, updated_at",
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (
    <EasyParkingApp
      currentUserId={user.id}
      currentUserEmail={user.email ?? ""}
      initialParkingLots={(data ?? []).map((row) => toParkingLot(row as ParkingLotRow))}
    />
  );
}
