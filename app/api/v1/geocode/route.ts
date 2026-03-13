import { NextRequest, NextResponse } from 'next/server';

// PDOK Locatieserver - reverse geocoding
export async function GET(request: NextRequest) {
  const lat = request.nextUrl.searchParams.get('lat');
  const lon = request.nextUrl.searchParams.get('lon');

  if (!lat || !lon) {
    return NextResponse.json({ error: 'lat and lon required' }, { status: 400 });
  }

  try {
    const url = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/reverse?lat=${lat}&lon=${lon}&type=adres&rows=1&distance=100`;
    const res = await fetch(url);
    if (!res.ok) return NextResponse.json({ error: `PDOK error: ${res.status}` }, { status: 502 });
    const data = await res.json();
    const doc = data.response?.docs?.[0];
    if (!doc) return NextResponse.json({ straat: null });

    return NextResponse.json({
      straat: doc.straatnaam || null,
      huisnummer: doc.huisnummer || null,
      postcode: doc.postcode || null,
      woonplaats: doc.woonplaatsnaam || null,
      weergavenaam: doc.weergavenaam || null,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown' }, { status: 500 });
  }
}
