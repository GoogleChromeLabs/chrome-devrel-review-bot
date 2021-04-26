# reviewbot

Automated reviews of web.dev pull requests.

## Deploying

1. Go to [https://glitch.com/edit/#!/reviewbot](https://glitch.com/edit/#!/reviewbot).
1. Click **Tools** > **Import and Export** > **Import from GitHub**.
1. Enter the name of the repository (e.g. `kaycebasques/reviewbot`) and click **OK**.

Make sure that the Glitch app is
[boosted](https://glitch.happyfox.com/kb/article/73-boosted-apps-what-s-that/)
so that it is already running when it receives `POST` messages from GitHub
and will be able to respond quickly.

## Development/debugging

Follow these instructions if you want to develop/debug reviewbot
locally.

1. Create a test pull request (PR) that triggers the conditions you
   want to develop/debug.
1. Create an `.env` file and add the following values:

       GITHUB=…
       PSI=…
       PORT=8080
       DEV=true
       PR=…
       ORG=…
       REPO=…

   `GITHUB` should be the GitHub API key for reviewbot. `PSI` should be
   reviewbot's PageSpeed Insights API key. The values for `GITHUB` and
   `PSI` are available on Google's internal system for sharing passwords
   (search for `reviewbot`). `PR` is the number of the pull request that
   you want to test. `ORG` is the organization/user that owns the repository.
   `REPO` is the repository. For example, given a pull request URL like
   `https://github.com/googlechrome/web.dev/pull/688`, `googlechrome` is the
   organization/user, `web.dev` is the repository, and `688` is the pull request number.

1. Run `npm run dev`.

1. Navigate to `localhost:8080` (replace `8080` with whatever value
   you provided for `PORT` in `.env`).

Since reviewbot is a GitHub [webhook] bot, the production version of reviewbot
really only uses/listens for `POST` messages. Therefore we can use `GET`
messages for debugging/development purposes. That's what the workflow above
does. In other words when you load `localhost:8080` from a browser, the `GET`
listener in `server.js` is triggered. And that listener is purely for
debugging/development. The `GET` listener basically just audits a single,
specific PR (the one that you specify in `.env`) and then returns the results as
JSON. So you can look at the JSON results of the audit in your browser.

Every time that you reload `localhost:8080`, the auto-generated comment that
gets posted to the GitHub pull request will also get updated. Look for the
text `THIS IS A DEVELOPMENT BUILD OF REVIEWBOT` to make sure that the comment
was generated from your development build, not the production build of reviewbot.
On that note, keep in mind that the production build is always running, so it's
possible for the production build to interfere with your development build
if you dramatically change the code.

## Architecture overview

This section explains the lifecycle of the bot.

1. A pull request (PR) is created or updated.
1. GitHub sends a POST message to `reviewbot.glitch.me`. This happens
   because we have set up a [webhook] from the web.dev repository to this URL.
1. The POST handler in `server.js` receives the events from GitHub.
1. The POST handler routes the event data to `bot.js`. We only act on a few
   relevant events, such as a PR being created, a comment being updated, etc.
1. `bot.js` gathers the source code files associated to the PR.
1. `bot.js` only proceeds if the PR is creating or updating Markdown files.
1. `bot.js` runs audits on the Markdown files. All of the audits are handled
   in `audits/markdown.js`. Right now we're only using a Markdown linter.
   In the future we'll probably want to do other analyses on the Markdown,
   such as checking for incorrect words.
1. `bot.js` creates a comment summarizing the results of the analysis.
   The comment also contains direct links to the new or updates pages
   for the author's convenience.
1. As the PR is updated, the comment is replaced with new information
   (rather than creating new comments, which could get spammy). We detect
   the old comment by looking for a unique string embedded within
   the comment (it's an HTML comment).

[webhook]: https://docs.github.com/en/developers/webhooks-and-events/about-webhooks