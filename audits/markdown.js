const axios = require('axios');
const linter = require('markdownlint');

const interpretations = {
  "line-length": data => {
    // TODO
  },
  "single-trailing-newline": data => {
    // TODO
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
        line_length: 100,
        code_block_line_length: 80
      },
      MD022: true,
      MD040: true,
      MD047: true // https://unix.stackexchange.com/a/18789/79351
    }
  };
  options.strings[filename] = data;
  const rawResults = linter.sync(options);
  const organizedResults = organize(rawResults[filename]);
  // TODO loop through organizedResults here and pass to interpretations
  return organizedResults;
}

module.exports = {
  audit
};