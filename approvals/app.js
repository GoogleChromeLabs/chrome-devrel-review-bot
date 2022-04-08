/**
 * @param {import('probot').Probot} app
 */
module.exports = (app) => {
  app.on("pull_request.edited", async (context) => {
    const startTime = new Date();
    let result = {
      status: 'completed',
      conclusion: 'success',
      output: {
        title: 'Approvals failed 444',
        summary: `All required approvals are granted`
      }
    };
    let owner = context.payload.repository.full_name.split('/')[0]
    let repo = context.payload.repository.name;
    let headSha = context.payload.pull_request.head.sha;

    return await context.octokit.checks.create({
      headers: {
        accept: "application/vnd.github.v3+json"
      },
      owner,
      repo,
      name: "Chrome Devrel PR checks",
      started_at: startTime,
      head_sha: headSha,
      ...result,
    });
  });
};
