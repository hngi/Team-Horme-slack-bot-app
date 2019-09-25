const Slackbot = require("slackbots");
const path = require("path");
const express = require("express");
const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
const app = express();
const dfs = require("dropbox-fs")({
    apiKey: "x535totmco07kxl"
});
const port = 3000;

const token = "xoxb-771591631143-769745293696-xdFsfdeFpfhYCwLtojLJA5Ay";
const bot = new Slackbot({
    token,
    name: "conversation-saver"
});
app.use("*", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
// Start Handler
bot.on("start", () => {
    // bot.postMessageToChannel("general", "Lets help you save your conversation");
    // bot.postMessage("general", "Welcome to Conversation Saver");
    console.log("Bot Started");
});

// Error Handler
bot.on("error", err => console.log(err));

// Message Handler
bot.on("message", data => {
    if (data.user == bot.id) {
        return;
    }
    if (data.type == "message") {
        handleMessage(data);
        console.log(data);
    }
    if (data.type == "app_mention") {
        console.log("object");
    }
    if (data.type == "app_home") {
        console.log("app home opened");
    }
    // console.log(data);
});

const handleMessage = data => {
    var message = data.text;
    var channel = data.channel;
    // console.log(channel);
    if (
        message.includes(" check saved") ||
        message.includes(" sign-up") ||
        message.includes(" sign up")
    ) {
        readFolder(channel);
        // bot.postMessageToChannel("general", "Enter your username");
    }
    if (
        message.includes(" signin") ||
        message.includes(" sign-in") ||
        message.includes(" sign in")
    ) {
        bot.postMessage(channel, "Enter your username");
        // bot.postMessageToChannel("general", "Enter your username");
    }
    if (message.includes(" save history") || message.includes("save history")) {
        // bot.postMessageToChannel("general", "Getting History");
        bot.postMessage(channel, "Getting history");

        getChannelHistory(data.channel);
    }
};

const getChannelHistory = channel => {
    var tokens = `xoxp-771591631143-769737406181-773055873511-a83f6cc276298f58a5ec33139ba95b4e`;
    var url = `https://slack.com/api/conversations.history?token=${tokens}&channel=${channel}`;
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status == 200)
            saveHistory(xhr.responseText, channel);
    };
    xhr.open("GET", url, true);
    xhr.send();
};
const date = Date.now();

const saveHistory = (history, channel) => {
    dfs.writeFile(
        `/public/slack-chat-${date}.json`,
        history, { encoding: "utf8" },
        (err, stat) => {
            if (err) {
                return bot.postMessage(channel, err.status.code);
                console.log(err);
            }
            console.log(stat);
            bot.postMessage(
                channel,
                "Your chat history is saved to your dropbox public folder"
            );
        }
    );
};

const readFolder = channel => {
    dfs.readdir("/public", (err, result) => {
        if (err) {
            return bot.postMessage(channel, err.status.code);
            console.log(err);
        }
        console.log(result);
        result.forEach(file => {
            bot.postMessage(channel, file);
        });
    });
};

app.listen(port, () => {
    console.log(`Example app listening on port ${port}!`);
    bot.login();
});