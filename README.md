# reviewbot

## Development

1. Create an `.env` file.
1. Add a [GitHub personal access token][github] to `.env`:

       GITHUB=…

1. Add a [PageSpeed Insights API key][psi] to `.env`:

       PSI=…

### Architecture

* The web.dev GitHub repo has been set up to send notifications

## todo

* https://www.npmjs.com/package/linkinator

## notes

It would be interesting to also prototype a workflow where docs
are part of the main development process. Put comments in the
code referencing docs that are impacted by a section of code.
If that code changes, the author has to review and manually
stamp the affected docs.

[github]: https://docs.github.com/en/github/authenticating-to-github/creating-a-personal-access-token
[psi]: https://developers.google.com/speed/docs/insights/v5/get-started#APIKey