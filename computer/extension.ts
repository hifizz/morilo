import { Type } from "typebox";

const tools = [
  {
    name: "computer_exec",
    label: "Remote command",
    description:
      "Run a shell command on the shared remote Linux computer, never on the host Mac. The default working directory is /data/home. Each command uses a fresh shell. timeoutSeconds is 1 to 600; long-running servers must redirect output and run in the background.",
    route: "exec",
    parameters: Type.Object({
      command: Type.String({ minLength: 1 }),
      cwd: Type.Optional(Type.String()),
      timeoutSeconds: Type.Optional(Type.Integer({ minimum: 1, maximum: 600 })),
    }),
  },
  {
    name: "computer_read",
    label: "Read remote file",
    description:
      "Read a UTF-8 text file on the shared remote computer. Relative paths are under /data/home. Use computer_exec to list directories.",
    route: "read",
    parameters: Type.Object({
      path: Type.String({ minLength: 1 }),
    }),
  },
  {
    name: "computer_write",
    label: "Write remote file",
    description:
      "Write a UTF-8 text file on the shared remote computer, creating parent directories. Relative paths are under /data/home. Replaces existing file contents.",
    route: "write",
    parameters: Type.Object({
      path: Type.String({ minLength: 1 }),
      content: Type.String(),
    }),
  },
  {
    name: "computer_desktop",
    label: "Remote desktop",
    description:
      "See and control the shared remote desktop. Take a screenshot before choosing click coordinates. Coordinates are pixels in the full screenshot. press uses X11 keys such as Return, Escape, ctrl+l and ctrl+c. To open a URL in the browser: press ctrl+l, type the URL, then press Return.",
    route: "desktop",
    parameters: Type.Object({
      action: Type.Union(["screenshot", "click", "type", "press", "scroll"].map((v) => Type.Literal(v))),
      x: Type.Optional(Type.Integer({ minimum: 0 })),
      y: Type.Optional(Type.Integer({ minimum: 0 })),
      text: Type.Optional(Type.String()),
      keys: Type.Optional(Type.String()),
      direction: Type.Optional(Type.Union(["up", "down", "left", "right"].map((v) => Type.Literal(v)))),
      amount: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
    }),
  },
];

function checkDesktop(params: any) {
  switch (params.action) {
    case "screenshot":
      return;
    case "click":
      if (typeof params.x !== "number" || typeof params.y !== "number")
        throw new Error("click needs x and y");
      return;
    case "type":
      if (typeof params.text !== "string") throw new Error("type needs text");
      return;
    case "press":
      if (!params.keys) throw new Error("press needs keys");
      return;
    case "scroll":
      if (!params.direction) throw new Error("scroll needs direction");
      return;
    default:
      throw new Error(`unknown desktop action ${params.action}`);
  }
}

export default function (pi: any) {
  for (const tool of tools) {
    const { route, ...definition } = tool;
    pi.registerTool({
      ...definition,
      async execute(_toolCallId: string, params: any, signal: AbortSignal) {
        if (route === "desktop") checkDesktop(params);
        const response = await fetch(`${process.env.GROKBOT_COMPUTER_URL}/${route}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.GROKBOT_COMPUTER_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(params),
          signal,
        });
        if (!response.ok) throw new Error(await response.text());
        if (response.headers.get("content-type")?.includes("image/png")) {
          return {
            content: [
              {
                type: "image",
                data: Buffer.from(await response.arrayBuffer()).toString("base64"),
                mimeType: "image/png",
              },
            ],
            details: {},
          };
        }
        const text = await response.text();
        if (route === "exec") {
          const result = JSON.parse(text);
          if (result.exitCode !== 0) {
            return { content: [{ type: "text", text }], details: {}, isError: true };
          }
        }
        return { content: [{ type: "text", text }], details: {} };
      },
    });
  }
}
