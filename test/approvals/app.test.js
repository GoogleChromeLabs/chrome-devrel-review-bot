const fs = require('fs');
const path = require('path');
const nock = require('nock');
const axios = require('axios');
// Requiring our app implementation
const Approvals = require('../../approvals/app');
const { Probot, ProbotOctokit } = require('probot');
// Requiring our fixtures
const payload = require('./fixtures/pull_request.edited');
const checkRunSuccess = require('./fixtures/check_run.success');
const checkRunNoApprovals = require('./fixtures/check_run.no_approvals');
const checkRunApprovalMissing = require('./fixtures/check_run.approval_missing');

// Configure Axios to use Node adapter (@see https://github.com/nock/nock#axios)
axios.defaults.adapter = require('axios/lib/adapters/http');

const privateKey = fs.readFileSync(
  path.join(__dirname, 'fixtures/mock-cert.pem'),
  'utf-8'
);

describe('Approvals', () => {
  let probot;
  let mock;

  const opts = {
    'Content-Type': 'application/json',
  };

  beforeEach(() => {
    nock.disableNetConnect();

    // Mock Github requests
    nock('https://raw.githubusercontent.com')
      .get('/devnook/developer.chrome.com/main/.github/chrome-devrel-bot.json')
      .replyWithFile(200, __dirname + '/fixtures/config.json')

    mock = nock('https://api.github.com')
      .post('/app/installations/24733797/access_tokens')
      .reply(200, {
        token: 'test',
        permissions: {
          checks: 'write',
        },
      })
      // Mock files request
      .get('/repos/devnook/developer.chrome.com/pulls/6/files', )
      .replyWithFile(200, __dirname + '/fixtures/files.json', {
        'Content-Type': 'application/json',
      });

    probot = new Probot({
      appId: 123,
      privateKey,
      // disable request throttling and retries for testing
      Octokit: ProbotOctokit.defaults({
        retry: { enabled: false },
        throttle: { enabled: false },
      }),
    });
    // Load our app into probot
    probot.load(Approvals);
  });

  test('Creates a SUCCESS check for approved PR', async () => {
    mock
      // Mock reviews request
      .get('/repos/devnook/developer.chrome.com/pulls/6/reviews', )
      .replyWithFile(200, __dirname + '/fixtures/reviews_approved.json', opts)
      // Expected request
      .post('/repos/devnook/developer.chrome.com/check-runs', (body) => {
        body.started_at = '2018-10-05T17:35:21.594Z';
        expect(body).toMatchObject(checkRunSuccess);
        return true;
      })
      .reply(200);

    // Receive a webhook event
    await probot.receive({ name: 'pull_request', payload });
    expect(mock.pendingMocks()).toStrictEqual([]);
  });

  test('Creates a FAILURE check for a rejected PR', async () => {
    mock
      // Mock reviews request
      .get('/repos/devnook/developer.chrome.com/pulls/6/reviews', )
      .replyWithFile(200, __dirname + '/fixtures/reviews_rejected.json', opts)
      // Expected request
      .post('/repos/devnook/developer.chrome.com/check-runs', (body) => {
        body.started_at = '2018-10-05T17:35:21.594Z';
        expect(body).toMatchObject(checkRunNoApprovals);
        return true;
      })
      .reply(200);

    // Receive a webhook event
    await probot.receive({ name: 'pull_request', payload });
    expect(mock.pendingMocks()).toStrictEqual([]);
  });

  test('Creates a FAILURE check for a missing content approval', async () => {
    mock
      // Mock reviews request
      .get('/repos/devnook/developer.chrome.com/pulls/6/reviews', )
      .replyWithFile(200, __dirname + '/fixtures/reviews_approved_rejected.json', opts)
      // Expected request
      .post('/repos/devnook/developer.chrome.com/check-runs', (body) => {
        body.started_at = '2018-10-05T17:35:21.594Z';
        expect(body).toMatchObject(checkRunApprovalMissing);
        return true;
      })
      .reply(200);

    // Receive a webhook event
    await probot.receive({ name: 'pull_request', payload });
    expect(mock.pendingMocks()).toStrictEqual([]);
  });


  test('Creates a FAILURE check for a an unreviewed PR', async () => {
    mock
      // Mock reviews request
      .get('/repos/devnook/developer.chrome.com/pulls/6/reviews', )
      .replyWithFile(200, __dirname + '/fixtures/reviews_empty.json', opts)
      // Expected request
      .post('/repos/devnook/developer.chrome.com/check-runs', (body) => {
        body.started_at = '2018-10-05T17:35:21.594Z';
        expect(body).toMatchObject(checkRunNoApprovals);
        return true;
      })
      .reply(200);

    // Receive a webhook event
    await probot.receive({ name: 'pull_request', payload });
    expect(mock.pendingMocks()).toStrictEqual([]);
  });

  afterEach(() => {
    nock.cleanAll();
    nock.enableNetConnect();
  });
});
