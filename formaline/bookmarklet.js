javascript: (function () {
  const getElementDescription = (element) => {
    const labelsText = Array.from(element.labels)
      .map((label) => label.innerText)
      .join(', ');
    return `${labelsText} ${element.placeholder || ''}`.trim();
  };

  const formatName = (name) =>
    name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 63);

  const getDescription = (element) => {
    const describeId = element.getAttribute('aria-describedby');
    return describeId ? document.querySelector(`#${describeId}`).innerText : '';
  };

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

  const callOpenAiAPI = async ({
    api_key,
    model = 'gpt-4',
    max_tokens = 3024,
    tools,
    messages,
  }) => {
    try {
      const response = await fetch(
        'https://api.openai.com/v1/chat/completions',
        {
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
        }
      );
      return await response.json();
    } catch (error) {
      console.error('Error calling OpenAI API:', error);
      throw error;
    }
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

  const setupForms = () => {
    const forms = Array.from(document.getElementsByTagName('form'));

    forms.forEach((form, i) => {
      const dialogHtml = `
      <a class="fill_btn" onclick="document.getElementById('dialog_${i}').showModal()">✨ Fill</a>
      <dialog class="fill" id="dialog_${i}">
        <article>
          <p>
            <textarea class="fill" placeholder="Your data" id="_data_${i}" required>Student Name: Emily Johnson
Student ID: 12345
Email: emily@example.com
Birthday: 04/12/1998
Address: 1234 Elm Street, Springfield, IL 62701
Phone: 217 8123438
Extra Curricular Activities: Swimming, Reading, Writing
Skills/Talents: acting, dancing, singing
Sports: Tennis, Soccer, Chess
i Have Any Scholarship
i want to work after collage</textarea>
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

  setupForms();
})();
