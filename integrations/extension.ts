import { Type } from 'typebox';

const tools = [
 {name: 'apps_tools',label: 'Connected app tools',description: 'List the available read-only tools for a connected GitHub or Vercel account. Call this before apps_execute to obtain exact tool slugs and input schemas. If the app is not connected, ask the user to connect it in Connect Apps.',route:'tools',parameters:Type.Object({app:Type.Union([Type.Literal('github'),Type.Literal('vercel')])})},
 {name:'apps_execute',label:'Read connected app',description:'Execute a read-only GitHub or Vercel tool returned by apps_tools. Use its exact slug and input parameters. These tools cannot modify repositories, deployments, or other resources.',route:'run',parameters:Type.Object({slug:Type.String({minLength:1}),arguments:Type.Record(Type.String(),Type.Unknown())})},
];

export default function (pi: any) {
  for (const tool of tools) {
    const { route, ...definition } = tool;
    pi.registerTool({
      ...definition,
      async execute(_toolCallId: string, params: any, signal: AbortSignal) {
        const response = await fetch(`${process.env.MORILO_APPS_URL}/${route}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.MORILO_APPS_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(params),
          signal,
        });
        const text = await response.text();
        const result = response.headers.get('content-type')?.includes('application/json') ? JSON.parse(text) : null;
        if (!response.ok) throw new Error(typeof result?.error === 'string' ? result.error : `Connected app request failed (HTTP ${response.status})`);
        return {
          content: [{ type: 'text', text }],
          details: {},
          ...(route === 'run' && result?.successful === false ? { isError: true } : {}),
        };
      },
    });
  }
}
