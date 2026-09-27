# Extensions

Drop Pi extensions here (`name.ts`, or `name/index.ts`). They load automatically on start and after `/new`.
Use an extension when a skill (instructions + CLI) isn't enough: custom tools, event hooks, or model providers.

Minimal custom tool, `pi/extensions/hello.ts`:

```ts
import { Type } from "@earendil-works/pi-ai";
import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerTool(
    defineTool({
      name: "hello",
      label: "Hello",
      description: "Greet someone",
      parameters: Type.Object({ name: Type.String() }),
      async execute(_id, { name }) {
        return { content: [{ type: "text", text: `Hello, ${name}!` }], details: {} };
      },
    }),
  );
}
```

Full docs: `node_modules/@earendil-works/pi-coding-agent/docs/extensions.md`
