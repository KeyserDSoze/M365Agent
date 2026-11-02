# Standard TypeScript del boilerplate

## Scelte

- **Node.js 24.12+**, ES modules e native TypeScript type stripping (niente transpiler a runtime).
- **TypeScript strict** e `tsc --noEmit` come controllo obbligatorio sulle pull request.
- Import relativi con estensione `.ts`; usa `import type` per le sole definizioni di tipo.
- La configurazione resta JSON (`agent.config.json`), ma viene decodificata e validata a runtime dal parser in `types/agent-config.ts`: il type checking **non** protegge input esterni non validati.
- Manifest Microsoft 365 Agent e pipeline rimangono JSON/YAML: TypeScript è il linguaggio **dei tooling script**, non un requisito per il runtime di un declarative agent.

## Comandi su Linux, Windows PowerShell e macOS

```bash
npm ci
npm run init -- assistente-hr --display-name "Assistente HR"
npm run typecheck
npm test
npm run validate
```

L'init è un'operazione una tantum per repository progetto. Rimuove in sicurezza soltanto i remote che puntano all'URL originale `KeyserDSoze/M365Agent`, preservando quelli di un progetto già creato. Se il repository rimane senza remote, installa un hook Git locale `post-commit` che ricorda `git remote add origin <URL>` dopo ogni commit finché non viene associato un nuovo remote. Il hook non interrompe i commit e non sostituisce hook personalizzati. Git non richiede un remote per fare commit (ma lo richiede per il push). In `prod` gli script TS girano via npm con Node 24. Il workflow non effettua deploy finché non esiste un tenant associato e gli ID M365 non sono stati provisioned.

## Struttura del codice

```text
types/agent-config.ts    Config, Audience union, parsing e controlli runtime
init/init.ts              Rinominazione template, manifest, configurazione
scripts/validate.ts       Coerenza manifest e proprietà audience / tenant
scripts/ci-validate.ts    Validazione package con Agents Toolkit
scripts/deploy.ts         Comandi WIQD sotto protezioni prod
tests/*.test.ts           Node built-in test runner, casi positivi e negativi
tsconfig.json             TypeScript strict + noEmit
```

## Aggiungere una nuova modalità di accesso

Aggiorna la discriminated union `Audience`, la funzione `parseAgentConfig` e `scopeForAudience` in `types/agent-config.ts`; poi integra la policy nel deploy, aggiungi test negativi, aggiorna la documentazione e verifica il supporto API ufficiale. Non assumere che una stringa nella configurazione conceda permessi sul tenant.

## Custom engine

Questo template è **per agent dichiarativi** con file o SharePoint. Se servono Azure Functions, API, orchestrazione custom o servizi esterni, si può aggiungere un backend TypeScript dedicato con propri workflow e secrets; non si deve confondere un file `declarativeAgent.json` con un engine runtime.

Riferimento: [Node.js TypeScript nativo](https://nodejs.org/api/typescript.html).
