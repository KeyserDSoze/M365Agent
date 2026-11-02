# Inizializzare e sviluppare un agent

1. Crea una repository da questo template o clonala.
2. Esegui `node init/init.mjs nome-progetto --display-name "Nome Agent"` una sola volta prima del rilascio.
3. Modifica `agent.config.json` per l'audience. Default: `private`, nessun destinatario.
4. Modifica `src/<nome-progetto>/appPackage/declarativeAgent.json`: istruzioni, capability, conversation starters. Il comportamento non viene implementato con un generico file README: è il manifest a definire l'agent.
5. Modifica `src/<nome-progetto>/appPackage/manifest.json`: `developer`, descrizioni e URL reali della tua organizzazione; sostituisci le icone esempio.
6. Esegui `node scripts/validate.mjs`. Per validazione schema completa prima del deploy usa la CLI WIQD approvata: `wiqd agent validate --path src/<nome-progetto> --env prod`.
7. Per una prova locale, installa `@microsoft/wiqd` ed effettua `wiqd auth login --interactive`, poi `wiqd agent provision --path src/<nome-progetto> --env prod` **solo su un tenant di prova**. In produzione usa la pipeline protetta.

## Responsabilità dei componenti

- `m365agents.yml`: lifecycle e packaging di Microsoft 365 Agents Toolkit; non contiene alcun segreto.
- `env/.env.prod`: `TEAMS_APP_ID` stabile, nome e environment non segreti. Il tenant **non si seleziona inserendo un nome in questo file** ma con le credenziali/variabili CI effettivamente in uso.
- `agent.config.json`: policy desiderata di visibilità, non un grant di accesso automatico a gruppi.
- `scripts/deploy.mjs`: orchestration CI, niente business logic dell'agent.
- `docs/examples`: manifest di esempio, da adattare e copiare nell'agent prima del rilascio.

## Nuovi tipi di agent

Questo starter implementa un **declarative agent**. Per agent con server, custom engine, API action o MCP l'architettura, il runtime, le risorse Azure e il modello di deployment devono essere aggiunti come progetto separato. Non basta sostituire le `instructions`.

Riferimenti: <https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/overview-declarative-agent> e <https://microsoft.github.io/wiqd/>.
