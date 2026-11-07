// npm run stack:stop — dừng mọi tiến trình của stack (dữ liệu Postgres được giữ).
import { stopPostgres } from "./postgres";
import { stopProcess } from "./procs";

async function main() {
  for (const name of ["gateway", "rest", "auth"]) await stopProcess(name);
  await stopPostgres();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
