/*
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const axios = require('axios').default;
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

/**
 * @param {string} url
 * @param {string} filename
 */
async function audit(url, filename) {
  const {data} = await axios.get(url);
  // Lint the Markdown.
  // These rules are from markdownlint and documented here:
  //   https://github.com/markdownlint/markdownlint/blob/master/docs/RULES.md
  // They seem to result in _named_ outputs.
  /** @type {linter.Options} */
  const options = {
    strings: {},
    config: {
      default: false,
      MD001: true,
      MD013: false, // line length check disabled
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
        if (new RegExp(words[key].pattern, 'i').test(line)) {
          output[key] ? output[key].push(index + 1) : output[key] = [index + 1];
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