# Inizializzare e sviluppare un agent

1. Crea una repository da questo template o clonala. Installa **Node.js 24.12+**, poi esegui `npm install`.
2. Esegui `npm run init -- nome-progetto --display-name "Nome Agent"` una sola volta prima del rilascio.
3. Modifica `agent.config.json` per l'audience e il tenant GUID (`tenantId`). Default: `private`, nessun destinatario. Imposta `M365_AGENT_SCOPE=personal` in `env/.env.prod` per private senza destinatari, altrimenti `shared`.
4. Modifica `src/<nome-progetto>/appPackage/declarativeAgent.json`: istruzioni, capability, conversation starters. Il comportamento non viene implementato con un generico file README: è il manifest a definire l'agent.
5. Modifica `src/<nome-progetto>/appPackage/manifest.json`: `developer`, descrizioni e URL reali della tua organizzazione; sostituisci le icone esempio.
6. Esegui `npm run validate`. Per validazione schema completa prima del deploy usa la CLI WIQD approvata: `wiqd agent validate --path src/<nome-progetto> --env prod`.
7. Per il bootstrap iniziale, installa `@microsoft/wiqd@0.22.0`, effettua `wiqd auth login --interactive`, verifica tenant e permessi e poi `wiqd agent provision --path src/<nome-progetto> --env prod`. La CLI scrive gli ID reali in `env/.env.prod`: verifica e committa **solo** gli ID non segreti; non versionare `.user`, cache o password. Prima collauda su tenant di test. Dal secondo deploy usa la pipeline `prod` protetta.

## Responsabilità dei componenti

- `m365agents.yml`: lifecycle e packaging di Microsoft 365 Agents Toolkit; non contiene alcun segreto.
- `env/.env.prod`: gli ID `TEAMS_APP_ID` e `M365_TITLE_ID` inizialmente vuoti, poi creati dal primo provisioning e salvati in Git. Il tenant è verificato confrontando `agent.config.json → tenantId` con il valore `M365_TENANT_ID` in GitHub.
- `agent.config.json`: policy desiderata di visibilità, non un grant di accesso automatico a gruppi.
- `scripts/deploy.ts`: orchestration CI, niente business logic dell'agent.
- `docs/examples`: manifest di esempio, da adattare e copiare nell'agent prima del rilascio.

## Nuovi tipi di agent

Questo starter implementa un **declarative agent**. Per agent con server, custom engine, API action o MCP l'architettura, il runtime, le risorse Azure e il modello di deployment devono essere aggiunti come progetto separato. Non basta sostituire le `instructions`.

Riferimenti: <https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/overview-declarative-agent> e <https://microsoft.github.io/wiqd/>.

## TypeScript

Per contribuire agli strumenti: `npm run typecheck && npm test && npm run validate`. Il runtime Node esegue direttamente `.ts`, senza Babel/ts-node/tsx; la pipeline CI controlla i tipi con `tsc --noEmit`. Per aggiungere nuovi campi di configurazione modificare prima `types/agent-config.ts` e aggiungere i test relativi. Consulta [la guida TypeScript](05-typescript.md).
