# reviewbot

Automated reviews of web.dev pull requests.

## Development

```
GITHUB=…
PSI=…
PORT=8080
DEV=true
PR=…
```

## Overview

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