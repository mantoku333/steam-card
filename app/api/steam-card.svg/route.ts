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
    case 5: return "Looking to Trade";
    case 6: return "Looking to Play";
    default: return "Offline";
  }
}

function stateColor(ps: number) {
  return ps === 1 ? "#57cbde" : "#8f98a0";
}

export async function GET(req: NextRequest) {
  const steamid = "76561198835243757";
  const key = process.env.STEAM_WEB_API_KEY;

  if (!key) {
    return new Response("Missing STEAM_WEB_API_KEY", { status: 500 });
  }

  const res = await fetch(
    `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${key}&steamids=${steamid}`
  );
  const json = await res.json();
  const p: PlayerSummary | undefined = json?.response?.players?.[0];

  if (!p) {
    return new Response("Steam profile not found", { status: 404 });
  }

  const name = esc(p.personaname);
  const status = esc(p.gameextrainfo ?? stateLabel(p.personastate));
  const color = stateColor(p.personastate);

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="520" height="120" viewBox="0 0 520 120" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="520" height="120" rx="14" fill="#0b1a2b"/>
  <image href="${p.avatarfull}" x="16" y="16" width="88" height="88" rx="10"/>
  <text x="120" y="46" fill="#e7f0ff" font-size="18" font-weight="700"
        font-family="system-ui, -apple-system, Segoe UI">
    ${name}
  </text>
  <circle cx="128" cy="66" r="5" fill="${color}"/>
  <text x="140" y="70" fill="#c9d6e8" font-size="13"
        font-family="system-ui, -apple-system, Segoe UI">
    ${status}
  </text>
  <text x="500" y="24" fill="#7ea2c8" font-size="11" text-anchor="end">
    STEAM
  </text>
</svg>`;

  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml",
      "cache-control": "public, max-age=900",
    },
  });
}
