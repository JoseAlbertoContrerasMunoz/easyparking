import { redirect } from "next/navigation";
import { EasyParkingApp } from "@/components/easy-parking-app";
import { toParkingLot, type ParkingLotRow, type UserReputation } from "@/lib/parking";
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
      "id, owner_id, name, address, latitude, longitude, size, current_status, last_report_at, last_report_type, zone_name, price_per_hour, hours_text, is_covered, has_cameras, has_guard, is_24_hours, security_score, rating, walking_landmark, walking_minutes, peak_hours_text, best_time_text, estimated_wait_minutes, reports_count, created_at, updated_at",
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("points, reports_count, reputation_label")
    .eq("id", user.id)
    .maybeSingle();

  const reputation: UserReputation = {
    points: Number(profile?.points ?? 0),
    reportsCount: Number(profile?.reports_count ?? 0),
    reputationLabel: String(profile?.reputation_label ?? "Nuevo colaborador"),
  };

  return (
    <EasyParkingApp
      currentUserId={user.id}
      currentUserEmail={user.email ?? ""}
      currentUserReputation={reputation}
      initialParkingLots={(data ?? []).map((row) => toParkingLot(row as ParkingLotRow))}
    />
  );
}
