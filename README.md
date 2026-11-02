# M365Agent — boilerplate per Microsoft 365 Copilot Agents

Template per avviare **Declarative Agents** Microsoft 365 Copilot con struttura replicabile, configurazione del tenant, GitHub Actions con environment `prod`, esempi di knowledge source e distribuzione controllata.

La repository contiene **un template**, non un agente già distribuito. Nessun accesso al tenant è concesso senza le credenziali e le autorizzazioni configurate dal proprietario.

## Quick start (Windows, Linux, macOS)

Richiede **Node.js 24.15+** per il flusso CI Work IQ; lo script di inizializzazione funziona anche con Node 20+.

```bash
git clone https://github.com/KeyserDSoze/M365Agent.git
cd M365Agent
node init/init.mjs assistente-hr --display-name "Assistente HR"
node scripts/validate.mjs
```

**PowerShell (Windows):** gli stessi comandi funzionano anche in PowerShell 7; non servono `sed`, Bash, symlink o script `.sh`/`.ps1` separati.

```powershell
git clone https://github.com/KeyserDSoze/M365Agent.git
Set-Location M365Agent
node .\init\init.mjs "assistente-hr" --display-name "Assistente HR"
node .\scripts\validate.mjs
```

L'init:
- rinomina `src/m365-agent/` in `src/assistente-hr/`;
- aggiorna nomi e descrizione in `agent.config.json`, nel manifest Teams e nel manifest dichiarativo;
- genera un **nuovo GUID Teams App** stabile in `env/.env.prod`, differente per ciascun progetto.

**Eseguire init prima del primo deploy**: cambia l'identità Teams App. Non rilanciare init dopo avere distribuito l'app. Personalizza prompt, metadata `developer`, privacy, termini e fonti dati.

## Struttura

```text
.github/workflows/
  ci.yml                 # verifica su PR e push
  deploy-prod.yml        # distribuzione su main o workflow_dispatch
init/init.mjs             # inizializzazione cross-platform
scripts/validate.mjs      # preflight senza credenziali
scripts/deploy.mjs        # rilascio + condivisione condizionata
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

## Audience: configurazione `agent.config.json`

| `mode` | `emails` | Comportamento pipeline |
| --- | --- | --- |
| `private` | `[]` | Solo proprietario/deployer; nessuna condivisione |
| `private` | `["persona@contoso.com"]` | Condivide con **una sola persona** |
| `users` | lista di email | Condivide con i singoli utenti indicati |
| `group` | `[]` + `groupId` e `groupType` | Provisioning, eventuale invio al catalogo, **assegnazione admin necessaria** |
| `organization` | `[]` | Condivisione diretta al tenant (richiede esplicito consenso `ALLOW_ORG_SHARING`) |

Il formato di `groupType` è `security` oppure `m365`. La pipeline **non trasforma il GUID del gruppo in email individuali e non assume che la condivisione a un indirizzo di gruppo equivalga ad applicare un criterio di accesso**. Per gruppi, l'amministratore applica `Available to = Specific users or groups` nel Microsoft 365 admin center. Il rollout gruppi non è completo finché questo passaggio non viene effettuato.

`publishToCatalog: true` è consentito solo per `organization` e `group` e richiede una seconda autorizzazione `ALLOW_CATALOG_PUBLISH`. La pubblicazione nel catalogo **non è sinonimo di installazione per tutti** e può richiedere approvazione dell'amministratore. La configurazione di default resta privata.

## Pipeline `prod`

La Action `deploy-prod.yml` scatta al merge su `main` oppure manualmente (`workflow_dispatch`). Il job usa `environment: prod` e lo script avvia `wiqd agent validate`, `provision`, `package`, validazione deep e la condivisione consentita.

In **Settings → Environments → New environment**, crea **`prod`** e configura:

| Tipo | Nome | Funzione |
| --- | --- | --- |
| Secret | `M365_ACCOUNT_NAME` | UPN account di pubblicazione dedicato |
| Secret | `M365_ACCOUNT_PASSWORD` | Password protetta per la modalità CI attualmente rilasciata |
| Variable | `M365_TENANT_ID` | GUID del tenant Microsoft 365 target |
| Variable | `ALLOW_ORG_SHARING` | `true` solo se approvata la visibilità al tenant |
| Variable | `ALLOW_CATALOG_PUBLISH` | `true` solo se approvato l'invio al catalogo |

Configura **required reviewers**, eventuali deployment branch rules e privilegi minimi dell'account sul tenant. Non mettere credenziali in repository o nei file `.env.prod`. L'account deve avere già accessi, consensi e autorizzazioni Microsoft 365 per le operazioni richieste.

**Attenzione MFA/Conditional Access:** WIQD 0.22 supporta la modalità username/password nelle pipeline trusted, ma alcune policy tenant la bloccano. La modalità refresh token è descritta dalla documentazione Microsoft come *non ancora pienamente rilasciata/validata*: il workflow non la abilita per default. Il deploy in un tenant reale richiede una prova tecnica iniziale e approvazioni; non possiamo considerarlo riuscito soltanto perché il workflow esiste. <https://microsoft.github.io/wiqd/getting-started/ci-cd-authentication/>

### Stato delle risorse tra deploy

`TEAMS_APP_ID` in `env/.env.prod` è persistente e versionato. Dopo il primo provisioning verificare gli identificativi dell'app creati in M365, i privilegi dell'account e gli eventuali identificativi aggiuntivi richiesti dall'ambiente; **un checkout nuovo non rende ogni operazione automaticamente idempotente**. Non caricare `.env.*.user` o token negli artifact. Vedi [guida di deploy](docs/02-deploy-e-visibilita.md).

## Esempi e documentazione

- [Avvio e integrazione](docs/01-getting-started.md)
- [Rilascio in prod, audience e gruppi](docs/02-deploy-e-visibilita.md)
- [Agent con file embedded o libreria SharePoint](docs/03-knowledge.md)
- [Controlli di sicurezza](docs/SECURITY.md)

Link ufficiali: [Declarative agents](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/declarative-agent-manifest), [Agents Toolkit](https://learn.microsoft.com/en-us/microsoftteams/platform/toolkit/microsoft-365-agents-toolkit-cli), [WIQD CI/CD](https://microsoft.github.io/wiqd/getting-started/ci-cd-pipelines/), [Gestione disponibilità agent](https://learn.microsoft.com/en-us/microsoft-agent-365/admin/agent-details).
