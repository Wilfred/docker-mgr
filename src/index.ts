import express, { Request, Response } from "express";
import Docker from "dockerode";

const app = express();
const port = Number(process.env.PORT) || 3000;

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

function formatAge(createdUnix: number): string {
  const seconds = Math.max(0, Math.floor(Date.now() / 1000 - createdUnix));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

interface ContainerSummary {
  name: string;
  age: string;
  status: string;
}

app.get("/containers", async (_req: Request, res: Response) => {
  try {
    const containers = await docker.listContainers();
    const result: ContainerSummary[] = containers.map((c) => ({
      name: c.Names[0]?.replace(/^\//, "") ?? c.Id.slice(0, 12),
      age: formatAge(c.Created),
      status: c.Status,
    }));
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Failed to list containers", details: message });
  }
});

app.get("/", async (_req: Request, res: Response) => {
  try {
    const containers = await docker.listContainers();
    const rows = containers
      .map((c) => {
        const name = c.Names[0]?.replace(/^\//, "") ?? c.Id.slice(0, 12);
        return `<tr><td>${escapeHtml(name)}</td><td>${escapeHtml(
          formatAge(c.Created)
        )}</td><td>${escapeHtml(c.Status)}</td></tr>`;
      })
      .join("");

    res.send(`<!DOCTYPE html>
<html>
  <head>
    <title>Docker Containers</title>
    <style>
      body { font-family: sans-serif; margin: 2rem; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #ddd; padding: 0.5rem 0.75rem; text-align: left; }
      th { background: #f4f4f4; }
    </style>
  </head>
  <body>
    <h1>Running Docker Containers</h1>
    <table>
      <thead><tr><th>Name</th><th>Age</th><th>Status</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="3">No running containers</td></tr>'}</tbody>
    </table>
  </body>
</html>`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).send(`Failed to list containers: ${escapeHtml(message)}`);
  }
});

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

app.listen(port, () => {
  console.log(`docker-mgr listening on port ${port}`);
});
