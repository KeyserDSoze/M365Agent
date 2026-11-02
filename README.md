# M365Agent — boilerplate per Microsoft 365 Copilot Agents

Template per avviare **Declarative Agents** Microsoft 365 Copilot con struttura replicabile, configurazione del tenant, GitHub Actions con environment `prod`, esempi di knowledge source e distribuzione controllata.

La repository contiene **un template**, non un agente già distribuito. Nessun accesso al tenant è concesso senza le credenziali e le autorizzazioni configurate dal proprietario.

## Quick start (Windows, Linux, macOS)

Richiede **Node.js 24.12+ e npm**. Gli strumenti del boilerplate sono sviluppati in **TypeScript strict**: Node 24 esegue direttamente i file `.ts` con type stripping nativo, mentre `npm run typecheck` esegue il controllo statico TypeScript. I manifest dell'agent restano JSON/YAML.

```bash
git clone https://github.com/KeyserDSoze/M365Agent.git
cd M365Agent
npm ci
npm run init -- assistente-hr --display-name "Assistente HR"
npm run validate
```

**PowerShell (Windows):** gli stessi comandi funzionano anche in PowerShell 7; non servono `sed`, Bash, symlink o script `.sh`/`.ps1` separati.

```powershell
git clone https://github.com/KeyserDSoze/M365Agent.git
Set-Location M365Agent
npm ci
npm run init -- "assistente-hr" --display-name "Assistente HR"
npm run validate
```

L'init:
- rinomina `src/m365-agent/` in `src/assistente-hr/`;
- aggiorna nomi e descrizione in `agent.config.json`, nel manifest Teams e nel manifest dichiarativo;
- prepara `env/.env.prod` con ID vuoti: è il **primo provisioning** sul tenant scelto a generare i veri ID di Teams App e dell'agent. Versionarli prima di abilitare il deploy automatico.
- **scollega automaticamente ogni remote che punta al boilerplate originale** (`KeyserDSoze/M365Agent`, HTTPS o SSH), ma **mantiene intatti i remote già associati al progetto**.
- se non resta alcun remote, installa un promemoria `post-commit` solo nella directory Git locale (`.git/hooks/`), che dopo il primo commit ti ricorda come associare il nuovo repository. Non sovrascrive hook preesistenti o `core.hooksPath` personalizzati.

### Collegare il repository Git del progetto

Dopo `npm run init -- assistente-hr`, se stavi lavorando su un clone del boilerplate, `git remote -v` non mostrerà più `origin` con URL del template. **`git commit` funziona anche senza remote**: il promemoria locale appare *dopo il commit*, finché non configuri un nuovo origin.

```bash
git add .
git commit -m "chore: initialize assistente-hr"
git remote add origin https://github.com/TUA-ORGANIZZAZIONE/assistente-hr.git
git push -u origin HEAD
```

Se crei una repository con **Use this template** su GitHub, `origin` punta già alla tua nuova repository e `init` lo **preserva**. Il promemoria è locale: non modifica la cronologia Git e non viene tracciato dal repository. Se usi hook personalizzati, non vengono sovrascritti.

**Eseguire init prima del primo deploy**: cambia l'identità Teams App. Non rilanciare init dopo avere distribuito l'app. Personalizza prompt, metadata `developer`, privacy, termini e fonti dati.

## Struttura

```text
.github/workflows/
  ci.yml                 # verifica su PR e push
  deploy-prod.yml        # distribuzione su main o workflow_dispatch
init/init.ts              # inizializzazione cross-platform (TypeScript)
types/agent-config.ts      # tipi e parser runtime delle configurazioni
package.json               # npm scripts e versioni tooling
package-lock.json          # dependency lock riproducibile (npm ci)
tsconfig.json              # TypeScript strict + noEmit
scripts/validate.ts       # preflight senza credenziali
scripts/deploy.ts         # rilascio + condivisione condizionata
agent.config.json         # identità e audience
src/
  m365-agent/
    m365agents.yml       # lifecycle Microsoft 365 Agents Toolkit
    env/.env.prod        # IDs non segreti / nome environment
    appPackage/
      manifest.json
      declarativeAgent.json
      outline.png
      color.png
docs/
  01-getting-started.md
  02-deploy-e-visibilita.md
  03-knowledge.md
  SECURITY.md
  examples/
```

## Sviluppo TypeScript

```bash
npm ci
npm run typecheck         # verifica statica dei tipi
npm test                  # init, audience, tenant e sicurezza
npm run validate          # configurazione attuale
npm run validate:toolkit  # richiede Agents Toolkit CLI installato
```

Gli script `init`, `validate` e `deploy:prod` sono TypeScript. Gli agent **dichiarativi** rimangono descritti in `declarativeAgent.json`: non serve un server TypeScript per un agent che usa documenti embedded o SharePoint. Per un **custom-engine agent** con logica applicativa serve un progetto backend separato. Vedi [standard di sviluppo](docs/05-typescript.md).

## Audience: configurazione `agent.config.json`

| `mode` | `emails` | Comportamento pipeline |
| --- | --- | --- |
| `private` | `[]` | Solo proprietario/deployer; nessuna condivisione |
| `private` | `["persona@contoso.com"]` | Condivide con **una sola persona** |
| `users` | lista di email | Condivide con i singoli utenti indicati |
| `group` | `[]` + `groupId` e `groupType` | Provisioning e, se richiesto, invio al catalogo; **workflow non verde fino a conferma admin** |
| `organization` | `[]` | Condivisione diretta al tenant (richiede esplicito consenso `ALLOW_ORG_SHARING`) |

Il formato di `groupType` è `security` oppure `m365`. La pipeline **non trasforma il GUID del gruppo in email individuali e non assume che la condivisione a un indirizzo di gruppo equivalga ad applicare un criterio di accesso**. Per gruppi, l'amministratore applica `Available to = Specific users or groups` nel Microsoft 365 admin center. Il rollout gruppi non è completo finché questo passaggio non viene effettuato.

`publishToCatalog: true` è consentito solo per `organization` e `group` e richiede una seconda autorizzazione `ALLOW_CATALOG_PUBLISH`. La pubblicazione nel catalogo **non è sinonimo di installazione per tutti** e può richiedere approvazione dell'amministratore. La configurazione di default resta privata.

## Pipeline `prod`

La Action `deploy-prod.yml` scatta al merge su `main` oppure manualmente (`workflow_dispatch`). Il job usa `environment: prod` e lo script avvia `wiqd agent validate`, `provision`, `package`, validazione deep e la condivisione consentita.

### Bootstrap obbligatorio: una sola volta per progetto/tenant

Per evitare di ricreare l'agent sui runner effimeri, la pipeline rifiuta il deploy finché gli ID cloud non sono già stati persistiti.

1. Dopo l'init configura il GUID del tenant target in `agent.config.json → tenantId`.
2. Imposta in `src/<slug>/env/.env.prod` `M365_AGENT_SCOPE=personal` solo per `private` senza email; `shared` per tutte le altre audience. Fai prima `npm run validate`.
3. Da un terminale locale con sessione autorizzata al tenant scelto: `wiqd auth login --interactive` e poi `wiqd agent provision --path src/<slug> --env prod`. Verifica tenant, identità e permessi prima del comando.
4. **Verifica e committa il file** `src/<slug>/env/.env.prod` aggiornato dalla CLI con `TEAMS_APP_ID` e `M365_TITLE_ID`; non includere `.env.*.user`, token o cache. L'app usa gli stessi ID ai deploy successivi.
5. Prepara su GitHub l'environment `prod`, configuralo con credenziali e reviewers, assicurati che `M365_TENANT_ID` coincida con `tenantId` in config e lancia il deploy di prova.

Non sostituire il primo provisioning con un GUID casuale: un identificatore inventato non garantisce che esista una risorsa nel tenant.

In **Settings → Environments → New environment**, crea **`prod`** e configura:

| Tipo | Nome | Funzione |
| --- | --- | --- |
| Secret | `M365_ACCOUNT_NAME` | UPN account di pubblicazione dedicato |
| Secret | `M365_ACCOUNT_PASSWORD` | Password protetta per la modalità CI attualmente rilasciata |
| Variable | `M365_TENANT_ID` | GUID del tenant Microsoft 365 target |
| Variable | `ALLOW_ORG_SHARING` | `true` solo se approvata la visibilità al tenant |
| Variable | `ALLOW_CATALOG_PUBLISH` | `true` solo se approvato l'invio al catalogo |
| Variable | `GROUP_ASSIGNMENT_CONFIRMED` | `true` solo dopo l'assegnazione e test del gruppo da parte dell'admin |

Configura **required reviewers**, eventuali deployment branch rules e privilegi minimi dell'account sul tenant. Non mettere credenziali in repository o nei file `.env.prod`. L'account deve avere già accessi, consensi e autorizzazioni Microsoft 365 per le operazioni richieste.


### Runner richiesto per WIQD (EULA)

Per il deployment non si può usare WIQD con un GitHub-hosted runner effimero come se fosse già autorizzato: **WIQD 0.22 rifiuta l'accettazione automatica dell'EULA durante CI**. Il job `deploy` usa quindi un runner Linux **self-hosted**, opportunamente protetto, con etichetta `m365-prod`. Un operatore autorizzato deve installare WIQD e accettare personalmente la licenza sull'account del runner (`wiqd eula accept wiqd` eseguito in sessione umana); verificare `wiqd eula status`. Il workflow non esegue mai l'accettazione per conto di una persona. Limitare questo runner a repository e branch affidabili e a job con approvazione `prod`. Se non c'è un runner di questo tipo, il deploy resta sospeso: i test CI restano eseguibili su GitHub-hosted Linux/Windows con Agents Toolkit CLI.

**Attenzione MFA/Conditional Access:** WIQD 0.22 supporta la modalità username/password nelle pipeline trusted, ma alcune policy tenant la bloccano. La modalità refresh token è descritta dalla documentazione Microsoft come *non ancora pienamente rilasciata/validata*: il workflow non la abilita per default. Il deploy in un tenant reale richiede una prova tecnica iniziale e approvazioni; non possiamo considerarlo riuscito soltanto perché il workflow esiste. <https://microsoft.github.io/wiqd/getting-started/ci-cd-authentication/>

### Stato delle risorse tra deploy

`TEAMS_APP_ID` e `M365_TITLE_ID` in `env/.env.prod` sono persistenti **dopo il bootstrap sul tenant**. Il deploy confronta anche `agent.config.json → tenantId` con `M365_TENANT_ID`. Gli aggiornamenti dell'audience non revocano automaticamente condivisioni precedenti: coordinare la revoca con l'amministratore. Non caricare `.env.*.user` o token negli artifact. Vedi [guida di deploy](docs/02-deploy-e-visibilita.md).

## Esempi e documentazione

- [Avvio e integrazione](docs/01-getting-started.md)
- [Rilascio in prod, audience e gruppi](docs/02-deploy-e-visibilita.md)
- [Agent con file embedded o libreria SharePoint](docs/03-knowledge.md)
- [Controlli di sicurezza](docs/SECURITY.md)
- [Checklist per il rilascio](docs/04-release-checklist.md)
- [Standard TypeScript](docs/05-typescript.md)

Link ufficiali: [Declarative agents](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/declarative-agent-manifest), [Agents Toolkit](https://learn.microsoft.com/en-us/microsoftteams/platform/toolkit/microsoft-365-agents-toolkit-cli), [WIQD CI/CD](https://microsoft.github.io/wiqd/getting-started/ci-cd-pipelines/), [Gestione disponibilità agent](https://learn.microsoft.com/en-us/microsoft-agent-365/admin/agent-details).
