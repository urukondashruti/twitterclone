const express = require("express");
const path = require("path");
const app = express();
app.use(express.json());
const dbPath = path.join(__dirname, "twitterClone.db");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
let db = null;
const server = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("server running");
    });
  } catch (e) {
    console.log("error");
  }
};
server();

const authentication = async (request, response, next) => {
  let jwtWeb;
  let jwtToken = request.headers["authorization"];
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  }
  if (jwtToken !== undefined) {
    jwtWeb = jwtToken.split(" ")[1];
    if (jwtWeb === undefined) {
      response.status(401);
      response.send("Invalid JWT Token");
    } else {
      await jwt.verify(jwtWeb, "MY_SECRET_TOKEN", async (error, payload) => {
        if (error) {
          response.status(401);
          response.send("Invalid JWT Token");
        } else {
          request.username = payload.username;
          next();
        }
      });
    }
  }
};

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const hashedPassword = await bcrypt.hash(request.body.password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const createUserQuery = `
      INSERT INTO 
        user (name,username, password, gender) 
      VALUES 
        (
          '${name}',
           '${username}', 
          '${hashedPassword}', 
          '${gender}'
        );`;
      const dbResponse = await db.run(createUserQuery);
      const newUserId = dbResponse.lastID;
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

app.get("/user/tweets/feed/", authentication, async (request, response) => {
  const { username } = request;
  let val = `select * from user where username='${username}';`;
  let val1 = await db.get(val);
  console.log(username);
  const value1 = `select T.username,tweet.tweet,tweet.date_time as dateTime from (user inner join follower on user.user_id=follower.following_user_id ) as T inner join tweet on tweet.user_id=T.following_user_id where follower_user_id='${val1.user_id}' order by tweet.date_time desc limit 4 offset 0;`;
  const result1 = await db.all(value1);
  response.send(result1);
});

app.get("/user/following/", authentication, async (request, response) => {
  const { username } = request;
  const val = `select * from user where username='${username}';`;
  const val1 = await db.get(val);
  const value1 = `select user.name as name from user inner join follower on follower.following_user_id=user.user_id where follower_user_id='${val1.user_id}';`;
  const result1 = await db.all(value1);
  response.send(result1);
});

app.get("/user/followers/", authentication, async (request, response) => {
  const { username } = request;
  const val = `select * from user where username='${username}';`;
  const val1 = await db.get(val);
  const value1 = `select user.name as name from user inner join follower on follower.follower_user_id=user.user_id where following_user_id='${val1.user_id}';`;
  const result1 = await db.all(value1);
  response.send(result1);
});

app.get("/tweets/:tweetId/", authentication, async (request, response) => {
  const { username } = request;
  const { tweetId } = request.params;
  val = `select * from user where username='${username}';`;
  val1 = await db.get(val);
  let value1 = `select * from (user inner join follower on user.user_id=follower.following_user_id ) as T inner join tweet on tweet.user_id=T.following_user_id where follower_user_id='${val1.user_id}' order by tweet.date_time desc;`;
  let result1 = await db.all(value1);
  let count = 0;
  for (let i = 0; i < result1.length; i++) {
    let val5 = result1[i].tweet_id;
    if (val5 == tweetId) {
      let value4 = `select T.tweet ,count(distinct like.like_id) as likes,count(distinct T.reply_id) as replies,T.date_time as dateTime  from (tweet inner join reply on tweet.tweet_id=reply.tweet_id) as T inner join like on T.tweet_id=like.tweet_id  where tweet.tweet_id='${tweetId}' group by tweet.tweet_id;`;
      let result4 = await db.get(value4);
      response.send(result4);
      break;
    } else {
      count = count + 1;
    }
  }
  if (count == result1.length) {
    response.status(401);
    response.send("Invalid Request");
  }
});

app.get(
  "/tweets/:tweetId/likes/",
  authentication,
  async (request, response) => {
    const { username } = request;
    const { tweetId } = request.params;
    const val = `select * from user where username='${username}';`;
    const val1 = await db.get(val);
    let value1 = `select * from (user inner join follower on user.user_id=follower.following_user_id ) as T inner join tweet on tweet.user_id=T.following_user_id where follower_user_id='${val1.user_id}' order by tweet.date_time desc;`;
    let result1 = await db.all(value1);
    let count = 0;
    for (let i = 0; i < result1.length; i++) {
      let val5 = result1[i].tweet_id;
      if (val5 == tweetId) {
        let value4 = `select user.username from tweet inner join like on tweet.tweet_id=like.tweet_id inner join user on like.user_id=user.user_id  where tweet.tweet_id='${tweetId}';`;
        let result4 = await db.all(value4);
        let list1 = [];
        for (let i = 0; i < result4.length; i++) {
          let val3 = result4[i].username;
          list1.push(val3);
        }
        response.send({ likes: list1 });
        break;
      } else {
        count = count + 1;
      }
    }
    if (count == result1.length) {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

app.get(
  "/tweets/:tweetId/replies/",
  authentication,
  async (request, response) => {
    const { username } = request;
    const { tweetId } = request.params;
    const val = `select * from user where username='${username}';`;
    const val1 = await db.get(val);
    let value1 = `select * from (user inner join follower on user.user_id=follower.following_user_id ) as T inner join tweet on tweet.user_id=T.following_user_id where follower_user_id='${val1.user_id}' order by tweet.date_time desc;`;
    let result1 = await db.all(value1);
    let count = 0;
    for (let i = 0; i < result1.length; i++) {
      let val5 = result1[i].tweet_id;
      if (val5 == tweetId) {
        let value4 = `select user.name,reply.reply from tweet inner join reply on tweet.tweet_id=reply.tweet_id inner join user on reply.user_id=user.user_id  where tweet.tweet_id='${tweetId}';`;
        let result4 = await db.all(value4);
        response.send({ replies: result4 });
        break;
      } else {
        count = count + 1;
      }
    }
    if (count == result1.length) {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

app.get("/user/tweets/", authentication, async (request, response) => {
  const { username } = request;
  const { tweetId } = request.params;
  let val4 = `select * from user where username='${username}';`;
  let val6 = await db.get(val4);
  const val = `select tweet.tweet ,count(distinct like.like_id) as likes,count(distinct reply.reply_id) as replies,tweet.date_time as dateTime  from follower inner join tweet on follower.follower_user_id=tweet.user_id  inner join reply on tweet.tweet_id=reply.tweet_id  inner join like on tweet.tweet_id=like.tweet_id where follower.follower_user_id='${val6.user_id}'  group by tweet.tweet_id;`;
  const val1 = await db.all(val);
  response.send(val1);
});

app.post("/user/tweets/", authentication, async (request, response) => {
  const { tweet } = request.body;
  const { username } = request;
  const { tweetId } = request.params;
  const val = `select * from user where username='${username}';`;
  const val1 = await db.get(val);
  const val7 = `insert into tweet(tweet,user_id) values('${tweet}','${val1.user_id}');`;
  const val8 = await db.run(val7);
  response.send("Created a Tweet");
});
app.delete("/tweets/:tweetId/", authentication, async (request, response) => {
  const { username } = request;
  const { tweetId } = request.params;
  val = `select * from user where username='${username}';`;
  val1 = await db.get(val);
  let value1 = `select tweet_id from follower inner join tweet on tweet.user_id=follower.follower_user_id where follower.follower_user_id='${val1.user_id}';`;
  let result1 = await db.all(value1);
  let count = 0;
  for (let i = 0; i < result1.length; i++) {
    let val5 = result1[i].tweet_id;
    if (val5 == tweetId) {
      let value4 = `delete from tweet  where tweet.tweet_id='${tweetId}';`;
      let result4 = await db.get(value4);
      response.send("Tweet Removed");
      break;
    } else {
      count = count + 1;
    }
  }
  if (count == result1.length) {
    response.status(401);
    response.send("Invalid Request");
  }
});

module.exports = app;
