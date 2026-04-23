import dotenv from 'dotenv'
dotenv.config()

import pg from 'pg'
const { Client } = pg

const client = new Client({
  host: process.env.POSTGRES_HOST,
  port: Number(process.env.POSTGRES_PORT),
  database: process.env.POSTGRES_DBNAME,
  user: process.env.POSTGRES_USERNAME,
  password: process.env.POSTGRES_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  },
  connectionTimeoutMillis: 10000,
  query_timeout: 10000,
  statement_timeout: 10000
})

client.connect()
  .then(() => {
    console.log('connected to postgres')
  })
  .catch((err) => {
    console.error('postgres connection failed')
    console.error(err)
  })

client.on('error', (err) => {
  console.error('postgres client error')
  console.error(err)
})

export const query = async (text, values) => {
  try {
    const now = new Date()
    console.log('query to be executed:', text)
    const res = await client.query(text, values)
    const now2 = new Date()
    console.log(`it took ${now2 - now}ms to run`)
    return res
  } catch (err) {
    console.error('Problem executing query')
    console.error(err)
    throw err
  }
}