# Pattern di knowledge sources

Le capacità di ricerca sono definite nel manifest dichiarativo dell'agent, **non** nello script deploy. In ciascun esempio:
- esegui prima init;
- copia l'esempio in `src/<slug>/appPackage/declarativeAgent.json`;
- aggiorna nome, descrizione, prompt, URL e file;
- esegui `node scripts/validate.mjs`, poi `wiqd agent validate --path src/<slug> --env prod`;
- verifica le fonti e i permessi effettivi con un account test.

## Esempio A — documenti nel pacchetto

Usa [esempio embedded](examples/embedded/declarativeAgent.json). Copia anche [handbook.txt](examples/embedded/handbook.txt) in `appPackage/knowledge/handbook.txt`.

```json
{
  "name": "EmbeddedKnowledge",
  "files": [{"file": "knowledge/handbook.txt"}]
}
```

Ogni file deve essere in un formato supportato (Word, Excel, PowerPoint, TXT, PDF) e **non superare 1 MB**; massimo **10 file per agent**. Inserire altri file nella directory senza referenziarli non significa renderli consultabili dall'agent. Rimuovere dati riservati non destinati al pubblico selezionato. Verificare il contenuto effettivo dello ZIP generato.

## Esempio B — library SharePoint

Usa [esempio SharePoint](examples/sharepoint/declarativeAgent.json). Imposta il link diretto alla document library oppure alla cartella pertinente:

```json
{
  "name": "OneDriveAndSharePoint",
  "items_by_url": [
    {"url": "https://contoso.sharepoint.com/sites/HR/Shared%20Documents"}
  ]
}
```

Alternativa consigliata quando la URL è instabile o la libreria va identificata precisamente: `items_by_sharepoint_ids` con `site_id`, `web_id`, `list_id` ed eventualmente `unique_id` della cartella. I valori sono GUID SharePoint reali, ricavabili tramite amministrazione o API. **Non omettere entrambe le proprietà di scope**: altrimenti la capacità può interrogare tutte le fonti SharePoint/OneDrive disponibili all'utente nel tenant.

L'agent **non aggira ACL, sensitivity labels o policy SharePoint**: un utente deve avere i permessi necessari sui contenuti perché possano essere utilizzati. Eseguire test con utenti del gruppo target e fuori gruppo.

Riferimenti: [schema manifest Microsoft](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/declarative-agent-manifest) e [knowledge sources](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/knowledge-sources).
