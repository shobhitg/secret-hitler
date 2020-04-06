# Secret Hitler Online
An online implementation of the tabletop game [Secret Hitler](http://secrethitler.com), built on node.js and socket.io. Play at [ec2-54-183-204-38.us-west-1.compute.amazonaws.com:8004](https://ec2-54-183-204-38.us-west-1.compute.amazonaws.com:8004).

Supports 5-10 players, text or voice (beta) chat, and the game's core rule set. Game data is persisted to allow features like stat aggregation, or game replays in future.

# Development

The app is written in vanilla HTML5, CSS3, and JS ES5. Files in `/server` run on the node.js server, files in `/public` are served statically when users load the page, while files in `/common` are shared for both.

#### Node

For testing/development purposes, clone/fork the repository and ensure you have [node.js](https://nodejs.org/en/) installed to start the server:
```
cd secret-hitler
npm install
node server.js
```

By default, the app is served at `localhost:8004`

#### WebPack

All js and css assets in `/public` and `/common` are bundled with [WebPack](https://webpack.github.io) for efficient page loads. To recompile your changes as you work:
```
npm install --global webpack
webpack --watch
```

#### Database

Unless you specifically need to test the user accounts system or game persistence features, you don't need to run a local db instance. Instead, simply sign in via the guest button (note that in this mode, not all features are available). Otherwise, you'll need to be running a recent version of [Postgres](http://www.postgresql.org) locally.

1. Create a new database and import [schema.sql](schema.sql)
2. Set `LOCAL_DB_URL` in [server/tools/config.js](server/tools/config.js) to the Postgres database URL
3. (optional) Set `SENDGRID_API_KEY` to your [SendGrid](https://sendgrid.com) account's API key if you want to test email delivery

# Contributing

Pull requests welcome

# Attribution
"Secret Hitler" is a game designed by Max Temkin, Mike Boxleiter, Tommy Maranges, and Mackenzie Schubert. This adaptation is neither affiliated with, nor endorsed by the copyright holders.

This adaption is available at https://github.com/PDarrall/secret-hitler

Secret Hitler is licensed under [Creative Commons BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) (non-commercial, share-alike, attribution required).

# Screenshots
![Secret Hitler Online start](http://i.imgur.com/QJ1kEXS.png)
