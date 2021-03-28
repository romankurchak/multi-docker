const keys = require('./keys');

//Express App Setup
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

console.log("Keys: " + JSON.stringify(keys));

//Postgress Client Setup
const { Pool } = require('pg');
const pgClient = new Pool({
    user: keys.user,
    host: keys.pgHost,
    database: keys.pgDatabase,
    password: keys.pgPassword,
    port: keys.pgPort
});

pgClient
    .query('CREATE TABLE IF NOT EXISTS values (number integer)')
    .then(res => console.log(res.rows[0]))
    .catch((err) => console.log(`---------- ERROR during DB creation: ${JSON.stringify(err)}`));

// pgClient.on('notification', async () => {
//     console.log(`---------- PGClient: connect event triggered ----------`);

//     await pgClient
//     .query('CREATE TABLE IF NOT EXISTS values (number integer)')
//     .then(res => console.log(res.rows[0]))
//     .catch((err) => console.log(`---------- ERROR during DB creation: ${JSON.stringify(err)}`));
// });

//Redis Client Setup
const redis = require('redis');
const redisClient = redis.createClient({
    host: keys.redisHost,
    port: keys.redisPort,
    retry_strategy: () => 1000
});

const redisPublisher = redisClient.duplicate();

// Express route handlers
app.get('/', (req, res) => {
    res.send('Hi');
});

app.get('/values/all', async (req, res) => {
    console.log("--------- API request: /values/all -----------");

    const values = await pgClient.query('SELECT * from values;');

    console.log(`--------- API request: /values/all: ${JSON.stringify(values)}-----------`);
    res.send(values.rows);
});

app.get('/values/current', async (req, res) => {
    redisClient.hgetall('values', (err, values) => {
        res.send(values);
    })
});

app.post('/values', async (req, res) => {
    console.log(`---------- API request: /values, payload: ${JSON.stringify(req.body)}`);

    const index = req.body.index;

    if (parseInt(index) > 40) {
        return res.status(422).send('Index too high');
    }

    redisClient.hset('values', index, 'Nothing yet!');

    redisPublisher.publish('insert', index);

    pgClient.query('INSERT INTO values(number) VALUES($1);', [index]);

    res.send({ working: true });
})

app.listen(5000, err => {
    console.log('Listening');
});