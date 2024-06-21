# Create an AI Helper to Automate Filling Boring HTML Forms

![bot](https://github.com/k1000/articles/blob/main/formaline/Default_A_friendly_bot_crafted_from_shiny_metallic_silver_and_2.jpg?raw=true)

### Audience

This article is intended for programmers who want to learn about the basics of "function calling" capability of Large Language Models (LLMs) (such as [OpenAI](https://openai.com/) or [Anthropic](https://www.anthropic.com/)). Function calling is a fundamental LLM feature that allows creating specialized tools, agents, or assistants that can interact with the external world. This article will show you how to create a simple AI assistant that can fill out HTML forms.

### What You Will Learn

Function calling is enabled by providing the LLM with a definition of the function signature. The function signature is a description of the function's expected input properties. You will learn how to create a dynamically generated [JSON schema](https://json-schema.org/) function signature, allowing the AI assistant to interact with HTML forms. [JSON schema](https://json-schema.org/) is a powerful tool for defining and validating the structure of a JSON object. For the educational purpose will not use any external libraries, only pure JavaScript code.

### Introduction

We can all agree that filling out forms is a boring and time-consuming task. What if we could create an AI assistant that could fill the form for us, allowing us to dedicate our time to more constructive tasks?

The AI assistant will be able to fill the form by calling a function with the form fields as arguments. The function will return a JSON object with the form fields as keys and the values to be filled in the form.

There are an infinite number of forms on the web, each with its own unique structure and naming conventions. Until recently, it was almost impossible to create a generic assistant that could fill any form. But with the advent of LLMs, we can create one.

Function calling in most scenarios allows LLMs to interact with [APIs](https://en.wikipedia.org/wiki/API), but the vast majority of web applications do not expose APIs, and the only way to interact with them is by filling out forms.

### Let's Get Started

Forms can be very different from each other, but they all are built using common elements like input fields, textareas, checkboxes, radio buttons, etc.

First, we need to identify the form elements and their types. Regardless of the element type, each element is expected to have a "name" attribute that will be later used as a key in the JSON object.

For each element type, we will create a function that will return a fragment of [JSON schema](https://json-schema.org/) defining the element. The [JSON schema](https://json-schema.org/) should contain a description of the element's purpose. This is very useful for LLMs to understand the purpose of the element or expected values. The text for the description will be gathered from the element's label or placeholder attribute.

First we will define some utility functions that will be used to extract element description and format element name, and group elements by name.

```javascript
const getElementDescription = (element) => {
  const labelsText = Array.from(element.labels)
    .map((label) => label.innerText)
    .join(', ');
  return `${labelsText} ${element.placeholder || ''}`.trim();
};

const formatName = (name) => name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 63);

const getDescription = (element) => {
  const describeId = element.getAttribute('aria-describedby');
  return describeId ? document.querySelector(`#${describeId}`).innerText : '';
};

const groupByName = (arr) =>
  Object.entries(
    arr.reduce((result, obj) => {
      const { name, value, id } = obj;
      if (!result[name]) result[name] = [];
      result[name].push({
        const: value,
        id,
        title: getElementDescription(obj),
      });
      return result;
    }, {})
  );
```

Here we define functions to create schema for input, select, textarea, checkboxes and radios.

Json schema for each element at least contains:

- `name`: element's name
- `type`: element type, usually string
- `description`: element description

Than we can have more additional fields depending on element type. For example, in case of input element we can have `min`, `max`, `pattern` and `required` fields.
In case of select element, radio or checkbox elements we also add enum field with all possible values. Particular checkboxes and radio elements should be addressed in special way since they can have multiple values options related to one name.

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

Now we arrive to the most important function that will generate the schema for each form using all available functions.

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

This function scans the form for all input elements and creates a schema for each of them. It groups checkboxes and radios by name and creates a schema for each group. Finally, it creates a JSON schema with all the form elements.

`fillForm` populates the form with the data provided in the JSON object. The function iterates over the JSON object and fill the form fields with corresponding values.

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

Here we define a function that will call OpenAI API with the provided parameters.

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

This function takes provided by OpenAi object and populates the form with the with values.

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

`setupForms` scans html document for all forms and creates a dialog for each form. The dialog contains a textarea for the user to input the data and an input field for the OpenAI API key. The dialog also contains a "Fill" button that, when clicked, will open the dialog and fill the form with the data provided by the user.

```javascript
const setupForms = () => {
  const forms = Array.from(document.getElementsByTagName('form'));

  forms.forEach((form, i) => {
    const dialogHtml = `
      <a class="fill_btn" onclick="document.getElementById('dialog_${i}').showModal()">✨ Fill</a>
      <dialog class="fill" id="dialog_${i}">
        <article>
          <p>
            <textarea class="fill" placeholder="Your data" id="_data_${i}" required></textarea>
          </p>
          <p>
            <input type="password" placeholder="OpenAI API key" id="_api-key_${i}" required />
          </p>
          <p style="text-align: right">
            <button role="button" onclick="dialog_${i}.close()">Close</button>
            <button role="button" id="btn-submit-${i}" onclick="dialog_${i}.close()">Submit</button>
          </p>
        </article>
      </dialog>
     <style>
dialog.fill::backdrop {
  background: black;
  opacity: 0.7;
}

dialog.fill{
  border-radius: .3em;
  article {
    background: white;
    width: 40em;
  }
  textarea {
    width: 100%;
    height: 6em;
  }
  input {
    width: 100%;
  }
}
.fill_btn {
  cursor: pointer;
  margin-left: .5em;
  color: yellow;
  background: black;
  width: 6em;
  height: 100%;
  display: flex;
  align-content: center;
  justify-content: center;
  align-items: center;
  font-weight: bold;
  text-align: center;
}
@keyframes spinner {
  to {transform: rotate(360deg);}
}
 
.spinner:before {
  content: '';
  box-sizing: border-box;
  position: absolute;
  top: 50%;
  left: 50%;
  width: 20px;
  height: 20px;
  margin-top: -10px;
  margin-left: -10px;
  border-radius: 50%;
  border: 2px solid #ccc;
  border-top-color: #000;
  animation: spinner .6s linear infinite;
}
</style> 
    `;

    const dialogContainer = document.createElement('div');
    dialogContainer.innerHTML = dialogHtml;
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.parentElement.appendChild(dialogContainer);

    document
      .getElementById(`btn-submit-${i}`)
      .addEventListener('click', () => submitForm(submitButton, form, i));
  });
};
```

Finally we got to the point where we can submit our request to OpenAI API and fill the form with the response.

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

// Initialize the form setup
setupForms();
```

### Where we can go with it?

This script can be further improved by adding more advanced features like handling file uploads, handling dynamic forms, etc.
Possible further developments:

- `browser extension` that will automatically fill the forms on the page based on stored profiles.

- we can create `AI Agent` which fills up forms on our behalf.

- we can create `automated data entry tool` that will fill the forms based on the data from the database or any other source.

- use LLM to generate `generate fake data` in scenarios where we need to preserve out privacy.

- We can extend script with some persistance layer to store filled values so we can use them in future.

- In case of very complex forms with big number of fields brake the form into smaller parts (fieldsets) and fill them separately.

### Conclusion

This script should work with most forms. However if form is dynamic (some form elements are change or activated on user input) or uses some advanced features like file upload or is built in non standard or erroneous way it may not work as expected. In such cases you may need to adjust the script to handle these cases.

I hope you found this article useful and that you learned something new. If you have any questions or suggestions, feel free to leave a comment below.

Check out the script in action creating bookmarklet out of this script [here](https://raw.githubusercontent.com/k1000/articles/main/formaline/bookmarklet.js).

You can view whole [script here](https://github.com/k1000/articles/blob/main/formaline/formaline.js)
