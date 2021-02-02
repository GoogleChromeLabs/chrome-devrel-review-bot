// https://github.com/octokit/core.js#readme
const { Octokit } = require('@octokit/core');
const octokit = new Octokit({auth: process.env.GITHUB});
const constants = require('./constants.json');
const markdown = require('./audits/markdown.js');
// const psi = require('./audits/psi.js');
// const dom = require('./audits/dom.js');
const instructions = require('./instructions.json');

// The keys of this object match the names of the relevant GitHub webhook event
// that we're responding to.
const actions = {
  // Pull request was opened.
  opened: data => {
    audit(data.number);
  },
  // A new comment was created on the pull request.
  created: data => {
    // TODO(kaycebasques): Check if it was Netlify and only re-run audit if so.
    audit(data.issue.number);
  },
  // A comment on the pull request was edited.
  edited: data => {
    audit(data.issue.number)
  },
  // Some of the code in the pull request changed.
  synchronize: data => {
    audit(data.number);
  }
};

const audit = async number => {

  // Store data about the pull request.
  let data = {
    files: {},
    number
  };  
  // Get the files that are affected by the pull request.
  const files = await octokit.request({
    method: 'GET',
    url: `/repos/googlechrome/web.dev/pulls/${number}/files`
  });
  // Check for new content, modified content, or images.
  const newContent =
      files.data.filter(file => file.status === constants.files.added &&
          file.filename.toLowerCase().endsWith('.md'));
  const modifiedContent =
      files.data.filter(file => file.status === constants.files.modified &&
          file.filename.toLowerCase().endsWith('.md'));
  const images =
      files.data.filter(file => file.filename.toLowerCase().endsWith('.png') ||
          file.filename.toLowerCase().endsWith('.jpg'));
  // Bail if the PR doesn't touch any content files.
  if (newContent.length === 0 && modifiedContent.length === 0) return;

  // Function for converting Markdown files that the PR is creating/editing into URLs.
  const getStagingUrl = (number, path) => {
    const s1 = path.substring(0, path.lastIndexOf('/'));
    const s2 = s1.substring(s1.lastIndexOf('/') + 1);
    return `https://deploy-preview-${number}--web-dev-staging.netlify.app/${s2}/`;
  };

  // Store data about the new or modified content.
  if (newContent.length > 0) {
    newContent.forEach(file => {
      data.files[file.filename] = {
        status: constants.files.added,
        url: getStagingUrl(number, file.filename),
        raw: file.raw_url,
        audits: {}
      };
    });
  }
  if (modifiedContent.length > 0) {
    modifiedContent.forEach(file => {
      data.files[file.filename] = {
        status: constants.files.modified,
        url: getStagingUrl(number, file.filename),
        raw: file.raw_url,
        audits: {}
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
    url: `/repos/googlechrome/web.dev/issues/${number}/comments`
  });
  // Check for the auto-generated staging URLs comment.
  const shouldShowStagingUrls =
      comments.data.filter(comment => comment.body.includes(constants.comments.staging)).length > 0;
  // Check for the auto-generated reviewbot comment.
  const reviewBotComment = comments.data.filter(comment => {
    return comment.body.includes(constants.comments.reviewbot);
  });

  // Function for creating the automated comment.
  const createComment = (data, showStagingUrls) => {
    const createStagingUrlsContent = data => {
      let comment = '## Staging URLs\n\n';
      comment += 'For your convenience, here are direct links (on our staging site) to the content you created or updated:\n\n';
      for (const path in data.files) {
        const file = data.files[path];
        comment += `* ${file.url}\n`;
      }
      return comment;
    };
    const createFileContent = (pathname, data) => {
      let content = `### \`${pathname}\`\n\n`;
      let sentinel = true;
      for (const key in data.audits.markdown) {
        const audit = data.audits.markdown[key];
        if (!audit.pass) {
          content += `* ${instructions[key]} Affected lines: ${audit.lines.join(', ')}\n`;
          sentinel = false;
        }
      }
      if (sentinel) content += '* This file passed all of our automated Markdown audits.\n\n';
      return content;
    };
    let comment = 'Hello! This is an automated review by our custom [reviewbot](https://github.com/kaycebasques/reviewbot). It updates automatically when code or GitHub comments in this pull request are created or updated.\n\n';
    if (showStagingUrls) comment += createStagingUrlsContent(data);
    comment += '## Requested changes\n\n';
    comment += 'If there are any common problems with the content files you created or modified, they will be listed here.\n\n';
    for (const path in data.files) {
      comment += createFileContent(path, data.files[path]);
    }
    comment += `<!-- Comment ID: ${constants.comments.reviewbot} -->`;
    return comment;
  };

  // Create the comment if it doesn't exist.
  if (reviewBotComment.length === 0) {
    await octokit.request({
      accept: 'application/vnd.github.v3+json',
      method: 'POST',
      url: `/repos/googlechrome/web.dev/issues/${data.number}/comments`,
      body: createComment(data, shouldShowStagingUrls)
    });
  }
  // Otherwise just update it.
  if (reviewBotComment.length === 1) {
    await octokit.request({
      accept: 'application/vnd.github.v3+json',
      method: 'PATCH',
      url: `/repos/googlechrome/web.dev/issues/comments/${reviewBotComment[0].id}`,
      body: createComment(data, shouldShowStagingUrls)
    });
  }
  // Return the final data. Only for debugging purposes.
  return data;
};

module.exports = {
  actions,
  audit
}