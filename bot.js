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

// https://github.com/octokit/core.js#readme
const { Octokit } = require('@octokit/core');
const octokit = new Octokit({auth: process.env.GITHUB});
const constants = require('./constants.json');
const markdown = require('./audits/markdown.js');
const instructions = require('./instructions.json');
const words = require('./words.json');

// The keys of this object match the names of the relevant GitHub webhook action
// that we're responding to.
const actions = {
  // Pull request was opened.
  opened: data => {
    audit(data.organization.login, data.repository.name, data.number);
  },
  // A new comment was created on the pull request.
  created: data => {
    if (!data.issue) {
      return;
    }
    audit(data.organization.login, data.repository.name, data.issue.number);
  },
  // A comment on the pull request or the pull request itself was edited.
  edited: data => {
    const number = data.issue ? data.issue.number : data.number;
    audit(data.organization.login, data.repository.name, number);
  },
  // Some of the code in the pull request changed.
  synchronize: data => {
    audit(data.organization.login, data.repository.name, data.number);
  },
};

/**
 * @param {string} org
 * @param {string} repo
 * @param {string|number} number
 */
async function audit(org, repo, number) {
  // Store data about the pull request.
  let data = {
    files: {},
    number,
  };
  // Get the files that are affected by the pull request.
  let files = [];
  let response;
  let page = 1;
  do {
    response = await octokit.request({
      method: 'GET',
      url: `/repos/${org}/${repo}/pulls/${number}/files?page=${page}`
    });
    files = files.concat(response.data);
    page += 1;
  } while (response.data.length === 30);
  // Check for new content, modified content, or images.
  // TODO(kaycebasques): Refactor to first gather content files. Then filter for modified or added.
  const newContent =
      files.filter(file => file.status === constants.files.added &&
          file.filename.toLowerCase().endsWith('.md'));
  const modifiedContent =
      files.filter(file => file.status === constants.files.modified &&
          file.filename.toLowerCase().endsWith('.md'));

  const images =
      files.filter(file => file.filename.toLowerCase().endsWith('.png') ||
          file.filename.toLowerCase().endsWith('.jpg'));
  // Bail if the PR doesn't touch any content files.
  if (newContent.length === 0 && modifiedContent.length === 0) {
    return;
  }

  // Store data about the new or modified content.
  if (newContent.length > 0) {
    newContent.forEach(file => {
      data.files[file.filename] = {
        status: constants.files.added,
        raw: file.raw_url,
        audits: {},
      };
    });
  }
  if (modifiedContent.length > 0) {
    modifiedContent.forEach(file => {
      data.files[file.filename] = {
        status: constants.files.modified,
        raw: file.raw_url,
        audits: {},
      };
    });
  }

  // Audit the files.
  for (const path in data.files) {
    const file = data.files[path];
    file.audits.markdown = await markdown.audit(file.raw, path);
  }

  // Get the comments on the pull request.
  const comments = await octokit.request({
    accept: 'application/vnd.github.v3+json',
    method: 'GET',
    url: `/repos/${org}/${repo}/issues/${number}/comments`,
  });

  // Function for creating the automated comment.
  const createComment = (data) => {
    const createFileContent = (pathname, data) => {
      let content = `### \`${pathname}\`\n\n`;
      let sentinel = true;
      for (const key in data.audits.markdown) {
        const audit = data.audits.markdown[key];
        if (!audit.pass) {
          if (key === 'words') {
            content += `* ${instructions[key]}\n`;
            for (const word in data.audits.markdown[key]) {
              if (word === 'pass') continue;
              content += `  * ${words[word].instruction} Affected lines: ${data.audits.markdown[key][word].join(', ')}\n`;
            }
          } else {
            content += `* ${instructions[key]} Affected lines: ${audit.lines.join(', ')}\n`;
          }
          sentinel = false;
        }
      }
      if (sentinel) content += '* This file passed all of our automated Markdown audits.\n\n';
      return content;
    };
    let comment = 'Hello! This is an automated review by our custom [reviewbot](https://github.com/GoogleChromeLabs/chrome-devrel-review-bot). It updates automatically when code or GitHub comments in this pull request are created or updated.\n\n';
    if (process.env.DEV) {
      comment += 'THIS IS A DEVELOPMENT BUILD OF REVIEWBOT.\n\n';
    }
    comment += '## Requested changes\n\n';
    comment += 'If there are any common problems with the content files you created or modified, they will be listed here.\n\n';
    for (const path in data.files) {
      comment += createFileContent(path, data.files[path]);
    }
    comment += `<!-- Comment ID: ${constants.comments.reviewbot} -->\n`;
    if (process.env.DEV) {
      comment += `<!-- ${constants.comments.dev} -->`;
    }
    return comment;
  };

  // Check for the auto-generated reviewbot comment.
  const reviewBotComment = comments.data.filter(comment => {
    return comment.body.includes(constants.comments.reviewbot);
  });

  // Create the auto-generated reviewbot comment if it does not yet exist.
  if (reviewBotComment.length === 0) {
    await octokit.request({
      accept: 'application/vnd.github.v3+json',
      method: 'POST',
      url: `/repos/${org}/${repo}/issues/${number}/comments`,
      body: createComment(data),
    });
  }

  // Update the existing comment (under certain conditions) if it already exists.
  if (reviewBotComment.length === 1) {
    const dev = reviewBotComment[0].body.includes(constants.comments.dev);
    // Only update if the PR is not flagged for reviewbot development/debugging (!dev)
    // or it is flagged but we're running the development version of reviewbot (dev && process.env.DEV).
    if (!dev || (dev && process.env.DEV)) {
      await octokit.request({
        accept: 'application/vnd.github.v3+json',
        method: 'PATCH',
        url: `/repos/${org}/${repo}/issues/comments/${reviewBotComment[0].id}`,
        body: createComment(data),
      });
    }
  }

  // Return the final data. Only for debugging purposes.
  return data;
};

module.exports = {
  actions,
  audit,
};
