const getEleDesc = (ele) => {
  const labelsStr = Array.from(ele.labels)
    .map((l) => l.innerText)
    .join(', ');
  const placeholderStr = ele.placeholder;
  return `${labelsStr} ${placeholderStr}`.trim();
};

function formatName(name) {
  // Property keys should match pattern '^[a-zA-Z0-9_-]{1,64}$'
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 63);
}

function processInput(input) {
  const { name, type, id, value, placeholder, required } = input;
  // Skip input with value
  if (value) return;
  // Skip input without a name
  if (!name) return;

  const schema = { type: 'string', name: name };
  schema.description = getEleDesc(input);
  return [formatName(name), schema, required];
}

function processSelect(select) {
  const { name, required } = select;
  if (!name) return;
  const schema = { type: 'string', enum: [] };
  Array.from(select.options).forEach((option) => {
    // Add the option to the schema
    schema.enum.push(option.value);
  });
  schema.description = getEleDesc(select);
  schema.name = name;
  return [formatName(name), schema, required];
}

function processTextArea(textArea) {
  const { name, id, required } = textArea;
  if (!name) return;
  const schema = { type: 'string' };
  schema.description = getEleDesc(textArea);
  schema.name = name;
  return [formatName(name), schema, required];
}

function fillForm(formFields, formData) {
  formData.forEach(([n, v]) => {
    const fieldDef = formFields[n];
    const fieldName = fieldDef.name;
    const fieldElement = document.querySelector(`[name="${fieldName}"]`);
    if (fieldElement) {
      fieldElement.value = v;
    }
  });
}

function callAnthropicAPI({ api_key, model, max_tokens, tools, messages }) {
  return fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': api_key,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'tools-2024-04-04',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: model ?? 'claude-3-opus-20240229',
      max_tokens: max_tokens ?? 1024,
      tools: tools,
      messages: messages,
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      return data;
      // Handle the response data here
    })
    .catch((error) => {
      // Handle any errors here
      console.error('Error:', error);
    });
}

async function callOpenAiAPI({ api_key, model, max_tokens, tools, messages }) {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${api_key}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: model ?? 'gpt-4o',
        max_tokens: max_tokens ?? 3024,
        temperature: 0,
        tools: tools,
        messages: messages,
      }),
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error:', error);
  }
}

const groupByName = (arr) =>
  Object.entries(
    arr.reduce((result, obj) => {
      const { name, value, id } = obj;
      if (!result[name]) {
        result[name] = [];
      }
      result[name].push({ const: value, id, title: getEleDesc(obj) });
      return result;
    }, {})
  );

function getDescription(ele) {
  const describe_id = ele.getAttribute('aria-describedby');
  if (describe_id) {
    return document.querySelector(`#${describe_id}`).innerText;
  }
}

function processCheckboxes([name, values]) {
  if (!name.endsWith('[]')) {
    // we have solitary checkbox
    console.log('solitary checkbox', name, values);
  }
  const e = document.querySelector(`[name="${name}"]`);
  const description = getDescription(e);
  const schema = {
    name,
    type: 'array',
    description,
    uniqueItems: true,
    // description: values.map((v) => v.description).join(', '),
    items: {
      oneOf: values,
    },
  };
  return [formatName(name), schema];
}

function processRadios([name, values]) {
  const e = document.querySelector(`[name="${name}"]`);
  const description = getDescription(e);
  const schema = {
    name,
    type: 'string',
    description,
    enum: values.map((v) => v.const),
  };
  return [formatName(name), schema];
}

function generateSchema(form) {
  // Select all form inputs, selects, and textareas
  const inputsEle = form.querySelectorAll(
    `input[type="text"], input[type="email"], input[type="number"], input[type="password"], input[type="tel"], input[type="url"], input[type="date"], input[type="time"], input[type="datetime-local"], input[type="month"], input[type="week"], input[type="color"], input[type="range"], input[type="search"]`
  );
  const checkboxEle = form.querySelectorAll(`input[type="checkbox"]`);
  const radiosEle = form.querySelectorAll(`input[type="radio"]`);
  const selectsEle = form.getElementsByTagName('select');
  const textAreasEle = form.getElementsByTagName('textarea');

  const inputs = Array.from(inputsEle)
    .map((input) => processInput(input))
    .filter((e) => e);

  const checkBoxes = groupByName(Array.from(checkboxEle)).map(
    processCheckboxes
  );
  const radios = groupByName(Array.from(radiosEle)).map(processRadios);

  const selects = Array.from(selectsEle)
    .map((select) => processSelect(select))
    .filter((e) => e);

  const textAreas = Array.from(textAreasEle)
    .map((textArea) => processTextArea(textArea))
    .filter((e) => e);
  const schemaProps = [
    ...inputs,
    ...checkBoxes,
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
      required: required,
      properties: Object.fromEntries(
        schemaProps.map(([name, schema]) => [name, schema])
      ),
    },
  };
}

function fillForm(formFields, inputData) {
  inputData.forEach(([n, v]) => {
    try {
      const fieldDef = formFields[n];
      const fieldName = fieldDef.name;
      const fieldElement = document.querySelector(`[name="${fieldName}"]`);
      if (Array.isArray(v)) {
        v.forEach((value) => {
          const checkbox = document.querySelector(
            `[name="${fieldName}"][value="${value}"]`
          );
          if (checkbox) checkbox.checked = true;
        });
      } else if (fieldElement.type === 'radio') {
        const radio = document.querySelector(`[name="${fieldName}"]`);
        radio.checked = true;
      } else if (fieldElement) {
        fieldElement.value = v;
      }
    } catch (error) {
      console.log('Error filling form', n);
      console.error(error);
    }
  });
}

const submitForm = async (form, formId) => {
  const formSchema = generateSchema(form);
  const _data = document.getElementById(`_data_${formId}`).value;
  const api_key = document.getElementById(`_api-key_${formId}`).value;
  const llm = await callOpenAiAPI({
    api_key,
    tools: [
      {
        type: 'function',
        function: formSchema,
      },
    ],
    tool_choice: 'auto',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'user',
        content: `call "fillup_form" with following data:
${_data}
          
No additional comments. only json data`,
      },
    ],
    response_format: 'json_object',
  });

  try {
    const rawData = llm.choices[0].message?.tool_calls[0].function.arguments;
    const inputData = Object.entries(JSON.parse(rawData));
    fillForm(formSchema.parameters.properties, inputData);
  } catch (error) {
    const rawData = llm.choices[0].message.content;
    const inputData = Object.entries(JSON.parse(rawData));
    fillForm(formSchema.parameters.properties, inputData);
  }
};

const forms = Array.from(document.getElementsByTagName('form'));

forms.forEach((form, i) => {
  const _div = document.createElement('div');
  _div.innerHTML = `
<a class="fill_btn" onclick="dialog_${i}.showModal()">Fill</a>
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
Skills/Talents: Acting, dancing, singing
Sports: Tennis, Soccer, Chess</textarea>
      </p>
      <p>
        <input type="password" placeholder="OpenAi API key" id="_api-key_${i}" required />
      </p>
      <p style="text-align: right">
        <button role="button" onclick="dialog_${i}.close()">
          Close
        </button>
        <button role="button" id="btn-submit-${i}" onclick="dialog_${i}.close()">
          Submit
        </button>
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
    background: #ecad11;
    width: 6em;
    height: 100%;
    display: flex;
    align-content: center;
    justify-content: center;
    align-items: center;
    font-weight: bold;
    text-align: center;
}
</style>`;
  const openBtn = form.querySelector(`button[type="submit"]`);
  openBtn.parentElement.appendChild(_div);
  const submitBtn = document.getElementById(`btn-submit-${i}`);
  submitBtn.addEventListener('click', () => submitForm(form, i));
});
