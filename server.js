require('dotenv').config();

const express = require('express');
const app = express();
const axios = require('axios');
// https://github.com/octokit/core.js#readme
const { Octokit } = require("@octokit/core");
const octokit = new Octokit({auth: process.env.GITHUB});
const markdown = require('./markdown.js');
const psi = require('./psi.js');
const {actions, audit} = require('./bot.js');

app.use(express.json());

app.post('/', function(request, response) {
  const data = request.body;
  const action = data.action;
  if (!actions.hasOwnProperty(action)) {
    response.end();
    return;
  }
  // actions[action](data, response);
  response.end();
});

app.get('/', async (request, response) => {
  const data = await audit(4363);
  response.header('Content-Type', 'application/json');
  response.send(JSON.stringify({data}, null, 2));
});

const listener = app.listen(12345, function() {
  console.log(`App is running on http://localhost:${listener.address().port}`);
});
