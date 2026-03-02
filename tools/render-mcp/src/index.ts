#!/usr/bin/env node
/**
 * Render MCP Server
 *
 * Wraps the Render REST API (https://api.render.com/v1) and exposes four tools
 * to Claude Code via the Model Context Protocol stdio transport.
 *
 * Required env: RENDER_API_KEY
 *
 * Tools:
 *   list_services    — GET  /services
 *   get_service      — GET  /services/{serviceId}
 *   trigger_deploy   — POST /services/{serviceId}/deploys
 *   get_deploy_logs  — GET  /services/{serviceId}/deploys  (recent N entries)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Render API client
// ---------------------------------------------------------------------------

const RENDER_API_BASE = "https://api.render.com/v1";

function getApiKey(): string {
  const key = process.env["RENDER_API_KEY"];
  if (!key) {
    // Write to stderr so it surfaces in Claude Code's MCP logs without
    // polluting the MCP stdio framing on stdout.
    process.stderr.write(
      "[render-mcp] FATAL: RENDER_API_KEY environment variable is not set.\n"
    );
    process.exit(1);
  }
  return key;
}

async function renderFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${RENDER_API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "(no body)");
    throw new Error(
      `Render API error ${res.status} ${res.statusText} — ${url}\n${body}`
    );
  }

  // 204 No Content has no body.
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Render API response types (subset — only the fields we surface to Claude)
// ---------------------------------------------------------------------------

interface ServiceOwner {
  id: string;
  name: string;
  email?: string;
  type: "user" | "team";
}

interface ServiceSuspended {
  suspenders?: string[];
}

interface RenderService {
  id: string;
  name: string;
  type: string; // web_service | private_service | background_worker | static_site | cron_job
  repo: string;
  branch: string;
  autoDeploy: string; // "yes" | "no"
  serviceDetails: {
    url?: string;
    region?: string;
    env?: string; // docker | node | python | ruby | go | rust | elixir | image
    plan?: string;
    numInstances?: number;
    runtime?: string;
    buildCommand?: string;
    startCommand?: string;
  };
  suspended: string; // "suspended" | "not_suspended"
  suspenders?: string[];
  createdAt: string;
  updatedAt: string;
  notifyOnFail?: string;
  owner: ServiceOwner;
  rootDir?: string;
  imagePath?: string;
  environmentId?: string;
  slug?: string;
  dashboardUrl?: string;
}

interface ListServicesItem {
  cursor: string;
  service: RenderService;
}

interface RenderDeploy {
  id: string;
  service: { id: string };
  status: string; // created | build_in_progress | update_in_progress | live | deactivated | build_failed | update_failed | canceled | pre_deploy_in_progress | pre_deploy_failed
  trigger: string; // api | deploy_hook | ... etc
  finishedAt?: string;
  createdAt: string;
  updatedAt: string;
  commit?: {
    id: string;
    message: string;
    createdAt: string;
  };
}

interface ListDeploysItem {
  cursor: string;
  deploy: RenderDeploy;
}

// ---------------------------------------------------------------------------
// Helper — pretty-print a service for LLM consumption
// ---------------------------------------------------------------------------

function formatService(s: RenderService): string {
  const lines: string[] = [
    `ID:           ${s.id}`,
    `Name:         ${s.name}`,
    `Type:         ${s.type}`,
    `Repo:         ${s.repo} (branch: ${s.branch})`,
    `Auto-deploy:  ${s.autoDeploy}`,
    `Suspended:    ${s.suspended}`,
    `Created:      ${s.createdAt}`,
    `Updated:      ${s.updatedAt}`,
  ];

  if (s.serviceDetails.url) {
    lines.push(`URL:          ${s.serviceDetails.url}`);
  }
  if (s.serviceDetails.region) {
    lines.push(`Region:       ${s.serviceDetails.region}`);
  }
  if (s.serviceDetails.plan) {
    lines.push(`Plan:         ${s.serviceDetails.plan}`);
  }
  if (s.serviceDetails.numInstances !== undefined) {
    lines.push(`Instances:    ${s.serviceDetails.numInstances}`);
  }
  if (s.serviceDetails.env) {
    lines.push(`Runtime:      ${s.serviceDetails.env}`);
  }
  if (s.serviceDetails.buildCommand) {
    lines.push(`Build cmd:    ${s.serviceDetails.buildCommand}`);
  }
  if (s.serviceDetails.startCommand) {
    lines.push(`Start cmd:    ${s.serviceDetails.startCommand}`);
  }
  if (s.owner) {
    lines.push(`Owner:        ${s.owner.name} (${s.owner.type})`);
  }

  return lines.join("\n");
}

function formatDeploy(d: RenderDeploy): string {
  const lines: string[] = [
    `Deploy ID:  ${d.id}`,
    `Status:     ${d.status}`,
    `Trigger:    ${d.trigger}`,
    `Created:    ${d.createdAt}`,
    `Updated:    ${d.updatedAt}`,
  ];
  if (d.finishedAt) {
    lines.push(`Finished:   ${d.finishedAt}`);
  }
  if (d.commit) {
    lines.push(`Commit:     ${d.commit.id.slice(0, 8)} — ${d.commit.message}`);
    lines.push(`Commit at:  ${d.commit.createdAt}`);
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// MCP Server setup
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "render",
  version: "1.0.0",
});

// ---------------------------------------------------------------------------
// Tool: list_services
// ---------------------------------------------------------------------------

server.tool(
  "list_services",
  [
    "List all Render services in your account.",
    "Returns id, name, type (web_service | static_site | cron_job | etc.),",
    "repo, branch, auto-deploy status, URL, region, plan, and owner for each service.",
    "Use the returned service IDs with get_service, trigger_deploy, or get_deploy_logs.",
  ].join(" "),
  {
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(20)
      .describe("Number of services to return (1–100, default 20)"),
    cursor: z
      .string()
      .optional()
      .describe("Pagination cursor from a previous list_services call"),
    name: z
      .string()
      .optional()
      .describe("Filter services whose name contains this string"),
    type: z
      .enum([
        "web_service",
        "private_service",
        "background_worker",
        "static_site",
        "cron_job",
      ])
      .optional()
      .describe("Filter by service type"),
  },
  async ({ limit, cursor, name, type }) => {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    if (cursor) params.set("cursor", cursor);
    if (name) params.set("name", name);
    if (type) params.set("type", type);

    const items = await renderFetch<ListServicesItem[]>(
      `/services?${params.toString()}`
    );

    if (!items || items.length === 0) {
      return {
        content: [{ type: "text", text: "No services found." }],
      };
    }

    const sections = items.map((item, i) => {
      return `--- Service ${i + 1} ---\n${formatService(item.service)}`;
    });

    const nextCursor = items[items.length - 1]?.cursor;
    const footer =
      items.length === limit
        ? `\n\nShowing ${items.length} services. Pass cursor="${nextCursor}" to get the next page.`
        : `\n\nTotal shown: ${items.length} service(s).`;

    return {
      content: [
        {
          type: "text",
          text: sections.join("\n\n") + footer,
        },
      ],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: get_service
// ---------------------------------------------------------------------------

server.tool(
  "get_service",
  [
    "Retrieve full details for a single Render service by its service ID.",
    "Returns id, name, type, repo, branch, auto-deploy, URL, region, plan,",
    "instances, runtime environment, build/start commands, owner, and timestamps.",
    "Service IDs look like 'srv-xxxxxxxxxxxxxxxxxx'.",
  ].join(" "),
  {
    serviceId: z
      .string()
      .min(1)
      .describe(
        "The Render service ID (e.g. srv-xxxxxxxxxxxxxxxxxx). Obtain from list_services."
      ),
  },
  async ({ serviceId }) => {
    const service = await renderFetch<RenderService>(
      `/services/${encodeURIComponent(serviceId)}`
    );

    return {
      content: [{ type: "text", text: formatService(service) }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: trigger_deploy
// ---------------------------------------------------------------------------

server.tool(
  "trigger_deploy",
  [
    "Trigger a new deployment for a Render service.",
    "Optionally clear the build cache before deploying.",
    "Returns the new deploy ID and its initial status.",
    "Use get_deploy_logs to monitor progress after triggering.",
  ].join(" "),
  {
    serviceId: z
      .string()
      .min(1)
      .describe(
        "The Render service ID to deploy (e.g. srv-xxxxxxxxxxxxxxxxxx). Obtain from list_services."
      ),
    clearCache: z
      .enum(["clear", "do_not_clear"])
      .default("do_not_clear")
      .describe(
        "Whether to clear the build cache. Use 'clear' to force a clean build. Defaults to 'do_not_clear'."
      ),
  },
  async ({ serviceId, clearCache }) => {
    const body: Record<string, string> = { clearCache };

    const deploy = await renderFetch<RenderDeploy>(
      `/services/${encodeURIComponent(serviceId)}/deploys`,
      {
        method: "POST",
        body: JSON.stringify(body),
      }
    );

    return {
      content: [
        {
          type: "text",
          text: [
            "Deploy triggered successfully.",
            "",
            formatDeploy(deploy),
            "",
            `Monitor with: get_deploy_logs(serviceId="${serviceId}")`,
          ].join("\n"),
        },
      ],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: get_deploy_logs
// ---------------------------------------------------------------------------

server.tool(
  "get_deploy_logs",
  [
    "List recent deployments for a Render service, ordered newest first.",
    "Each entry shows deploy ID, status, trigger source, timestamps, and the",
    "git commit (ID + message) that was deployed.",
    "Status values: created | build_in_progress | update_in_progress | live |",
    "deactivated | build_failed | update_failed | canceled | pre_deploy_in_progress | pre_deploy_failed.",
    "Use this to check whether a triggered deploy succeeded or failed.",
  ].join(" "),
  {
    serviceId: z
      .string()
      .min(1)
      .describe(
        "The Render service ID (e.g. srv-xxxxxxxxxxxxxxxxxx). Obtain from list_services."
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(10)
      .describe("Number of recent deploys to return (1–100, default 10)"),
    cursor: z
      .string()
      .optional()
      .describe("Pagination cursor from a previous get_deploy_logs call"),
  },
  async ({ serviceId, limit, cursor }) => {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    if (cursor) params.set("cursor", cursor);

    const items = await renderFetch<ListDeploysItem[]>(
      `/services/${encodeURIComponent(serviceId)}/deploys?${params.toString()}`
    );

    if (!items || items.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No deploys found for service ${serviceId}.`,
          },
        ],
      };
    }

    const sections = items.map((item, i) => {
      return `--- Deploy ${i + 1} ---\n${formatDeploy(item.deploy)}`;
    });

    const nextCursor = items[items.length - 1]?.cursor;
    const footer =
      items.length === limit
        ? `\n\nShowing ${items.length} deploys. Pass cursor="${nextCursor}" to see older deploys.`
        : `\n\nTotal shown: ${items.length} deploy(s).`;

    return {
      content: [
        {
          type: "text",
          text: sections.join("\n\n") + footer,
        },
      ],
    };
  }
);

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // Eagerly validate API key at startup so the error is immediate.
  getApiKey();

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // All diagnostic output goes to stderr — never stdout — to avoid breaking
  // the MCP binary framing on stdout.
  process.stderr.write("[render-mcp] Server started on stdio transport.\n");
}

main().catch((err: unknown) => {
  process.stderr.write(
    `[render-mcp] Fatal error: ${err instanceof Error ? err.message : String(err)}\n`
  );
  process.exit(1);
});
