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
  for (const key in output) {
    output[key] = results[key](output[key]);
  }
  return output;
}

module.exports = {
  audit
};