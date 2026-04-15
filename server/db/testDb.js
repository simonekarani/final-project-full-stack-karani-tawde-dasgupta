import { query } from './postgres.js'

async function testDb() {
  try {
    const result = await query('SELECT * FROM users')
    console.log(result.rows)
  } catch (err) {
    console.error('database test failed:', err.message)
  }
}

testDb()