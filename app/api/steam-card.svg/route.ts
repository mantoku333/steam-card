import { NextRequest } from "next/server";

export const runtime = "edge";

type PlayerSummary = {
  steamid: string;
  personaname: string;
  avatarfull: string;
  personastate: number;
  gameextrainfo?: string;
};

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as any)[c]
  );
}

function stateLabel(ps: number) {
  switch (ps) {
    case 1: return "Online";
    case 2: return "Busy";
    case 3: return "Away";
    case 4: return "Snooze";
    default: return "Offline";
  }
}

function stateColor(ps: number) {
  return ps === 1 ? "#57cbde" : "#8f98a0";
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function GET(_req: NextRequest) {
  const steamid = "76561198835243757";
  const key = process.env.STEAM_WEB_API_KEY;
  if (!key) return new Response("Missing STEAM_WEB_API_KEY", { status: 500 });

  const sumRes = await fetch(
    `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${key}&steamids=${steamid}`,
    { headers: { "user-agent": "steam-card" } }
  );
  const sumJson = await sumRes.json();
  const p: PlayerSummary | undefined = sumJson?.response?.players?.[0];
  if (!p) return new Response("Steam profile not found", { status: 404 });

  // avatar を data URI に埋め込み（GitHubで壊れにくい）
  let avatarDataUri = "";
  try {
    const imgRes = await fetch(p.avatarfull, { headers: { "user-agent": "steam-card" } });
    const ct = imgRes.headers.get("content-type") || "image/jpeg";
    const buf = new Uint8Array(await imgRes.arrayBuffer());
    avatarDataUri = `data:${ct};base64,${toBase64(buf)}`;
  } catch {
    avatarDataUri = "";
  }

  const name = esc(p.personaname || "Steam User");
  const status = esc(p.gameextrainfo ?? stateLabel(p.personastate));
  const dot = stateColor(p.personastate);

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="520" height="120" viewBox="0 0 520 120" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="av">
      <rect x="16" y="16" width="88" height="88" rx="10" ry="10"/>
    </clipPath>
  </defs>

  <rect x="0" y="0" width="520" height="120" rx="14" fill="#0b1a2b"/>

  ${avatarDataUri
    ? `<image href="${avatarDataUri}" x="16" y="16" width="88" height="88" clip-path="url(#av)"/>`
    : `<rect x="16" y="16" width="88" height="88" rx="10" fill="#1a3655"/>`
  }

  <text x="120" y="46" fill="#e7f0ff" font-size="18" font-weight="700"
        font-family="system-ui,-apple-system,Segoe UI,Roboto">
    ${name}
  </text>

  <circle cx="128" cy="66" r="5" fill="${dot}"/>
  <text x="140" y="70" fill="#c9d6e8" font-size="13"
        font-family="system-ui,-apple-system,Segoe UI,Roboto">
    ${status}
  </text>

  <text x="500" y="24" fill="#7ea2c8" font-size="11" text-anchor="end"
        font-family="system-ui,-apple-system,Segoe UI,Roboto">
    STEAM
  </text>
</svg>`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=900",
    },
  });
}
