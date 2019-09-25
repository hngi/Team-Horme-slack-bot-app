const fetch = require("node-fetch");
const { parse, stringify } = require("querystring");
module.exports = async(req, res) => {
    // Extract code received on the request url
    const urlQueryString = req.url.replace(/^.*\?/, "");
    const code = parse(urlQueryString).code;

    // Compose authHeader by encoding the string ${client_id}:${client_secret}
    const client_id = 771591631143.758267133075;
    const client_secret = afcad72f1a86108d1570d99d63e58a17;
    const Authorization =
        "Basic " + Buffer.from(`${client_id}:${client_secret}`).toString("base64");

    // Hit oauth.access for access_token
    const oauthAccess = await fetch("https://slack.com/api/oauth.access", {
        method: "POST",
        body: stringify({ code }),
        headers: {
            Authorization,
            "Content-Type": "application/x-www-form-urlencoded"
        }
    }).catch(err => console.log("oauthAccessError", err));
    const { access_token } = await oauthAccess
        .json()
        .catch(err => console.log("access_token_error", err));

    // Hit auth.test for slack domain
    const authTest = await fetch("https://slack.com/api/auth.test", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${access_token}`
        }
    }).catch(err => console.log("authTestError", err));
    const { url: slackUrl } = await authTest
        .json()
        .catch(err => console.log("slackUrlError", err));

    // Send redirect response to slack domain
    res.writeHead(302, "Redirect", { Location: slackUrl });
    res.end();
};