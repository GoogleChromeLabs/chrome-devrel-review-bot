/*
 * Copyright 2022 Google LLC
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

const micromatch = require('micromatch');
const fetch = require('node-fetch');

const CHECK_RESULTS = {
  success: {
    conclusion: 'success',
    title: 'Approvals complete',
    summary: 'All required approvals are granted'
  },
  approval_missing: {
    conclusion: 'failure',
    title: 'Approvals missing',
    summary: 'At least one approving review is required'
  },
  no_config: {
    conclusion: 'cancelled',
    title: 'Missing config file',
    summary: 'The config file does not exist'
  },
  no_files: {
    conclusion: 'cancelled',
    title: 'Missing PR files',
    summary: 'No changed files found'
  }
}

/**
 * Main entrypoint to the Probot app
 * @param {import('probot').Probot} app
 */
module.exports = (app) => {

  app.on([
    'pull_request.opened',
    'pull_request.reopened',
    'pull_request.ready_for_review',
    'pull_request.edited',
  ], checkPR);

  async function createCheck(octokit, checkOptions, result) {
    return await octokit.checks.create({
      ...checkOptions,
      ...result,
    });
  }

  function createCompletedResult({conclusion, title, summary}) {
    return {
      status: 'completed',
      conclusion,
      output: {
        title,
        summary
      }
    };
  }

  async function getFiles(octokit, checkOptions, pullNumber) {
    const filesRequest = await octokit.rest.pulls.listFiles({
      owner: checkOptions.owner,
      repo: checkOptions.repo,
      pull_number: pullNumber,
    });
    if (filesRequest.status !== 200) {
      result = createCompletedResult(CHECK_RESULTS.no_files);
      await createCheck(octokit, checkOptions, result);
      return null;
    }
    return filesRequest.data;
  }

  async function getReviews(octokit, checkOptions, pullNumber) {
    const reviewsRequest = await octokit.rest.pulls.listReviews({
      owner: checkOptions.owner,
      repo: checkOptions.repo,
      pull_number: pullNumber,
    });
    if (reviewsRequest.status !== 200) {
      result = createCompletedResult(CHECK_RESULTS.approval_missing);
      await createCheck(octokit, checkOptions, result);
      return null;
    }
    return reviewsRequest.data;
  }

  async function checkPR(context) {
    const startTime = new Date();
    const pullRequest = context.payload.pull_request;
    if (pullRequest.state !== 'open' || pullRequest.draft) {
      return;
    }

    const octokit = context.octokit;
    const headSha = pullRequest.head.sha;
    const owner = context.payload.repository.full_name.split('/')[0];
    const repo = context.payload.repository.name;
    const pullNumber = pullRequest.number;
    let result;

    const checkOptions = {
      headers: {
        accept: "application/vnd.github.v3+json"
      },
      name: "Chrome DevRel PR checks",
      started_at: startTime,
      head_sha: headSha,
      owner,
      repo
    };

    // Get Config file
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/main/.github/chrome-devrel-bot.json`;
    const response = await fetch(url);
    let config;
    if (response.ok) {
      const body = await response.text();
      config = JSON.parse(body);
    } else {
      result = createCompletedResult(CHECK_RESULTS.no_config);
      return await createCheck(octokit, checkOptions, result);
    }

    // Get PR files
    const files = await getFiles(octokit, checkOptions, pullNumber);
    if (!files) {
      return;
    }
    const paths = files.map(file => file.filename);

    // Get PR reviews
    const reviews = await getReviews(octokit, checkOptions, pullNumber);
    if (!reviews) {
      return;
    }
    const approvers = [];
    for (const review of reviews) {
      if (review.state === 'APPROVED') {
        approvers.push(review.user.login);
      }
    }
    if (!approvers.length) {
      result = createCompletedResult(CHECK_RESULTS.approval_missing);
      return await createCheck(octokit, checkOptions, result);
    }

    for (const check of config.pr_checks.approvals) {
      const isCheckRequired = micromatch(paths, check.paths, {'dot': true}).length > 0;
      if (isCheckRequired) {
        const isApproved = approvers.some(login => check.users.includes(login));
        if (!isApproved) {
          result = createCompletedResult(CHECK_RESULTS.approval_missing);
          result.output.summary = `${check.check_name} failed`;
          return await createCheck(octokit, checkOptions, result);
        }
      }
    }

    result = createCompletedResult(CHECK_RESULTS.success);
    return await createCheck(octokit, checkOptions, result);
  }
};
