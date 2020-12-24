const axios = require('axios');
const linter = require('markdownlint');
const descriptions = require('./descriptions.json');
const constants = require('./constants.json');

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
    output[id].description = descriptions[id];
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
        line_length: 100,
        code_block_line_length: 80
      },
      MD022: true,
      MD040: true,
      MD047: true // https://unix.stackexchange.com/a/18789/79351
    }
  };
  options.strings[filename] = data;
  const results = linter.sync(options);
  return organize(results[filename]); // change
}

module.exports = {
  audit
};