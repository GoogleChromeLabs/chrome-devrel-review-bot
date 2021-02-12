const axios = require('axios');
const linter = require('markdownlint');

const defaultCheck = data => data.lines === 0;

const results = {
  "line-length": data => {
    data.pass = data.lines.length < 10;
    return data;
  },
  "single-trailing-newline": data => {
    data.pass = defaultCheck(data);
    return data;
  },
  "heading-increment": data => {
    data.pass = defaultCheck(data);
    return data;
  },
  "blanks-around-headings": data => {
    data.pass = defaultCheck(data);
    return data;
  },
  "fenced-code-language": data => {
    data.pass = defaultCheck(data);
    return data;
  },
  "words": data => {
    data.pass = Object.keys(data).length === 0;
    return data;
  }
};

function organize(data) {
  let output = {};
  data.forEach(violation => {
    const id = violation.ruleNames[1];
    if (!output[id]) {
      output[id] = {
        lines: []
      };
    }
    output[id].lines.push(violation.lineNumber);
  });
  return output;
}

async function audit(url, filename) {
  const {data} = await axios.get(url);
  // Lint the Markdown.
  const options = {
    strings: {},
    config: {
      default: false,
      MD001: true,
      MD013: {
        line_length: 100
      },
      MD022: true,
      MD040: true,
      MD047: true // https://unix.stackexchange.com/a/18789/79351
    }
  };
  options.strings[filename] = data;
  let output = linter.sync(options);
  output = organize(output[filename]);
  // Check for problematic words.
  function flagWords(data) {
    const words = require('../words.json');
    const lines = data.split('\n');
    const output = {};
    lines.forEach((line, index) => {
      for (const key in words) {
        if (new RegExp(words[key].pattern).test(line)) {
          output[key] ? output[key].push(index) : output[key] = [index];
        }
      }
    });
    return output;
  }
  output.words = flagWords(data);
  for (const key in output) {
    output[key] = results[key](output[key]);
  }
  return output;
}

module.exports = {
  audit
};