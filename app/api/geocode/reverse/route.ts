import { NextResponse } from "next/server";

function formatAddress(address: Record<string, string | undefined>) {
  const parts = [address.road, address.suburb ?? address.neighbourhood, address.city ?? address.town, address.state]
    .filter((part): part is string => Boolean(part))
    .slice(0, 4);

  return parts.join(", ");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const latitude = Number(searchParams.get("lat"));
  const longitude = Number(searchParams.get("lng"));

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return NextResponse.json({ error: "Latitud y longitud inválidas." }, { status: 400 });
  }

  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
    {
      headers: {
        "User-Agent": "easy-parking/0.1 (+https://example.com)",
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    return NextResponse.json({ displayName: null, address: null }, { status: 200 });
  }

  const data = (await response.json()) as {
    display_name?: string;
    address?: Record<string, string | undefined>;
  };

  return NextResponse.json({
    displayName: data.display_name ?? null,
    address: data.address ? formatAddress(data.address) : null,
    road: data.address?.road ?? null,
    neighbourhood: data.address?.neighbourhood ?? data.address?.suburb ?? null,
    city: data.address?.city ?? data.address?.town ?? data.address?.municipality ?? null,
  });
}
