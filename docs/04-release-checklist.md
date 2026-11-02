# Checklist di rilascio prod

- [ ] Eseguito `npm run init -- nome-progetto` prima di qualsiasi pubblicazione.
- [ ] Approvati privacy/terms, URL developer, prompt, descrizioni e icone definitive.
- [ ] Configurati `agent.config.json → tenantId` e audience.
- [ ] In `env/.env.prod`: `M365_AGENT_SCOPE=personal` solo per `private` senza email; altrimenti `shared`.
- [ ] Creati gli ID reali con un provisioning iniziale sul tenant esatto, poi salvati in Git `TEAMS_APP_ID` e `M365_TITLE_ID` (mai i segreti).
- [ ] GitHub Environment `prod` creato con required reviewers e restrizioni branch.
- [ ] Secrets `M365_ACCOUNT_NAME`, `M365_ACCOUNT_PASSWORD` impostati; variabile `M365_TENANT_ID` corrisponde a `tenantId`.
- [ ] Test CI su Windows e Linux superati, validazione manifest WIQD superata.
- [ ] MFA e Conditional Access compatibili con il flusso CI; nessun bypass delle policy.
- [ ] Verificate ACL dei documenti SharePoint, o file inclusi nel package.
- [ ] Testato deploy su tenant di prova e verifica in Copilot.
- [ ] Audience `users`: test con indirizzi; `group`: assegnazione admin e test positivo/negativo, poi `GROUP_ASSIGNMENT_CONFIRMED=true`.
- [ ] Audience `organization`: autorizzazione esplicita e `ALLOW_ORG_SHARING=true`.
- [ ] `publishToCatalog=true` solo con `ALLOW_CATALOG_PUBLISH=true` e approvazioni richieste.
- [ ] Valutata la revoca di vecchi accessi quando si restringe l'audience.
- [ ] Controllati risultati della pipeline, auditing e procedure di rollback.

Vedi [deploy e visibilità](02-deploy-e-visibilita.md).

- [ ] Runner Linux trusted self-hosted etichettato `m365-prod` pronto, con WIQD EULA già accettata manualmente sotto l'utente del runner.
