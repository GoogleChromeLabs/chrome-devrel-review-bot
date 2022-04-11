const micromatch = require('micromatch');
const fetch = require('node-fetch');
const YAML = require('yaml');

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
  no_approvals: {

  },
  no_config: {
    conclusion: 'cancelled',
    title: 'Missing config file',
    summary: '.github/chrome-devrel-bot.yml file does not exist'

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

  async function getFiles(octokit, checkOptions, pull_number) {
    const filesRequest = await octokit.rest.pulls.listFiles({
      owner: checkOptions.owner,
      repo: checkOptions.repo,
      pull_number,
    });
    if (!filesRequest.status === 200) {
      result = createCompletedResult(CHECK_RESULTS.no_files);
      await createCheck(octokit, checkOptions, result);
      return false;
    }
    return filesRequest.data;
  }

  async function getReviews(octokit, checkOptions, pull_number) {
    const reviewsRequest = await octokit.rest.pulls.listReviews({
      owner: checkOptions.owner,
      repo: checkOptions.repo,
      pull_number,
    });
    if (!reviewsRequest.status === 200) {
      result = createCompletedResult(CHECK_RESULTS.approval_missing);
      await createCheck(octokit, checkOptions, result);
      return false;
    }
    return reviewsRequest.data;
  }

  async function checkPR(context) {
    const startTime = new Date();
    const pull_request = context.payload.pull_request;
    if (pull_request.state !== 'open' || pull_request.draft) {
      return;
    }

    const octokit = context.octokit;
    const headSha = pull_request.head.sha;
    const owner = context.payload.repository.full_name.split('/')[0];
    const repo = context.payload.repository.name;
    const pull_number = pull_request.number;
    let result;

    const checkOptions = {
      headers: {
        accept: "application/vnd.github.v3+json"
      },
      name: "Chrome Devrel PR checks",
      started_at: startTime,
      head_sha: headSha,
      owner,
      repo
    };

    // Get Config file
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/main/.github/chrome-devrel-bot.yml`;
    const response = await fetch(url);
    let config;
    if (response.ok) {
      const body = await response.text();
      config = YAML.parse(body);
    } else {
      result = createCompletedResult(CHECK_RESULTS.no_config);
      return await createCheck(octokit, checkOptions, result);
    }

    // Get PR files
    const files = await getFiles(octokit, checkOptions, pull_number);
    if (!files) {
      return;
    }
    const paths = files.map(file => file.filename);

    // Get PR reviews
    const reviews = await getReviews(octokit, checkOptions, pull_number);
    if (!reviews) {
      return;
    }
    const approvers = reviews.map(review => {
      return review.state === "APPROVED" ? review.user.login : false;
    }).filter(approver => !!approver);
    if (!approvers.length) {
      result = createCompletedResult(CHECK_RESULTS.approval_missing);
      return await createCheck(octokit, checkOptions, result);
    }

    result = createCompletedResult(CHECK_RESULTS.success);

    for (const check of config.pr_checks.approvals) {
      const isCheckRequired = micromatch(paths, check.paths, {'dot': true}).length > 0;
      if (isCheckRequired) {
        const checkApprovers = new Set(check.users);
        const isApproved = approvers.filter(login => checkApprovers.has(login)).length > 0;
        if (!isApproved) {
          result = createCompletedResult(CHECK_RESULTS.approval_missing);
          result.output.summary = `${check.check_name} failed`;
          break;
        }
      }
    }
    return await createCheck(octokit, checkOptions, result);
  }
};
