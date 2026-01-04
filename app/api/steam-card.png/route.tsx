import { ImageResponse } from "next/og";

export const runtime = "edge";

type PlayerSummary = {
  steamid: string;
  personaname: string;
  avatarfull: string;
  personastate: number;
  gameextrainfo?: string;
};

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
  // Edge環境で使える
  // eslint-disable-next-line no-undef
  return btoa(binary);
}

export async function GET() {
  const steamid = "76561198835243757";
  const key = process.env.STEAM_WEB_API_KEY;
  if (!key) {
    return new Response("Missing STEAM_WEB_API_KEY", { status: 500 });
  }

  const sumRes = await fetch(
    `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${key}&steamids=${steamid}`,
    { headers: { "user-agent": "steam-card" } }
  );
  const sumJson = await sumRes.json();
  const p: PlayerSummary | undefined = sumJson?.response?.players?.[0];
  if (!p) return new Response("Steam profile not found", { status: 404 });

  // avatar を data URI にして埋め込み（外部参照を避ける）
  let avatarDataUri = "";
  try {
    const imgRes = await fetch(p.avatarfull, { headers: { "user-agent": "steam-card" } });
    const ct = imgRes.headers.get("content-type") || "image/jpeg";
    const buf = new Uint8Array(await imgRes.arrayBuffer());
    avatarDataUri = `data:${ct};base64,${toBase64(buf)}`;
  } catch {
    avatarDataUri = "";
  }

  const name = p.personaname || "Steam User";
  const status = p.gameextrainfo ? `In-Game: ${p.gameextrainfo}` : stateLabel(p.personastate);
  const dot = stateColor(p.personastate);

  return new ImageResponse(
    (
      <div
        style={{
          width: "520px",
          height: "120px",
          display: "flex",
          alignItems: "center",
          background: "#0b1a2b",
          borderRadius: "14px",
          padding: "16px",
          boxSizing: "border-box",
          color: "#e7f0ff",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto",
        }}
      >
        <div
          style={{
            width: 88,
            height: 88,
            borderRadius: 10,
            overflow: "hidden",
            background: "#1a3655",
            flexShrink: 0,
          }}
        >
          {avatarDataUri ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarDataUri} width={88} height={88} alt="" />
          ) : null}
        </div>

        <div style={{ marginLeft: 16, display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.1 }}>{name}</div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 10, height: 10, borderRadius: 999, background: dot }} />
            <div style={{ fontSize: 16, color: "#c9d6e8" }}>{status}</div>
          </div>

          <div style={{ fontSize: 12, color: "#7ea2c8" }}>STEAM</div>
        </div>
      </div>
    ),
    {
      width: 520,
      height: 120,
      headers: {
        // GitHubはPNGが一番安定
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=900",
      },
    }
  );
}
