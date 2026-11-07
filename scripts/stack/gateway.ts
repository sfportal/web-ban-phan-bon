// Cổng HTTP nhỏ thay cho Kong: /rest/v1/* → PostgREST, /auth/v1/* → GoTrue.
import http from "node:http";
import { HOST, PORTS } from "./config";

const ROUTES: Array<[prefix: string, port: number]> = [
  ["/rest/v1", PORTS.rest],
  ["/auth/v1", PORTS.auth],
];

const server = http.createServer((req, res) => {
  const url = req.url ?? "/";
  const route = ROUTES.find(
    ([prefix]) => url === prefix || url.startsWith(`${prefix}/`) || url.startsWith(`${prefix}?`),
  );
  if (!route) {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ message: "no route" }));
    return;
  }
  const [prefix, port] = route;
  const rest = url.slice(prefix.length);
  const path = rest.startsWith("/") ? rest : `/${rest}`;
  const headers: http.OutgoingHttpHeaders = { ...req.headers, host: `${HOST}:${port}` };
  // Như Kong của Supabase: chỉ có apikey thì dùng nó làm Bearer token.
  const apikey = req.headers.apikey;
  if (!headers.authorization && typeof apikey === "string") {
    headers.authorization = `Bearer ${apikey}`;
  }
  const upstream = http.request(
    { host: HOST, port, method: req.method, path, headers },
    (upRes) => {
      res.writeHead(upRes.statusCode ?? 502, upRes.headers);
      upRes.pipe(res);
    },
  );
  upstream.on("error", (err) => {
    if (!res.headersSent) res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ message: `upstream error: ${err.message}` }));
  });
  req.pipe(upstream);
});

server.listen(PORTS.gateway, HOST, () => {
  console.log(`gateway listening on http://${HOST}:${PORTS.gateway}`);
});

const shutdown = () => server.close(() => process.exit(0));
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
