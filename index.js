// Load environment variables from `.env` file (optional)
require('dotenv').config();

const slackEventsApi = require('@slack/events-api');
const SlackClient = require('@slack/client').WebClient;
const passport = require('passport');
const SlackStrategy = require('@aoberoi/passport-slack').default.Strategy;
const http = require('http');
const path = require('path');
const express = require('express');
const ndbx = require('node-dropbox');
const LocalStorage = require('node-localstorage').LocalStorage;
const localStorage = new LocalStorage('./scratch');
const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
var access_token = localStorage.getItem('access-token');
var slackaccess = localStorage.getItem('x-accesstoken');
const dropKey = process.env.DROPBOX_APP_KEY;
const dropSecret = process.env.DROPBOX_APP_SECRET;
const uuid = require('uuid/v4');
var dropToken;
 
// var api = ndbx.api(dropToken);

var trustProxy = false;

// *** Initialize event adapter using signing secret from environment variables ***
const slackEvents = slackEventsApi.createEventAdapter(process.env.SLACK_SIGNING_SECRET, {
  includeBody: true
});

// Initialize a data structures to store team authorization info (typically stored in a database)
const botAuthorizations = {}
var authToken;

// Helpers to cache and lookup appropriate client
// NOTE: Not enterprise-ready. if the event was triggered inside a shared channel, this lookup
// could fail but there might be a suitable client from one of the other teams that is within that
// shared channel.
const clients = {};
function getClientByTeamId(teamId) {
  if (!clients[teamId] && botAuthorizations[teamId]) {
    clients[teamId] = new SlackClient(botAuthorizations[teamId]);
  }
  if (clients[teamId]) {
    return clients[teamId];
  }
  return null;
}

// Initialize Add to Slack (OAuth) helpers
passport.use(new SlackStrategy({
  apiVersion: '2',
  clientID: process.env.SLACK_CLIENT_ID,
  clientSecret: process.env.SLACK_CLIENT_SECRET,
  skipUserProfile: true,
}, (accessToken, scopes, team, extra, profiles, done) => {
  localStorage.setItem('x-accesstoken', accessToken);
  authToken = accessToken;
  botAuthorizations[team.id] = extra.bot.accessToken;
  done(null, {});
}));



// Initialize an Express application
const app = express();

// Plug the Add to Slack (OAuth) helpers into the express app
app.use(passport.initialize());
app.get('/', (req, res) => {
  res.send('<div style="text-align: center;"><a href="/auth/slack"><img alt="Add to Slack" height="40" width="139" src="https://platform.slack-edge.com/img/add_to_slack.png" srcset="https://platform.slack-edge.com/img/add_to_slack.png 1x, https://platform.slack-edge.com/img/add_to_slack@2x.png 2x" /></a></div>');
});
app.get('/auth/slack', passport.authenticate('slack', {
  scope: ['bot']
}));
app.get('/auth/slack/callback',
  passport.authenticate('slack', { session: false }),
  (req, res) => {
    res.send('<p>Conversation Saver was successfully installed on your team.</p>');
  },
  (err, req, res, next) => {
    res.status(500).send(`<p>Horme Conversation Saver failed to install</p> <pre>${err}</pre>`);
  }
);

app.get('/login/dropbox', (req, res)=>{
  ndbx.Authenticate(dropKey, dropSecret, 'https://saverbyhorme.glitch.me/oauth/callback', (err, url) => {
	//console.log(url);
    res.redirect(url)
  });
});

app.get('/oauth/callback', (req, res) => {
  // console.log(req)
  var rescode = req.query.code;
  ndbx.AccessToken(dropKey, dropSecret, rescode, 'https://saverbyhorme.glitch.me/oauth/callback', (err, body) => {
	var access_token = body.access_token;
  // console.log(body);
  // localStorage.setItem('access-token', access_token);
  dropToken = access_token;
  res.redirect('/dropbox')
}); 
});

app.get('/dropbox', (req, res) => {
  res.send('Dropbox is now authenticated')
})

app.get('/login',(req, res) => {
  res.send('<div style="text-align: center;"><a href="/login/dropbox">Login to Dropbox</a></div>');
});


// *** Plug the event adapter into the express app as middleware ***
app.use('/slack/events', slackEvents.expressMiddleware());

// *** Attach listeners to the event adapter ***

// *** Greeting any user that says "hi" ***
slackEvents.on('message', (message, body) => {
    // Initialize a client
  const slack = getClientByTeamId(body.team_id);
  // Only deal with messages that have no subtype (plain messages) and contain 'hi'
  console.log(message);
  if (message.type == "message") {
    if (message.subtype == "bot_message") {
      return
    }
    handleMessage(message, body);
  }
    // Handle initialization failure
    if (!slack) {
      return console.error('No authorization found for this team. Did you install this app again after restarting?');
    }
    
    
    // Respond to the message back in the same channel
    // slack.chat.postMessage({ channel: message.channel, text: `Hello <@${message.user}>! :tada:` })
    //  .catch(console.error);
  
});
const date = Date.now();

const saveHistory = (history, message, slack) => {
  const dfs = require('dropbox-fs')({
    apiKey: dropToken
  });
  dfs.writeFile(
    `/slackchathistory/slack-chat-${date}.json`,
    history,
    { encoding: "utf8" },
    (err, stat) => {
      if (err) {
        return  console.log(err);//slack.chat.postMessage({ channel: message.channel, text: "Sorry, <@"+message.user+">! "+err+" :sad" }).catch(console.error);
        
      }
      console.log(stat);
      slack.chat.postMessage({ channel: message.channel, text: "Hello <@"+message.user+">! Your chat history is saved to your dropbox public folder Type @hormesaver `check files` to check it :tada:" }).catch(console.error);
      
    }
  );
};

const getChannelHistory = (message, slack) => {
  var tokens = authToken;
  var url = `https://slack.com/api/conversations.history?token=${tokens}&channel=${message.channel}&pretty=1`;
  var xhr = new XMLHttpRequest();
  xhr.onreadystatechange = function() {
    if (xhr.readyState == 4 && xhr.status == 200)
      slack.chat.postMessage({ channel: message.channel, text: "<@"+ message.user +">! Now saving your chat history to dropbox..." })
    .catch(console.error);
      saveHistory(xhr.responseText, message, slack);
    // console.log(xhr.responseText)
  };
  xhr.open("GET", url, true);
  xhr.send();
};

const handleMessage = (data, body) => {
  var message = data.text;
  var channel = data.channel;
  const slack = getClientByTeamId(body.team_id);
  const dfs = require('dropbox-fs')({
    apiKey: dropToken
});
  // console.log(channel);
  if (
    message.includes(" signin") ||
    message.includes(" sign in")
  ) {
    
    var msg = `Authenticate your dropbox account by clicking https://saverbyhorme.glitch.me/login/dropbox`;
    
    slack.chat.postMessage({ channel: channel, text: msg })
    .catch(console.error);
  }
  if (message.includes(" save history") || message.includes("save history")) {
    slack.chat.postMessage({ channel: channel, text: "<@"+ data.user +">! Getting your chat history from slack..." })
    .catch(console.error);
    getChannelHistory(data, slack);
  }
  if (message.includes(" help") || message.includes("@hormesaver help")) {
    slack.chat.postMessage({ channel: channel, text: `To save your chat history to dropbox with hormesaver,\n 
Kindly type @hormesaver save history. \n To do this required login in to your dropbox which you can also do by
Typing @hormesaver signin or @hormesaver signin \n To check the files saved to dropbox type @hormesaver check files` })
    .catch(console.error);
  }
  if(message.includes(" check files")){  dfs.readdir('/slackchathistory', (err, result) => {
    if (err) {
	return slack.chat.postMessage({ channel: channel, text: "Sorry! <@"+ data.user +">! Error "+err.status.code+" while reading your dropbox folder..." })
    .catch(console.error);
    }
    // console.log(result);
      slack.chat.postMessage({ channel: channel, text: "<@"+ data.user +">! Your slack chat json hitsory files are : " })
    .catch(console.error);
    result.forEach(file => {
      
      slack.chat.postMessage({ channel: channel, text: file })
    .catch(console.error);
    });
});
  }
};


// *** Responding to reactions with the same emoji ***
slackEvents.on('reaction_added', (event, body) => {
  // Initialize a client
  const slack = getClientByTeamId(body.team_id);
  // Handle initialization failure
  if (!slack) {
    return console.error('No authorization found for this team. Did you install this app again after restarting?');
  }
  // Respond to the reaction back with the same emoji
  slack.chat.postMessage(event.item.channel, `:${event.reaction}:`)
    .catch(console.error);
});

// *** Handle errors ***
slackEvents.on('error', (error) => {
  if (error.code === slackEventsApi.errorCodes.TOKEN_VERIFICATION_FAILURE) {
    // This error type also has a `body` propery containing the request body which failed verification.
    console.error(`An unverified request was sent to the Slack events Request URL. Request body: \
${JSON.stringify(error.body)}`);
  } else {
    console.error(`An error occurred while handling a Slack event: ${error.message}`);
  }
});

// Start the express application
const port = process.env.PORT || 3000;
http.createServer(app).listen(port, () => {
  console.log(`server listening on port ${port}`);
});
