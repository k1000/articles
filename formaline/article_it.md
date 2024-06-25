# Crea un Assistente AI per Automatizzare la Compilazione di Form Noiosi in HTML

![bot](https://github.com/k1000/articles/blob/main/formaline/Default_A_friendly_bot_crafted_from_shiny_metallic_silver_and_2.jpg?raw=true)
immagine creata con [leonardo.ai](https://app.leonardo.ai/)

### Pubblico

Questo articolo è destinato a programmatori che vogliono imparare le basi della capacità di "chiamata di funzione" dei modelli di linguaggio di grandi dimensioni (LLM) (come [OpenAI](https://openai.com/) o [Anthropic](https://www.anthropic.com/)). La chiamata di funzione è una caratteristica fondamentale dei LLM che consente di creare strumenti, agenti o assistenti specializzati che possono interagire con il mondo esterno. Questo articolo ti mostrerà come creare un semplice assistente AI che può compilare form HTML.

### Cosa Imparerai

La chiamata di funzione è abilitata fornendo al LLM una definizione della firma della funzione. La firma della funzione è una descrizione delle proprietà di input previste della funzione. Imparerai come creare una firma di funzione generata dinamicamente usando lo [schema JSON](https://json-schema.org/), permettendo all'assistente AI di interagire con i form HTML. Lo [schema JSON](https://json-schema.org/) è uno strumento potente per definire e convalidare la struttura di un oggetto JSON. Per scopi didattici non utilizzeremo librerie esterne, solo codice JavaScript puro.

### Introduzione

Possiamo tutti concordare che compilare form è un compito noioso e che richiede tempo. E se potessimo creare un assistente AI che potesse compilare il form per noi, permettendoci di dedicare il nostro tempo a compiti più costruttivi?

L'assistente AI sarà in grado di compilare il form chiamando una funzione con i campi del form come argomenti. La funzione restituirà un oggetto JSON con i campi del form come chiavi e i valori da compilare nel form.

Ci sono un numero infinito di form sul web, ciascuno con la propria struttura unica e convenzioni di denominazione. Fino a poco tempo fa, era quasi impossibile creare un assistente generico che potesse compilare qualsiasi form. Ma con l'avvento dei LLM, possiamo crearne uno.

La chiamata di funzione nella maggior parte degli scenari permette ai LLM di interagire con le [API](https://en.wikipedia.org/wiki/API), ma la stragrande maggioranza delle applicazioni web non espone API, e l'unico modo per interagire con esse è compilando i form.

### Cominciamo

I form possono essere molto diversi tra loro, ma sono tutti costruiti utilizzando elementi comuni come campi di input, textarea, checkbox, radio button, ecc.

Discuteremo solo le parti più importanti dello script. Lo script completo può essere trovato [qui](https://github.com/k1000/articles/blob/main/formaline/formaline.js).

Innanzitutto, dobbiamo identificare gli elementi del form e i loro tipi. Indipendentemente dal tipo di elemento, ciascun elemento è previsto che abbia un attributo "name" che verrà successivamente utilizzato come chiave nell'oggetto JSON.

Per ogni tipo di elemento, creeremo una funzione che restituirà un frammento dello [schema JSON](https://json-schema.org/) definendo l'elemento. Lo [schema JSON](https://json-schema.org/) dovrebbe contenere una descrizione dello scopo dell'elemento. Questo è molto utile per i LLM per comprendere lo scopo dell'elemento o i valori previsti. Il testo per la descrizione verrà raccolto dall'etichetta dell'elemento o dall'attributo placeholder.

Le proprietà dello schema JSON per ciascun elemento contengono almeno:

- `name`: nome dell'elemento
- `type`: tipo di elemento, solitamente stringa
- `description`: descrizione dell'elemento

Poi possiamo avere ulteriori campi aggiuntivi a seconda del tipo di elemento. Ad esempio, nel caso di un elemento input possiamo avere i campi `min`, `max`, `pattern` e `required`.
Nel caso di elementi select, radio o checkbox aggiungiamo anche il campo enum con tutti i valori possibili. I particolari elementi checkbox e radio devono essere trattati in modo speciale poiché possono avere più opzioni di valori correlati a un nome.

```javascript
const getInputSchema = (input) => {
  const { name, type, min, max, pattern, required } = input;
  if (!name) return null;

  const schema = {
    name,
    type: type === 'number' ? 'number' : 'string',
    description: getElementDescription(input),
  };

  if (min) schema.minimum = Number(min);
  if (max) schema.maximum = Number(max);
  if (pattern) schema.pattern = pattern;

  return [formatName(name), schema, required];
};

const getSelectSchema = (select) => {
  const { name, required } = select;
  if (!name) return null;

  return [
    formatName(name),
    {
      name,
      type: 'string',
      description: getElementDescription(select),
      enum: Array.from(select.options).map((option) => option.value),
    },
    required,
  ];
};

const getTextareaSchema = (textArea) => {
  const { name, required } = textArea;
  if (!name) return null;

  return [
    formatName(name),
    { name, type: 'string', description: getElementDescription(textArea) },
    required,
  ];
};

const getCheckboxesSchema = ([name, values]) => {
  const element = document.querySelector(`[name="${name}"]`);
  const isArray = name.endsWith('[]');

  const schema = {
    name,
    type: isArray ? 'array' : 'boolean',
    description: getDescription(element),
  };

  if (isArray) {
    schema.uniqueItems = true;
    schema.items = { oneOf: values };
  }

  return [formatName(name), schema];
};

const getRadioSchema = ([name, values]) => {
  const element = document.querySelector(`[name="${name}"]`);
  return [
    formatName(name),
    {
      name,
      type: 'string',
      description: getDescription(element),
      enum: values.map((v) => v.const),
    },
  ];
};
```

Ora arriviamo alla funzione più importante che genererà lo schema per ciascun form utilizzando tutte le funzioni disponibili.

```javascript
const generateSchema = (form) => {
  const inputSelectors = [
    'input[type="text"]',
    'input[type="email"]',
    'input[type="number"]',
    'input[type="password"]',
    'input[type="tel"]',
    'input[type="url"]',
    'input[type="date"]',
    'input[type="time"]',
    'input[type="datetime-local"]',
    'input[type="month"]',
    'input[type="week"]',
    'input[type="color"]',
    'input[type="range"]',
    'input[type="search"]',
  ].join(', ');

  const inputs = Array.from(form.querySelectorAll(inputSelectors))
    .map(getInputSchema)
    .filter(Boolean);
  const checkboxes = groupByName(
    Array.from(form.querySelectorAll('input[type="checkbox"]'))
  ).map(getCheckboxesSchema);
  const radios = groupByName(
    Array.from(form.querySelectorAll('input[type="radio"]'))
  ).map(getRadioSchema);
  const selects = Array.from(form.getElementsByTagName('select'))
    .map(getSelectSchema)
    .filter(Boolean);
  const textAreas = Array.from(form.getElementsByTagName('textarea'))
    .map(getTextareaSchema)
    .filter(Boolean);

  const schemaProps = [
    ...inputs,
    ...checkboxes,
    ...radios,
    ...selects,
    ...textAreas,
  ];
  const required = schemaProps.filter(([, , r]) => r).map(([name]) => name);

  return {
    name: 'fillup_form',
    description: 'Schema to fill form inputs',
    parameters: {
      type: 'object',
      required,
      properties: Object.fromEntries(
        schemaProps.map(([name, schema]) => [name, schema])
      ),
    },
  };
};
```

Questa funzione scansiona il form per tutti gli elementi di input e crea uno schema per ciascuno di essi. Raggruppa le checkbox e i radio per nome e crea uno schema per ciascun gruppo. Infine, crea uno schema JSON con tutti gli elementi del form.

Qui definiamo una funzione che chiamerà l'API di completamento delle chat di OpenAI. Forniamo il nome del modello (in questo caso 'gpt-4o' che garantisce buoni risultati con la chiamata di funzione) e la chiave API e impostiamo 'temperature' a 0 per ottenere risultati deterministici.

```javascript
const callOpenAiAPI = async ({
  api_key,
  model = 'gpt-4o',
  max_tokens = 3024,
  tools,
  messages,
}) => {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${api_key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens,
        temperature: 0,
        tools,
        messages,
      }),
    });
    return await response.json();
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    throw error;
  }
};
```

Finalmente siamo arrivati al punto in cui possiamo inviare la nostra richiesta all'API di OpenAI e compilare il form con la risposta. Sfruttiamo la capacità degli "strumenti" per fornire lo schema generato. Qui utilizziamo la scelta dello strumento "auto" per lasciare che OpenAI scelga il miglior strumento per il lavoro. Forniamo i dati da compilare nel form come un messaggio all'assistente AI con un prompt molto semplice: call "fillup_form" with following data:\n${data}.
Invece di OpenAI, possiamo chiamare [l'API di Anthropic](https://platform.openai.com/docs/guides/text-generation/chat-completions-api) in modo simile.

```javascript
const submitForm = async (submitButton, form, formId) => {
  submitButton.classList.add('spinner');
  const formSchema = generateSchema(form);
  const data = document.getElementById(`_data_${formId}`).value;
  const apiKey = document.getElementById(`_api-key_${formId}`).value;

  try {
    const llmResponse = await callOpenAiAPI({
      api_key: apiKey,
      tools: [{ type: 'function', function: formSchema }],
      tool_choice: 'auto',
      messages: [
        {
          role: 'user',
          content: `call "fillup_form" with following data:\n${data}`,
        },
      ],
    });

    const rawData =
      llmResponse.choices[0].message?.tool_calls?.[0]?.function?.arguments ||
      llmResponse.choices[0].message?.content;
    const inputData = Object.entries(JSON.parse(rawData));
    fillForm(formSchema.parameters.properties, inputData);
  } catch (error) {
    console.error('Error processing form submission:', error);
  } finally {
    submitButton.classList.remove('spinner');
  }
};
```

La funzione sopra restituisce la risposta dall'API di OpenAI con un oggetto che mappa i campi del form ai valori da compilare nel form. Successivamente chiamiamo la funzione fillForm per compilare il form con la risposta. E voilà! Il form è compilato.

```javascript
const fillForm = (formFields, inputData) => {
  inputData.forEach(([name, value]) => {
    try {
      const fieldDef = formFields[name];
      const fieldName = fieldDef.name;
      const fieldElement = document.querySelector(`[name="${fieldName}"]`);

      if (Array.isArray(value)) {
        value.forEach((val) => {
          const checkbox = document.querySelector(
            `[name="${fieldName}"][value="${val}"]`
          );
          if (checkbox) checkbox.checked = true;
        });
      } else if (fieldElement.type === 'radio') {
        const radio = document.querySelector(
          `[name="${fieldName}"][value="${value}"]`
        );
        if (radio) radio.checked = true;
      } else if (fieldElement) {
        fieldElement.value = value;
      }
    } catch (error) {
      console.error(`Error filling form field: ${name}`, error);
    }
  });
};
```

### Dove possiamo arrivare con questo?

Questo script può essere ulteriormente migliorato aggiungendo funzionalità più avanzate come la gestione dei caricamenti di file, la gestione dei form dinamici, ecc.
Possibili sviluppi futuri:

- `Estensione del browser` che compilerà automaticamente i form sulla pagina in base ai profili memorizzati.

- Possiamo creare un `Agente AI` che compila i form per nostro conto.

- Possiamo creare uno `strumento di inserimento dati automatizzato` che compilerà i form basandosi sui dati dal database o da qualsiasi altra fonte.

- Utilizzare LLM per generare `dati falsi` in scenari in cui abbiamo bisogno di preservare la nostra privacy.

- Possiamo estendere lo script con un livello di persistenza per memorizzare i valori compilati in modo da poterli utilizzare in futuro.

- In caso di form molto complessi con un gran numero di campi, suddividere il form in parti più piccole (fieldset) e compilarle separatamente.

### Conclusione

Questo script dovrebbe funzionare con la maggior parte dei form. Tuttavia, se il form è dinamico (alcuni elementi del form cambiano o vengono attivati dall'input dell'utente) o utilizza alcune funzionalità avanzate come il caricamento di file o è costruito in modo non standard o errato, potrebbe non funzionare come previsto. In tali casi, potrebbe essere necessario adattare lo script per gestire questi casi.

Spero che questo articolo ti sia stato utile e che tu abbia imparato qualcosa di nuovo. Se hai domande o suggerimenti, sentiti libero di lasciare un commento qui sotto.

Guarda lo script in azione creando un bookmarklet da questo script [qui](https://raw.githubusercontent.com/k1000/articles/main/formaline/bookmarklet.js).

Puoi visualizzare l'intero [script qui](https://github.com/k1000/articles/blob/main/formaline/formaline.js).
