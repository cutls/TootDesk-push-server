import * as dotenv from 'dotenv'
import { CONFIG } from './interfaces/config'
dotenv.config()
const config = (process.env as unknown) as CONFIG
import axios from 'axios'
import * as mysql from 'mysql2/promise'
import knex from 'knex'
import genKey from './genKey'
const dbConfig = {
    host: config.DB_HOST,
    user: config.DB_USER,
    password: config.DB_PASSWORD,
    database: config.DB_DATABASE,
}
const pool = mysql.createPool(dbConfig)
const my = knex({ client: 'mysql' })
interface IBody {
    domain: string
    at: string
    token: string
    platform: 'ios' | 'android' | 'expo'
}

export default async (body: IBody) => {
    const key = genKey()
    const { domain, at, token, platform } = body
    const param = {
        subscription: {
            endpoint: `${config.ENDPOINT}/hook`,
            keys: {
                p256dh: key.publicKey,
                auth: key.auth
            }
        },
        data: {
            alerts: {
                poll: true,
                follow: true,
                favourite: true,
                reblog: true,
                mention: true
            }
        }
    }
    try {
        const a = await axios.post(`https://${domain}/api/v1/push/subscription`, param, {
            headers: {
                Authorization: `Bearer ${at}`,
                'content-type': 'application/json'
            }
        })
        const data = a.data as any
        const serverKey = data.server_key
        const sql = my(config.DB_TABLE).insert({
            token,
            serverKey,
            platform,
            publicKey: key.publicKey,
            privateKey: key.privateKey,
            auth: key.auth,
            domain
        }).toString()
        await pool.query(sql)
        return true
    } catch (e) {
        console.error(e)
        return false
    }
}