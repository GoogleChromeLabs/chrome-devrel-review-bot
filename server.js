require('dotenv').config();

const express = require('express');
const app = express();
const {actions, audit} = require('./bot.js');

app.use(express.json());

// Listen for issue_comment [1] and pull_request [2] events.
// [1] https://docs.github.com/en/developers/webhooks-and-events/webhook-events-and-payloads#issue_comment
// [2] https://docs.github.com/en/developers/webhooks-and-events/webhook-events-and-payloads#pull_request
app.post('/', function(request, response) {
  const data = request.body;
  // This is the key routing logic. Essentially, we
  // just pass the event to bot.js via the `actions` handler.
  // Each key of `actions` is one of the event names that GitHub
  // uses to indicate different types of events. If we don't
  // have a function defined for that key then we ignore the webhook event.
  const action = data.action;
  if (!actions.hasOwnProperty(action)) {
    response.end();
    return;
  }
  actions[action](data);
  console.log(data.action);
  response.end();
});

if (process.env.DEV) {
  app.get('/', async (request, response) => {
    const {ORG, REPO, PR} = process.env;
    // Manually pass the PR that you want to test as the argument to audit().
    const data = await audit(ORG, REPO, PR);
    response.header('Content-Type', 'application/json');
    response.send(JSON.stringify(data, null, 2));
  });
}

const listener = app.listen(process.env.PORT, function() {
  console.log(`App is running on http://localhost:${listener.address().port}`);
});
