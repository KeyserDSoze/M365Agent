# Security baseline

- **Fail closed:** default private; la condivisione a tutto il tenant richiede `ALLOW_ORG_SHARING=true` configurato su `prod`.
- **Secrets:** soltanto GitHub Environment Secrets; `.env.*.user` ignorati. Mai stampare o allegare token/password.
- **Governance:** approvazioni su `prod`, branch protection, runner trusted, nessun deploy da PR non fidate.
- **Autenticazione:** username/password delegata WIQD può essere bloccata da MFA/Conditional Access; non bypassare i controlli. Preferire approccio approvato dal tenant quando sarà disponibile.
- **Gruppi:** la disponibilità specifica è attività amministrativa separata. Non interpretare `groupId` come accesso già concesso.
- **Catalogo:** opt-in con `publishToCatalog` + variable esplicita, soggetto ad approvazione tenant.
- **Dati:** accesso all'agent e accesso alle fonti SharePoint sono controlli distinti. Verificare entrambi.
- **Identità:** `TEAMS_APP_ID` stabile; registrare gli altri ID generati senza pubblicare credenziali.
- **Dipendenze:** versioni CLI pin, verificare release note prima di aggiornare.

- **Tenant binding:** `agent.config.json → tenantId` viene confrontato con `M365_TENANT_ID` prima del provisioning.
- **Stato cloud:** `TEAMS_APP_ID` e `M365_TITLE_ID` si versionano solo dopo il bootstrap su tenant autorizzato; non inventare o rigenerare ID.
- **Gruppi:** `GROUP_ASSIGNMENT_CONFIRMED` attesta la verifica manuale amministrativa, non un grant automatico.
- **Riduzione audience:** il cambio di configurazione non revoca automaticamente accessi vecchi; eseguire una revisione e le revoche necessarie.
