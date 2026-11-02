# Deploy GitHub Actions e visibilità

## 1. Prerequisiti Microsoft 365

Per la modalità CI selezionata la pipeline si autentica come **utente Microsoft 365 delegato** con WIQD Core (`CI_ENABLED=true` + `M365_ACCOUNT_NAME`/`M365_ACCOUNT_PASSWORD`). Non è un service principal app-only. Verificare licenze, consenso dell'organizzazione, ruolo e Conditional Access. Se MFA impedisce la modalità password, **non disabilitare MFA**: valutare con gli amministratori una modalità supportata o un rilascio assistito, prima di usare prod.

Nel repository GitHub creare l'environment `prod`, salvare i secrets e la variable tenant indicati nel README, aggiungere required reviewers. Configurare prima `agent.config.json → tenantId` con lo stesso GUID; eseguire il provisioning iniziale interattivo sul tenant, committando `TEAMS_APP_ID` e `M365_TITLE_ID` generati nel file `.env.prod` (senza segreti). Le credenziali rimangono nell'environment, non nell'agent. Prova in un tenant non-prod prima di abilitare il job su `main`. La pipeline fallisce se il progetto non ha eseguito init, mancano i secret o manca una autorizzazione esplicita per scope ampio.

## 2. Modalità disponibili

### Solo deployer o una persona

```json
{"mode":"private","emails":[],"groupId":null,"groupType":null}
```

Il provisioning non condivide con nessun altro. Per condividere con **una** persona, imposta `emails: ["persona@contoso.com"]`: WIQD esegue `agent share --scope users --email persona@contoso.com`.

### Lista di email

```json
{"mode":"users","emails":["anna@contoso.com","luca@contoso.com"],"groupId":null,"groupType":null}
```

La lista viene validata, quindi passata alla condivisione diretta WIQD. Gli indirizzi sono interni al tenant, devono esistere e rispettare i criteri aziendali.

### Gruppo Security o Microsoft 365

```json
{"mode":"group","emails":[],"groupId":"00000000-0000-0000-0000-000000000123","groupType":"security"}
```

Usare `groupType: "m365"` per un gruppo Microsoft 365. Il GUID è l'**object ID Entra** del gruppo, non un indirizzo email, e il gruppo deve essere effettivamente selezionabile nel tenant.

1. La pipeline valida e carica l'agent; opzionalmente lo invia al catalogo (`publishToCatalog=true` e `ALLOW_CATALOG_PUBLISH=true`). Fino a `GROUP_ASSIGNMENT_CONFIRMED=true`, il workflow termina con stato non completato e istruzioni nella summary.
2. Un amministratore apre <https://admin.microsoft.com> → **Agents → All agents**, individua l'agent, e imposta **Users → Available to → Specific users or groups**, selezionando il gruppo previsto.
3. Opzionalmente imposta **Installed for** / **Deploy** per la preinstallazione nello stesso gruppo. Disponibilità e preinstallazione non sono lo stesso controllo.
4. Verifica con un membro e un non membro, registra l'assegnazione amministrativa e poi imposta `GROUP_ASSIGNMENT_CONFIRMED=true` nelle GitHub Environment Variables di `prod` e rilancia. Il flag è **un'attestazione manuale**, non una conferma interrogata via API. Fino ad allora, **distribuzione al gruppo non completata**.

Non impostare **All users in organization** in questa modalità. L'API di share diretta documentata da WIQD accetta utenti/tenant, non un parametro `groupId`: non fingiamo che il gruppo sia stato assegnato dalla pipeline.

### Tutta l'organizzazione

```json
{"mode":"organization","emails":[],"groupId":null,"groupType":null}
```

Richiede `ALLOW_ORG_SHARING=true` in `prod`. La pipeline esegue `wiqd agent share --scope tenant`. Se vuoi anche l'agent nel catalogo amministrativo, imposta `publishToCatalog=true` e `ALLOW_CATALOG_PUBLISH=true`. La policy amministrativa può comunque richiedere approvazione o limitare distribuzione/installazione.

## 3. Publish to catalog

`wiqd agent publish --env prod` invia l'agent al catalogo org; non è un rilascio AppSource pubblico e non sostituisce i controlli di disponibilità/approvazione. È proibito per `private` e `users`, così da evitare un ampliamento non voluto della visibilità.

## 4. Idempotenza, operazioni e audit

Nel workflow i comandi `validate → provision → package → validate deep → share/publish` avvengono nello stesso job. La pipeline **richiede** che `TEAMS_APP_ID` e `M365_TITLE_ID` siano già generati dal bootstrap sul tenant e salvati in Git; non sincronizza automaticamente nuovi file `.env.prod` dal runner. Verificare lo stato cloud dopo timeout o rerun, evitare nuovi identificativi e controllare manualmente condivisioni residue se la audience si restringe. Non archiviare credenziali, cache o file utente nel package GitHub.

Riferimenti Microsoft: [agent details e disponibilità](https://learn.microsoft.com/en-us/microsoft-agent-365/admin/agent-details), [CI autenticazione WIQD](https://microsoft.github.io/wiqd/getting-started/ci-cd-authentication/), [pipeline WIQD](https://microsoft.github.io/wiqd/getting-started/ci-cd-pipelines/).
